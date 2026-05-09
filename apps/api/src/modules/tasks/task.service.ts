import type { Prisma, TaskSize, TaskState, TaskUrgency } from "@repo/database";

import moment from "moment";

import { env } from "../../config";
import { prisma } from "../../shared/database";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ServiceUnavailableError,
	UnprocessableError,
} from "../../shared/errors";
import { logger } from "../../shared/logger";
import type { RequestLogger } from "../../shared/wide-event";
import { classifyTaskWithAI, decomposeTaskWithAI } from "../ai/ai.service";
import { createBranchForTask } from "../integrations/integration.service";
import type {
	CreateBranchInput,
	CreateTaskInput,
	PriorityOverrideInput,
	TaskQuery,
	UpdateTaskInput,
} from "./task.schema";

// Valid state transitions per spec
const VALID_TRANSITIONS: Record<string, string[]> = {
	Inbox: ["Ongoing", "Ready"],
	Ongoing: ["Ready", "Done"],
	Ready: ["Active", "Ongoing", "Blocked", "Paused", "Done"],
	Active: ["Ready", "Blocked", "Paused", "Done"],
	Blocked: ["Ready", "Ongoing"],
	Paused: ["Ready", "Ongoing"],
	Done: ["Ready"], // reopen
};

export function isValidTransition(from: string, to: string): boolean {
	return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function mapTaskStateToIdeaState(state: TaskState) {
	if (state === "Inbox") return "Captured";
	if (state === "Ongoing") return "Classified";
	if (state === "Ready" || state === "Active") return "Clarified";
	if (state === "Blocked" || state === "Paused") return "Incubating";
	return "Archived";
}

type PriorityLayer = "Now" | "Next" | "ThisWeek" | "Hidden";

interface PriorityFactors {
	deadline: number;
	protected: number;
	projectHealth: number;
	capacity: number;
	age: number;
}

interface PriorityComputationResult {
	score: number;
	layer: PriorityLayer;
	factors: PriorityFactors;
	overrideActive: boolean;
	overrideExpiresAt: string | null;
	overrideReason: string | null;
}

export interface TaskPriorityExplanation extends PriorityComputationResult {
	taskId: string;
	reason: string;
}

interface TaskForPriority {
	id: string;
	title: string;
	createdAt: Date;
	deadline: Date | null;
	protected: boolean;
	protectionReason: string | null;
	priority: number | null;
	priorityOverride: number | null;
	priorityOverrideUntil: Date | null;
	priorityOverrideReason: string | null;
	project: {
		id: string;
		type: "Clients" | "Core" | "InHouse" | "Office";
		updatedAt: Date;
	} | null;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function normalize(value: number, min: number, max: number) {
	if (max <= min) return 0;
	return ((clamp(value, min, max) - min) / (max - min)) * 100;
}

function dayStart(date: Date) {
	const result = new Date(date);
	result.setHours(0, 0, 0, 0);
	return result;
}

function deadlineScore(deadline: Date | null, now: Date) {
	if (!deadline) return 20;

	const diffDays = Math.floor(
		(dayStart(deadline).getTime() - dayStart(now).getTime()) / 86_400_000,
	);
	if (diffDays < 0) return 100;
	if (diffDays === 0) return 90;
	if (diffDays === 1) return 80;
	if (diffDays <= 7) return 70;
	if (diffDays <= 14) return 50;
	if (diffDays <= 31) return 30;
	return 20;
}

function protectedScore(protectedFlag: boolean, reason: string | null) {
	if (!protectedFlag) return 0;
	const normalized = reason?.toLowerCase() ?? "";
	if (normalized.includes("contract")) return 30;
	if (normalized.includes("sla")) return 30;
	if (normalized.includes("client")) return 25;
	if (normalized.includes("investor")) return 25;
	if (normalized.includes("depend")) return 20;
	return 30;
}

function projectTypePriorityScore(
	projectType: "Clients" | "Core" | "InHouse" | "Office" | undefined,
) {
	if (projectType === "Clients" || projectType === "Office") return 15;
	if (projectType === "Core") return 10;
	if (projectType === "InHouse") return 8;
	return 0;
}

function projectHealthScore(
	task: TaskForPriority,
	overdueProjectIds: Set<string>,
	now: Date,
) {
	let score = projectTypePriorityScore(task.project?.type);
	if (task.project) {
		const inactivityDays =
			(now.getTime() - task.project.updatedAt.getTime()) / 86_400_000;
		if (inactivityDays > 7) score += 10;
		if (overdueProjectIds.has(task.project.id)) score += 5;
	}
	return score;
}

function capacityScore(completedSessionsToday: number) {
	if (completedSessionsToday < 4) return 10;
	if (completedSessionsToday <= 6) return 5;
	return -5;
}

function ageScore(createdAt: Date, now: Date) {
	const ageDays = (now.getTime() - createdAt.getTime()) / 86_400_000;
	if (ageDays > 60) return 10;
	if (ageDays > 30) return 5;
	return 0;
}

function layerFromScore(score: number): PriorityLayer {
	if (score >= 90) return "Now";
	if (score >= 70) return "Next";
	if (score >= 50) return "ThisWeek";
	return "Hidden";
}

function buildPriorityReason(
	factors: PriorityFactors,
	task: TaskForPriority,
	overrideActive: boolean,
) {
	if (overrideActive) {
		return `manual priority override active${task.priorityOverrideReason ? `: ${task.priorityOverrideReason}` : ""}`;
	}

	const reasons: string[] = [];
	if (factors.deadline >= 90) reasons.push("deadline is due today/overdue");
	else if (factors.deadline >= 70) reasons.push("deadline is approaching");
	if (factors.protected > 0) reasons.push("task is protected");
	if (factors.projectHealth >= 10)
		reasons.push("project health needs attention");
	if (factors.age >= 5) reasons.push("task is aging in backlog");
	if (factors.capacity >= 10) reasons.push("capacity is available now");

	if (reasons.length === 0) {
		return "combined score from deadline, project health, capacity, and age";
	}

	return reasons.join("; ");
}

function toDateOnly(value: string | null | undefined): Date | null {
	if (!value) return null;
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isJsonObject(
	value: Prisma.JsonValue | Record<string, unknown> | null | undefined,
): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function mergeAIClassificationMetadata(
	existing: Prisma.JsonValue | null | undefined,
	patch: Record<string, unknown>,
): Prisma.InputJsonValue {
	const base = isJsonObject(existing) ? existing : {};
	const existingAi = isJsonObject(base.aiClassification)
		? base.aiClassification
		: {};
	return {
		...base,
		aiClassification: {
			...existingAi,
			...patch,
		},
	} as Prisma.InputJsonValue;
}

function mergeFeatureGateMetadata(
	existing: Prisma.JsonValue | null | undefined,
	featureBlocked: boolean,
	featureBlockReason: string | null,
	blockingTaskIds?: string[] | null,
	blocksTaskIds?: string[] | null,
): Prisma.InputJsonValue {
	const normalizedBlockingTaskIds = Array.from(
		new Set((blockingTaskIds ?? []).filter(Boolean)),
	);
	const normalizedBlocksTaskIds = Array.from(
		new Set((blocksTaskIds ?? []).filter(Boolean)),
	);
	const base = isJsonObject(existing) ? existing : {};
	return {
		...base,
		featureGate: {
			blocked: featureBlocked,
			reason: featureBlocked ? featureBlockReason : null,
			blockingTaskIds: featureBlocked ? normalizedBlockingTaskIds : [],
			blockingTaskId: featureBlocked
				? (normalizedBlockingTaskIds[0] ?? null)
				: null,
			blocksTaskIds: normalizedBlocksTaskIds,
			blocksTaskId: normalizedBlocksTaskIds[0] ?? null,
		},
	} as Prisma.InputJsonValue;
}

function normalizeDependencyIds(
	ids?: string[] | null,
	singleId?: string | null,
) {
	const normalizedIds = Array.from(new Set((ids ?? []).filter(Boolean)));
	if (singleId && !normalizedIds.includes(singleId)) {
		normalizedIds.push(singleId);
	}
	return normalizedIds;
}

function readFeatureGateDependencies(
	value: Prisma.JsonValue | null | undefined,
) {
	if (!isJsonObject(value) || !isJsonObject(value.featureGate)) {
		return {
			blocked: false,
			reason: null as string | null,
			blockingTaskIds: [] as string[],
			blocksTaskIds: [] as string[],
		};
	}
	const gate = value.featureGate as Record<string, unknown>;
	const blockingTaskIds = Array.isArray(gate.blockingTaskIds)
		? gate.blockingTaskIds.filter((id): id is string => typeof id === "string")
		: typeof gate.blockingTaskId === "string"
			? [gate.blockingTaskId]
			: [];
	const blocksTaskIds = Array.isArray(gate.blocksTaskIds)
		? gate.blocksTaskIds.filter((id): id is string => typeof id === "string")
		: typeof gate.blocksTaskId === "string"
			? [gate.blocksTaskId]
			: [];
	return {
		blocked: gate.blocked === true,
		reason: typeof gate.reason === "string" ? gate.reason : null,
		blockingTaskIds: Array.from(new Set(blockingTaskIds)),
		blocksTaskIds: Array.from(new Set(blocksTaskIds)),
	};
}

async function findIncompleteTaskIds(
	client: typeof prisma | Prisma.TransactionClient,
	userId: string,
	taskIds: string[],
) {
	const uniqueTaskIds = Array.from(new Set(taskIds.filter(Boolean)));
	if (uniqueTaskIds.length === 0) return [];
	const incompleteTasks = await client.task.findMany({
		where: {
			id: { in: uniqueTaskIds },
			userId,
			deletedAt: null,
			state: { not: "Done" },
		},
		select: { id: true },
	});
	const incompleteTaskIds = new Set(incompleteTasks.map((task) => task.id));
	return uniqueTaskIds.filter((taskId) => incompleteTaskIds.has(taskId));
}

async function reconcileBlockedTaskGate(
	client: typeof prisma | Prisma.TransactionClient,
	params: {
		userId: string;
		blockedTaskId: string;
		resolvedBlockingTaskId?: string;
		blockingTaskIds?: string[];
	},
) {
	const blockedTask = await client.task.findFirst({
		where: { id: params.blockedTaskId, userId: params.userId, deletedAt: null },
		select: { id: true, state: true, sourceMetadata: true },
	});
	if (!blockedTask) return;

	const gate = readFeatureGateDependencies(
		blockedTask.sourceMetadata as Prisma.JsonValue,
	);
	const candidateBlockingTaskIds =
		params.blockingTaskIds ??
		gate.blockingTaskIds.filter(
			(taskId) => taskId !== params.resolvedBlockingTaskId,
		);
	const incompleteBlockingTaskIds = await findIncompleteTaskIds(
		client,
		params.userId,
		candidateBlockingTaskIds,
	);
	const nextBlocked = incompleteBlockingTaskIds.length > 0;
	const data: Prisma.TaskUpdateInput = {
		sourceMetadata: mergeFeatureGateMetadata(
			blockedTask.sourceMetadata,
			nextBlocked,
			nextBlocked ? gate.reason : null,
			incompleteBlockingTaskIds,
			gate.blocksTaskIds,
		),
	};

	if (!nextBlocked && blockedTask.state === "Blocked") {
		data.state = "Ready";
		data.stateChangedAt = new Date();
		data.stateHistory = {
			create: {
				fromState: "Blocked",
				toState: "Ready",
				reason: "Unblocked after dependency completed",
				userId: params.userId,
			},
		};
	}

	await client.task.update({
		where: { id: blockedTask.id },
		data,
	});
}

export async function reconcileTaskDependencyCompletion(
	userId: string,
	completedTaskId: string,
	client: typeof prisma | Prisma.TransactionClient = prisma,
	blockedTaskIds?: string[],
) {
	const completedTask = await client.task.findFirst({
		where: { id: completedTaskId, userId, deletedAt: null },
		select: { sourceMetadata: true },
	});
	if (!completedTask) return;

	const gate = readFeatureGateDependencies(
		completedTask.sourceMetadata as Prisma.JsonValue,
	);
	const linkedBlockedTasks = await client.task.findMany({
		where: {
			userId,
			deletedAt: null,
			id: { not: completedTaskId },
			OR: [
				{
					sourceMetadata: {
						path: ["featureGate", "blockingTaskId"],
						equals: completedTaskId,
					},
				},
				{
					sourceMetadata: {
						path: ["featureGate", "blockingTaskIds"],
						array_contains: completedTaskId,
					},
				},
			],
		},
		select: { id: true },
	});
	const taskIdsToReconcile = Array.from(
		new Set([
			...(blockedTaskIds ?? gate.blocksTaskIds),
			...linkedBlockedTasks.map((task) => task.id),
		]),
	);
	for (const blockedTaskId of taskIdsToReconcile) {
		await reconcileBlockedTaskGate(client, {
			userId,
			blockedTaskId,
			resolvedBlockingTaskId: completedTaskId,
		});
	}
}

async function sleep(ms: number) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveProjectIdByName(
	userId: string,
	projectName: string | null,
) {
	if (!projectName) return null;
	const exact = await prisma.project.findFirst({
		where: {
			userId,
			deletedAt: null,
			name: { equals: projectName, mode: "insensitive" },
		},
		select: { id: true },
	});

	if (exact) return exact.id;

	const similar = await prisma.project.findFirst({
		where: {
			userId,
			deletedAt: null,
			name: { contains: projectName, mode: "insensitive" },
		},
		orderBy: { updatedAt: "desc" },
		select: { id: true },
	});

	return similar?.id ?? null;
}

function classifyStateFromClassification(
	size: TaskSize,
	urgency: TaskUrgency,
	deadline: Date | null,
) {
	if (urgency === "Low" && deadline) {
		const diffDays = Math.floor((deadline.getTime() - Date.now()) / 86_400_000);
		if (diffDays > 30) return "Paused";
	}
	return size === "Large" || size === "Huge" ? "Ongoing" : "Ready";
}

function getAIClassification(sourceMetadata: Prisma.JsonValue | null) {
	const metadata = isJsonObject(sourceMetadata) ? sourceMetadata : {};
	return isJsonObject(metadata.aiClassification)
		? metadata.aiClassification
		: {};
}

function getAISuggestion(sourceMetadata: Prisma.JsonValue | null) {
	const aiClassification = getAIClassification(sourceMetadata);
	return isJsonObject(aiClassification.suggested)
		? aiClassification.suggested
		: {};
}

function isPendingAISuggestion(sourceMetadata: Prisma.JsonValue | null) {
	return getAIClassification(sourceMetadata).status === "needs_review";
}

function isClassificationSize(value: unknown): value is TaskSize {
	return (
		value === "Small" ||
		value === "Medium" ||
		value === "Large" ||
		value === "Huge"
	);
}

function isClassificationUrgency(value: unknown): value is TaskUrgency {
	return (
		value === "Urgent" ||
		value === "High" ||
		value === "Medium" ||
		value === "Low"
	);
}

function isProtectionReason(
	value: unknown,
): value is "contract" | "sla" | "client" | "investor" {
	return (
		value === "contract" ||
		value === "sla" ||
		value === "client" ||
		value === "investor"
	);
}

function suggestedTags(value: unknown) {
	if (!Array.isArray(value)) return undefined;
	const tags = value.filter((tag): tag is string => typeof tag === "string");
	return tags.length > 0 ? Array.from(new Set(tags)) : undefined;
}

function normalizeUniqueTags(tags: string[]) {
	return Array.from(
		new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
	);
}

function mergeClassificationTags(existingTags: string[], aiTags: string[]) {
	const normalizedExisting = normalizeUniqueTags(existingTags);
	const normalizedAI = normalizeUniqueTags(aiTags);
	return normalizedAI.length > 0 ? normalizedAI : normalizedExisting;
}

function normalizePartIds(partIds?: string[] | null, partId?: string | null) {
	return Array.from(new Set([...(partIds ?? []), ...(partId ? [partId] : [])]));
}

async function validateTaskPartIds(
	userId: string,
	projectId: string | null | undefined,
	partIds: string[],
) {
	if (partIds.length === 0) return;
	if (!projectId) {
		throw new UnprocessableError(
			"Parts require the task to belong to a project",
		);
	}
	const project = await prisma.project.findFirst({
		where: { id: projectId, userId, deletedAt: null },
		select: { structureType: true },
	});
	if (project?.structureType !== "Monorepo") {
		throw new UnprocessableError(
			"Parts can only be assigned on monorepo projects",
		);
	}
	const matchingParts = await prisma.projectPart.findMany({
		where: { id: { in: partIds }, userId, projectId },
		select: { id: true },
	});
	if (matchingParts.length !== partIds.length) {
		throw new UnprocessableError(
			"All parts must belong to the selected project",
		);
	}
}

function normalizeEpicIds(epicIds?: string[] | null) {
	return Array.from(new Set(epicIds ?? []));
}

async function validateTaskEpicIds(
	userId: string,
	projectId: string | null | undefined,
	epicIds: string[],
) {
	if (epicIds.length === 0) return;
	if (!projectId) {
		throw new UnprocessableError(
			"Epics require the task to belong to a project",
		);
	}
	const matchingEpics = await prisma.projectEpic.findMany({
		where: { id: { in: epicIds }, userId, projectId },
		select: { id: true },
	});
	if (matchingEpics.length !== epicIds.length) {
		throw new UnprocessableError(
			"All epics must belong to the selected project",
		);
	}
}

export async function createTask(
	userId: string,
	input: CreateTaskInput,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "create",
		user_id: userId,
		source: input.source,
	});
	if (input.projectId) {
		const project = await prisma.project.findFirst({
			where: { id: input.projectId, userId, deletedAt: null },
		});
		if (!project) {
			throw new NotFoundError("Project");
		}
	}
	const inputPartIds = normalizePartIds(input.partIds, input.partId);
	const inputEpicIds = normalizeEpicIds(input.epicIds);
	await validateTaskPartIds(userId, input.projectId, inputPartIds);
	await validateTaskEpicIds(userId, input.projectId, inputEpicIds);
	if (input.milestoneId) {
		if (!input.projectId) {
			throw new UnprocessableError(
				"Milestone requires the task to belong to a project",
			);
		}
		const milestone = await prisma.projectMilestone.findFirst({
			where: { id: input.milestoneId, userId, projectId: input.projectId },
			select: { id: true },
		});
		if (!milestone) {
			throw new UnprocessableError(
				"Milestone must belong to the selected project",
			);
		}
	}

	if (
		input.deadline &&
		moment(input.deadline).isBefore(moment().subtract(1, "day"))
	) {
		requestLogger?.set(
			"deadline_in_past",
			moment(input.deadline).isBefore(new Date()),
		);
		throw new UnprocessableError("Deadline cannot be in the past");
	}

	const blockingTaskIds = normalizeDependencyIds(
		input.blockingTaskIds,
		input.blockingTaskId,
	);
	const blocksTaskIds = normalizeDependencyIds(
		input.blocksTaskIds,
		input.blocksTaskId,
	);

	if (blockingTaskIds.length > 0) {
		if (!input.projectId) {
			throw new UnprocessableError(
				"Blocking task requires the task to belong to a project",
			);
		}
		for (const blockingTaskId of blockingTaskIds) {
			const blockingTask = await prisma.task.findFirst({
				where: {
					id: blockingTaskId,
					userId,
					deletedAt: null,
				},
				select: { id: true, projectId: true },
			});
			if (!blockingTask) {
				throw new NotFoundError("Blocking task");
			}
			if (blockingTask.projectId !== input.projectId) {
				throw new UnprocessableError(
					"Blocking task must belong to the same project",
				);
			}
		}
	}

	if (blocksTaskIds.length > 0) {
		if (!input.projectId) {
			throw new UnprocessableError(
				"Blocked task requires the task to belong to a project",
			);
		}
		for (const blockedTaskId of blocksTaskIds) {
			const blockedTask = await prisma.task.findFirst({
				where: {
					id: blockedTaskId,
					userId,
					deletedAt: null,
				},
				select: { id: true, projectId: true },
			});
			if (!blockedTask) {
				throw new NotFoundError("Blocked task");
			}
			if (blockedTask.projectId !== input.projectId) {
				throw new UnprocessableError(
					"Blocked task must belong to the same project",
				);
			}
		}
	}

	if (blockingTaskIds.some((taskId) => blocksTaskIds.includes(taskId))) {
		throw new UnprocessableError(
			"A task cannot be blocked by and block the same task(s)",
		);
	}

	const task = await prisma.$transaction(async (tx) => {
		const created = await tx.task.create({
			data: {
				title: input.title,
				description: input.description,
				projectId: input.projectId,
				partId: inputPartIds[0],
				parts:
					inputPartIds.length > 0
						? {
								create: inputPartIds.map((partId) => ({
									partId,
								})),
							}
						: undefined,
				epics:
					inputEpicIds.length > 0
						? {
								create: inputEpicIds.map((epicId) => ({
									epicId,
								})),
							}
						: undefined,
				milestoneId: input.milestoneId,
				priority: input.priority,
				priorityOverride: input.priority,
				priorityOverrideReason:
					input.priority !== undefined ? "Manual task priority" : undefined,
				deadline: input.deadline ? new Date(input.deadline) : undefined,
				tags: input.tags ?? [],
				source: input.source,
				sourceMetadata:
					input.featureBlocked !== undefined ||
					input.featureBlockReason !== undefined ||
					blockingTaskIds.length > 0 ||
					blocksTaskIds.length > 0
						? mergeFeatureGateMetadata(
								input.sourceMetadata as Prisma.JsonValue,
								Boolean(input.featureBlocked || blockingTaskIds.length > 0),
								input.featureBlocked
									? (input.featureBlockReason ?? null)
									: null,
								blockingTaskIds,
								blocksTaskIds,
							)
						: (input.sourceMetadata as Prisma.InputJsonValue),
				userId,
				state: "Inbox",
			},
			include: {
				project: {
					select: { id: true, name: true, type: true, structureType: true },
				},
				part: {
					select: { id: true, name: true, order: true },
				},
				parts: {
					select: {
						part: { select: { id: true, name: true, order: true } },
					},
				},
				epics: {
					select: {
						epic: { select: { id: true, key: true, name: true, order: true } },
					},
				},
				milestone: {
					select: { id: true, title: true, targetDate: true, status: true },
				},
			},
		});

		for (const blockedTaskId of blocksTaskIds) {
			const existingBlockedTask = await tx.task.findFirst({
				where: { id: blockedTaskId, userId, deletedAt: null },
				select: { sourceMetadata: true },
			});
			if (!existingBlockedTask) {
				throw new NotFoundError("Blocked task");
			}
			const blockedTaskGate = readFeatureGateDependencies(
				existingBlockedTask.sourceMetadata as Prisma.JsonValue,
			);
			const nextBlockingTaskIds = Array.from(
				new Set([...blockedTaskGate.blockingTaskIds, created.id]),
			);
			await tx.task.update({
				where: { id: blockedTaskId },
				data: {
					sourceMetadata: mergeFeatureGateMetadata(
						existingBlockedTask.sourceMetadata,
						nextBlockingTaskIds.length > 0,
						blockedTaskGate.reason,
						nextBlockingTaskIds,
						blockedTaskGate.blocksTaskIds,
					),
				},
			});
		}

		return created;
	});

	return task;
}

async function loadPriorityContext(userId: string, now: Date) {
	const start = dayStart(now);
	const end = new Date(start);
	end.setHours(23, 59, 59, 999);

	const [completedSessionsToday, overdueProjects] = await Promise.all([
		prisma.session.count({
			where: {
				userId,
				state: "Completed",
				completedAt: {
					gte: start,
					lte: end,
				},
			},
		}),
		prisma.task.findMany({
			where: {
				userId,
				deletedAt: null,
				state: { not: "Done" },
				deadline: { lt: now },
				projectId: { not: null },
			},
			select: { projectId: true },
			distinct: ["projectId"],
		}),
	]);

	return {
		completedSessionsToday,
		overdueProjectIds: new Set(
			overdueProjects
				.map((entry) => entry.projectId)
				.filter((projectId): projectId is string => Boolean(projectId)),
		),
	};
}

function computePriorityForTask(
	task: TaskForPriority,
	context: {
		completedSessionsToday: number;
		overdueProjectIds: Set<string>;
	},
	now: Date,
): PriorityComputationResult {
	const overrideActive = Boolean(
		task.priorityOverride !== null &&
			(!task.priorityOverrideUntil || task.priorityOverrideUntil > now),
	);

	const factors: PriorityFactors = {
		deadline: deadlineScore(task.deadline, now),
		protected: protectedScore(task.protected, task.protectionReason),
		projectHealth: projectHealthScore(task, context.overdueProjectIds, now),
		capacity: capacityScore(context.completedSessionsToday),
		age: ageScore(task.createdAt, now),
	};

	const weightedScore = Math.round(
		factors.deadline * 0.4 +
			normalize(factors.protected, 0, 30) * 0.3 +
			normalize(factors.projectHealth, -15, 30) * 0.15 +
			normalize(factors.capacity, -5, 10) * 0.1 +
			normalize(factors.age, 0, 10) * 0.05,
	);

	let score = overrideActive
		? clamp(task.priorityOverride ?? weightedScore, 0, 100)
		: clamp(weightedScore, 0, 100);

	if (task.protected && !overrideActive) {
		score = Math.max(70, score);
	}

	return {
		score,
		layer: layerFromScore(score),
		factors,
		overrideActive,
		overrideExpiresAt: overrideActive
			? (task.priorityOverrideUntil?.toISOString() ?? null)
			: null,
		overrideReason: overrideActive ? task.priorityOverrideReason : null,
	};
}

export async function recalculatePrioritiesForUser(
	userId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "recalculate_priorities",
		user_id: userId,
	});
	const now = new Date();
	const context = await loadPriorityContext(userId, now);
	const tasks = await prisma.task.findMany({
		where: {
			userId,
			deletedAt: null,
			state: { in: ["Ready", "Ongoing"] },
		},
		select: {
			id: true,
			title: true,
			createdAt: true,
			deadline: true,
			protected: true,
			protectionReason: true,
			priority: true,
			priorityOverride: true,
			priorityOverrideUntil: true,
			priorityOverrideReason: true,
			project: {
				select: {
					id: true,
					type: true,
					updatedAt: true,
				},
			},
		},
	});

	const updates: Prisma.PrismaPromise<unknown>[] = [];

	for (const task of tasks) {
		const scoreData = computePriorityForTask(
			{
				...task,
				project: task.project
					? {
							id: task.project.id,
							type: task.project.type,
							updatedAt: task.project.updatedAt,
						}
					: null,
			},
			context,
			now,
		);

		const overrideExpired = Boolean(
			task.priorityOverrideUntil && task.priorityOverrideUntil <= now,
		);
		const updateData: Prisma.TaskUpdateInput = {};

		if (overrideExpired) {
			updateData.priorityOverride = null;
			updateData.priorityOverrideReason = null;
			updateData.priorityOverrideUntil = null;
		}

		if (task.priority !== scoreData.score) {
			updateData.priority = scoreData.score;
		}

		if (Object.keys(updateData).length > 0) {
			updates.push(
				prisma.task.update({
					where: { id: task.id },
					data: updateData,
				}),
			);
		}
	}

	if (updates.length > 0) {
		await prisma.$transaction(updates);
	}

	return { total: tasks.length, updated: updates.length };
}

export async function explainTaskPriority(
	userId: string,
	taskId: string,
	requestLogger?: RequestLogger,
): Promise<TaskPriorityExplanation> {
	requestLogger?.set("task_service", {
		operation: "explain_priority",
		user_id: userId,
		task_id: taskId,
	});
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
		select: {
			id: true,
			title: true,
			createdAt: true,
			deadline: true,
			protected: true,
			protectionReason: true,
			priority: true,
			priorityOverride: true,
			priorityOverrideUntil: true,
			priorityOverrideReason: true,
			project: {
				select: {
					id: true,
					type: true,
					updatedAt: true,
				},
			},
		},
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	const now = new Date();
	const context = await loadPriorityContext(userId, now);
	const scoreData = computePriorityForTask(
		{
			...task,
			project: task.project
				? {
						id: task.project.id,
						type: task.project.type,
						updatedAt: task.project.updatedAt,
					}
				: null,
		},
		context,
		now,
	);

	return {
		taskId: task.id,
		...scoreData,
		reason: buildPriorityReason(
			scoreData.factors,
			{
				...task,
				project: task.project
					? {
							id: task.project.id,
							type: task.project.type,
							updatedAt: task.project.updatedAt,
						}
					: null,
			},
			scoreData.overrideActive,
		),
	};
}

export async function overrideTaskPriority(
	userId: string,
	taskId: string,
	input: PriorityOverrideInput,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "override_priority",
		user_id: userId,
		task_id: taskId,
		mode: input.mode,
	});
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
		select: {
			id: true,
			priority: true,
			protected: true,
		},
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	const now = new Date();
	const overrideUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

	let targetScore = task.priority ?? 50;
	if (input.mode === "promote") {
		targetScore = Math.max(targetScore, 90);
	}
	if (input.mode === "demote") {
		targetScore = task.protected ? 60 : 35;
	}
	if (input.mode === "set") {
		targetScore = clamp(input.score ?? targetScore, 0, 100);
	}

	const updated = await prisma.task.update({
		where: { id: task.id },
		data: {
			priority: targetScore,
			priorityOverride: targetScore,
			priorityOverrideUntil: overrideUntil,
			priorityOverrideReason: input.reason?.slice(0, 200) ?? null,
		},
	});

	return {
		task: updated,
		warning:
			task.protected && input.mode === "demote"
				? "Protected task demoted temporarily; it will revert after 24 hours."
				: null,
	};
}

export async function clearTaskPriorityOverride(
	userId: string,
	taskId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "clear_priority_override",
		user_id: userId,
		task_id: taskId,
	});
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
		select: { id: true },
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	await prisma.task.update({
		where: { id: task.id },
		data: {
			priorityOverride: null,
			priorityOverrideReason: null,
			priorityOverrideUntil: null,
		},
	});

	await recalculatePrioritiesForUser(userId);
	const refreshed = await prisma.task.findUnique({ where: { id: task.id } });
	return refreshed;
}

export async function autoClassifyTask(
	userId: string,
	taskId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "auto_classify",
		user_id: userId,
		task_id: taskId,
	});
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
		include: {
			project: {
				select: { id: true, name: true, type: true, structureType: true },
			},
			part: {
				select: { id: true, name: true, order: true },
			},
			parts: {
				select: {
					part: { select: { id: true, name: true, order: true } },
				},
			},
			epics: {
				select: {
					epic: {
						select: {
							id: true,
							key: true,
							name: true,
							order: true,
							targetDate: true,
						},
					},
				},
			},
			milestone: {
				select: { id: true, title: true, targetDate: true, status: true },
			},
		},
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	if (task.state !== "Inbox") {
		throw new ConflictError("Only Inbox tasks can be auto-classified");
	}

	let classification: Awaited<ReturnType<typeof classifyTaskWithAI>> | null =
		null;

	for (
		let attempt = 1;
		attempt <= env.AI_CLASSIFICATION_RETRY_ATTEMPTS;
		attempt++
	) {
		try {
			classification = await classifyTaskWithAI({
				title: task.title,
				description: task.description,
				source: task.source,
			});
			break;
		} catch (error) {
			logger.warn({
				event: "task_auto_classification_attempt_failed",
				task_id: task.id,
				user_id: userId,
				attempt,
				error: error instanceof Error ? error.message : "Unknown error",
			});

			if (attempt < env.AI_CLASSIFICATION_RETRY_ATTEMPTS) {
				await sleep(400 * 2 ** (attempt - 1));
			}
		}
	}

	if (!classification) {
		throw new ServiceUnavailableError("Task auto-classification failed", {
			taskId: task.id,
			attempts: env.AI_CLASSIFICATION_RETRY_ATTEMPTS,
		});
	}

	const parsedDeadline = toDateOnly(classification.deadline) ?? task.deadline;
	const resolvedProjectId =
		(await resolveProjectIdByName(userId, classification.project)) ??
		task.projectId;
	const confidence = classification.confidence ?? 0.75;
	const mergedTags = mergeClassificationTags(task.tags, classification.tags);
	const rewrittenTitle = classification.rewrittenTitle || null;
	const rewrittenDescription = classification.rewrittenDescription || null;

	if (confidence < env.AI_CLASSIFICATION_LOW_CONFIDENCE_THRESHOLD) {
		const reviewUpdate = await prisma.task.update({
			where: { id: task.id },
			data: {
				sourceMetadata: mergeAIClassificationMetadata(task.sourceMetadata, {
					status: "needs_review",
					jobStatus: "completed_low_confidence",
					confidence,
					suggested: {
						project: classification.project,
						size: classification.size,
						urgency: classification.urgency,
						deadline: classification.deadline,
						protected: classification.protected,
						protectionReason: classification.protectionReason,
						tags: mergedTags,
						originalTitle: task.title,
						originalDescription: task.description,
						title: rewrittenTitle,
						description: rewrittenDescription,
					},
					provider: classification.provider,
					model: classification.model,
					reason: classification.reason ?? null,
					classifiedAt: new Date().toISOString(),
				}),
			},
			include: {
				project: {
					select: { id: true, name: true, type: true, structureType: true },
				},
				part: {
					select: { id: true, name: true, order: true },
				},
				parts: {
					select: {
						part: { select: { id: true, name: true, order: true } },
					},
				},
				epics: {
					select: {
						epic: { select: { id: true, key: true, name: true, order: true } },
					},
				},
				milestone: {
					select: { id: true, title: true, targetDate: true, status: true },
				},
			},
		});

		logger.info({
			event: "task_auto_classification_needs_review",
			task_id: task.id,
			user_id: userId,
			requires_review: true,
			confidence,
			provider: classification.provider,
			model: classification.model,
			job_status: "completed_low_confidence",
		});

		return reviewUpdate;
	}

	const nextState = classifyStateFromClassification(
		classification.size,
		classification.urgency,
		parsedDeadline,
	);

	const updated = await prisma.task.update({
		where: { id: task.id },
		data: {
			projectId: resolvedProjectId,
			size: classification.size,
			urgency: classification.urgency,
			protected: classification.protected,
			protectionReason: classification.protectionReason,
			deadline: parsedDeadline,
			tags: mergedTags.length > 0 ? mergedTags : task.tags,
			title: rewrittenTitle || task.title,
			description: rewrittenDescription || task.description,
			state: nextState,
			stateChangedAt: new Date(),
			sourceMetadata: mergeAIClassificationMetadata(task.sourceMetadata, {
				status: "applied",
				confidence,
				provider: classification.provider,
				model: classification.model,
				project: classification.project,
				deadline: classification.deadline,
				protectionReason: classification.protectionReason,
				rewrittenTitle,
				rewrittenDescription,
				reason: classification.reason ?? null,
				classifiedAt: new Date().toISOString(),
			}),
			stateHistory: {
				create: {
					fromState: task.state,
					toState: nextState,
					reason:
						classification.reason ||
						`AI classification via ${classification.provider}`,
					userId,
				},
			},
		},
		include: {
			project: {
				select: { id: true, name: true, type: true, structureType: true },
			},
			part: {
				select: { id: true, name: true, order: true },
			},
			parts: {
				select: {
					part: { select: { id: true, name: true, order: true } },
				},
			},
			epics: {
				select: {
					epic: {
						select: {
							id: true,
							key: true,
							name: true,
							order: true,
							targetDate: true,
						},
					},
				},
			},
			milestone: {
				select: { id: true, title: true, targetDate: true, status: true },
			},
		},
	});

	logger.info({
		event: "task_auto_classified",
		task_id: task.id,
		user_id: userId,
		requires_review: false,
		confidence,
		provider: classification.provider,
		model: classification.model,
		next_state: nextState,
	});

	void recalculatePrioritiesForUser(userId).catch((error) => {
		logger.warn({
			event: "priority_recalc_after_classification_failed",
			task_id: task.id,
			user_id: userId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	});

	if (classification.size === "Large" || classification.size === "Huge") {
		void createSubtasksFromDecomposition(userId, task.id).catch((error) => {
			logger.warn({
				event: "task_auto_decomposition_failed",
				task_id: task.id,
				user_id: userId,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		});
	}

	return updated;
}

export async function applyTaskAISuggestion(
	userId: string,
	taskId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "apply_ai_suggestion",
		user_id: userId,
		task_id: taskId,
	});

	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
		include: {
			project: {
				select: { id: true, name: true, type: true, structureType: true },
			},
			part: {
				select: { id: true, name: true, order: true },
			},
			parts: {
				select: {
					part: { select: { id: true, name: true, order: true } },
				},
			},
			epics: {
				select: {
					epic: {
						select: {
							id: true,
							key: true,
							name: true,
							order: true,
							targetDate: true,
						},
					},
				},
			},
			milestone: {
				select: { id: true, title: true, targetDate: true, status: true },
			},
		},
	});

	if (!task) throw new NotFoundError("Task");
	if (!isPendingAISuggestion(task.sourceMetadata)) {
		throw new ConflictError("Task has no AI suggestion awaiting review");
	}

	const suggestion = getAISuggestion(task.sourceMetadata);
	const size = isClassificationSize(suggestion.size)
		? suggestion.size
		: task.size;
	const urgency = isClassificationUrgency(suggestion.urgency)
		? suggestion.urgency
		: task.urgency;
	const deadline =
		typeof suggestion.deadline === "string"
			? (toDateOnly(suggestion.deadline) ?? task.deadline)
			: task.deadline;
	const nextState =
		task.state === "Inbox" && size && urgency
			? classifyStateFromClassification(size, urgency, deadline)
			: task.state;
	const projectId =
		typeof suggestion.project === "string"
			? ((await resolveProjectIdByName(userId, suggestion.project)) ??
				task.projectId)
			: task.projectId;

	const updated = await prisma.task.update({
		where: { id: task.id },
		data: {
			title:
				typeof suggestion.title === "string" ? suggestion.title : undefined,
			description:
				typeof suggestion.description === "string"
					? suggestion.description
					: undefined,
			projectId,
			size: size ?? undefined,
			urgency: urgency ?? undefined,
			protected:
				typeof suggestion.protected === "boolean"
					? suggestion.protected
					: undefined,
			protectionReason: isProtectionReason(suggestion.protectionReason)
				? suggestion.protectionReason
				: undefined,
			deadline,
			tags: suggestedTags(suggestion.tags),
			state: nextState,
			stateChangedAt: nextState !== task.state ? new Date() : undefined,
			sourceMetadata: mergeAIClassificationMetadata(task.sourceMetadata, {
				status: "applied",
				appliedAt: new Date().toISOString(),
			}),
			stateHistory:
				nextState !== task.state
					? {
							create: {
								fromState: task.state,
								toState: nextState,
								reason: "AI suggestion applied",
								userId,
							},
						}
					: undefined,
		},
		include: {
			project: {
				select: { id: true, name: true, type: true, structureType: true },
			},
			part: {
				select: { id: true, name: true, order: true },
			},
			parts: {
				select: {
					part: { select: { id: true, name: true, order: true } },
				},
			},
			epics: {
				select: {
					epic: {
						select: {
							id: true,
							key: true,
							name: true,
							order: true,
							targetDate: true,
						},
					},
				},
			},
			milestone: {
				select: { id: true, title: true, targetDate: true, status: true },
			},
		},
	});

	void recalculatePrioritiesForUser(userId, requestLogger);
	return updated;
}

export async function ignoreTaskAISuggestion(
	userId: string,
	taskId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "ignore_ai_suggestion",
		user_id: userId,
		task_id: taskId,
	});

	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
	});
	if (!task) throw new NotFoundError("Task");
	if (!isPendingAISuggestion(task.sourceMetadata)) {
		throw new ConflictError("Task has no AI suggestion awaiting review");
	}

	const updated = await prisma.task.update({
		where: { id: task.id },
		data: {
			sourceMetadata: mergeAIClassificationMetadata(task.sourceMetadata, {
				status: "ignored",
				ignoredAt: new Date().toISOString(),
			}),
		},
		include: {
			project: {
				select: { id: true, name: true, type: true, structureType: true },
			},
			part: {
				select: { id: true, name: true, order: true },
			},
			parts: {
				select: {
					part: { select: { id: true, name: true, order: true } },
				},
			},
			epics: {
				select: {
					epic: { select: { id: true, key: true, name: true, order: true } },
				},
			},
			milestone: {
				select: { id: true, title: true, targetDate: true, status: true },
			},
		},
	});

	return updated;
}

async function classifyTaskWithRetry(
	task: {
		id: string;
		title: string;
		description: string | null;
		source: string;
	},
	userId: string,
) {
	let classification: Awaited<ReturnType<typeof classifyTaskWithAI>> | null =
		null;

	for (
		let attempt = 1;
		attempt <= env.AI_CLASSIFICATION_RETRY_ATTEMPTS;
		attempt++
	) {
		try {
			classification = await classifyTaskWithAI({
				title: task.title,
				description: task.description,
				source: task.source,
			});
			break;
		} catch (error) {
			logger.warn({
				event: "task_classification_attempt_failed",
				task_id: task.id,
				user_id: userId,
				attempt,
				error: error instanceof Error ? error.message : "Unknown error",
			});
			if (attempt < env.AI_CLASSIFICATION_RETRY_ATTEMPTS) {
				await sleep(400 * 2 ** (attempt - 1));
			}
		}
	}

	if (!classification) {
		throw new ServiceUnavailableError("Task auto-classification failed", {
			taskId: task.id,
			attempts: env.AI_CLASSIFICATION_RETRY_ATTEMPTS,
		});
	}

	return classification;
}

async function refreshTaskClassificationAfterContentUpdate(
	userId: string,
	taskId: string,
	requestLogger?: RequestLogger,
) {
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
		include: {
			project: {
				select: { id: true, name: true, type: true, structureType: true },
			},
			part: {
				select: { id: true, name: true, order: true },
			},
			parts: {
				select: {
					part: { select: { id: true, name: true, order: true } },
				},
			},
			epics: {
				select: {
					epic: { select: { id: true, key: true, name: true, order: true } },
				},
			},
			milestone: {
				select: { id: true, title: true, targetDate: true, status: true },
			},
			subtasks: {
				where: { deletedAt: null },
				orderBy: { order: "asc" },
			},
		},
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	const classification = await classifyTaskWithRetry(
		{
			id: task.id,
			title: task.title,
			description: task.description,
			source: task.source,
		},
		userId,
	);
	const confidence = classification.confidence ?? 0.75;
	const parsedDeadline = toDateOnly(classification.deadline) ?? task.deadline;
	const resolvedProjectId =
		(await resolveProjectIdByName(userId, classification.project)) ??
		task.projectId;
	const mergedTags = mergeClassificationTags(task.tags, classification.tags);
	const rewrittenTitle = classification.rewrittenTitle || null;
	const rewrittenDescription = classification.rewrittenDescription || null;

	const refreshedTask = await prisma.task.update({
		where: { id: task.id },
		data: {
			projectId: resolvedProjectId,
			size: classification.size,
			urgency: classification.urgency,
			protected: classification.protected,
			protectionReason: classification.protectionReason,
			deadline: parsedDeadline,
			tags: mergedTags.length > 0 ? mergedTags : task.tags,
			title: rewrittenTitle || task.title,
			description: rewrittenDescription || task.description,
			sourceMetadata: mergeAIClassificationMetadata(task.sourceMetadata, {
				status: "refreshed",
				jobStatus: "completed_after_edit",
				confidence,
				provider: classification.provider,
				model: classification.model,
				project: classification.project,
				deadline: classification.deadline,
				protectionReason: classification.protectionReason,
				rewrittenTitle,
				rewrittenDescription,
				reason: classification.reason ?? null,
				classifiedAt: new Date().toISOString(),
				trigger: "content_edit",
			}),
		},
		include: {
			project: {
				select: { id: true, name: true, type: true, structureType: true },
			},
			part: {
				select: { id: true, name: true, order: true },
			},
			parts: {
				select: {
					part: { select: { id: true, name: true, order: true } },
				},
			},
			epics: {
				select: {
					epic: { select: { id: true, key: true, name: true, order: true } },
				},
			},
			milestone: {
				select: { id: true, title: true, targetDate: true, status: true },
			},
			subtasks: {
				where: { deletedAt: null },
				orderBy: { order: "asc" },
			},
		},
	});

	logger.info({
		event: "task_reclassified_after_content_edit",
		task_id: task.id,
		user_id: userId,
		mode: "applied",
		confidence,
		provider: classification.provider,
		model: classification.model,
	});

	return refreshedTask;
}

export async function listTasks(
	userId: string,
	query: TaskQuery,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "list",
		user_id: userId,
	});
	const where: Prisma.TaskWhereInput = {
		userId,
		deletedAt: null,
	};

	if (query.state) where.state = query.state as TaskState;
	if (query.projectId) where.projectId = query.projectId;
	if (query.partId) {
		where.AND = [
			...(Array.isArray(where.AND) ? where.AND : []),
			{
				OR: [
					{ partId: query.partId },
					{ parts: { some: { partId: query.partId } } },
				],
			},
		];
	}
	if (query.epicId) {
		where.AND = [
			...(Array.isArray(where.AND) ? where.AND : []),
			{ epics: { some: { epicId: query.epicId } } },
		];
	}
	if (query.milestoneId) where.milestoneId = query.milestoneId;
	if (query.size) where.size = query.size;
	if (query.protected !== undefined) where.protected = query.protected;
	if (query.hasDeadline !== undefined) {
		where.deadline = query.hasDeadline ? { not: null } : null;
	}
	const searchQuery = query.searchQuery ?? query.search;
	if (searchQuery) {
		where.OR = [
			{ title: { contains: searchQuery, mode: "insensitive" } },
			{ description: { contains: searchQuery, mode: "insensitive" } },
		];
	}
	if (query.tag) {
		where.tags = { has: query.tag };
	}

	const [tasks, total] = await Promise.all([
		prisma.task.findMany({
			where,
			orderBy: { [query.sortBy]: query.sortOrder },
			...(query.limit === -1
				? {}
				: {
						skip: (query.page - 1) * query.limit,
						take: query.limit,
					}),
			include: {
				project: {
					select: { id: true, name: true, type: true, structureType: true },
				},
				part: {
					select: { id: true, name: true, order: true },
				},
				parts: {
					select: {
						part: { select: { id: true, name: true, order: true } },
					},
				},
				epics: {
					select: {
						epic: { select: { id: true, key: true, name: true, order: true } },
					},
				},
				milestone: {
					select: { id: true, title: true, targetDate: true, status: true },
				},
			},
		}),
		prisma.task.count({ where }),
	]);

	return { tasks, total };
}

export async function getTask(
	userId: string,
	taskId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "get",
		user_id: userId,
		task_id: taskId,
	});
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
		include: {
			project: {
				select: { id: true, name: true, type: true, structureType: true },
			},
			part: {
				select: { id: true, name: true, order: true },
			},
			parts: {
				select: {
					part: { select: { id: true, name: true, order: true } },
				},
			},
			epics: {
				select: {
					epic: {
						select: {
							id: true,
							key: true,
							name: true,
							order: true,
							targetDate: true,
						},
					},
				},
			},
			milestone: {
				select: { id: true, title: true, targetDate: true, status: true },
			},
			subtasks: {
				where: { deletedAt: null },
				orderBy: { order: "asc" },
				select: {
					id: true,
					title: true,
					state: true,
					order: true,
					estimatedSessions: true,
					completedSessions: true,
				},
			},
			stateHistory: {
				orderBy: { createdAt: "desc" },
				take: 20,
				select: {
					fromState: true,
					toState: true,
					reason: true,
					createdAt: true,
				},
			},
		},
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	const totalSubtasks = task.subtasks.length;
	const completedSubtasks = task.subtasks.filter(
		(subtask) => subtask.state === "Done",
	).length;

	return {
		...task,
		subtaskProgress: {
			total: totalSubtasks,
			completed: completedSubtasks,
			percent:
				totalSubtasks > 0
					? Math.round((completedSubtasks / totalSubtasks) * 100)
					: 0,
		},
	};
}

export async function updateTask(
	userId: string,
	taskId: string,
	input: UpdateTaskInput,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "update",
		user_id: userId,
		task_id: taskId,
	});
	const existing = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
	});

	if (!existing) {
		throw new NotFoundError("Task");
	}

	if (existing.state === "Active" && !input.state) {
		throw new UnprocessableError("Cannot edit task in Active state");
	}

	// Handle state transition
	if (input.state) {
		if (!isValidTransition(existing.state, input.state)) {
			throw new ConflictError(
				`Invalid state transition from ${existing.state} to ${input.state}`,
			);
		}
	}

	const {
		state,
		partId,
		partIds,
		epicIds,
		milestoneId,
		priority,
		featureBlocked,
		featureBlockReason,
		blockingTaskIds,
		blockingTaskId,
		blocksTaskIds,
		blocksTaskId,
		...updateData
	} = input;
	const titleChanged =
		updateData.title !== undefined && updateData.title !== existing.title;
	const descriptionChanged =
		updateData.description !== undefined &&
		updateData.description !== (existing.description ?? undefined);
	const shouldReclassifyAfterEdit = titleChanged || descriptionChanged;

	if (updateData.projectId) {
		const project = await prisma.project.findFirst({
			where: { id: updateData.projectId, userId, deletedAt: null },
			select: { id: true },
		});
		if (!project) {
			throw new NotFoundError("Project");
		}
	}
	const explicitPartIds =
		partIds !== undefined
			? normalizePartIds(partIds, null)
			: partId !== undefined
				? normalizePartIds(undefined, partId)
				: undefined;
	if (explicitPartIds !== undefined) {
		const effectiveProjectId =
			updateData.projectId !== undefined
				? updateData.projectId
				: existing.projectId;
		await validateTaskPartIds(userId, effectiveProjectId, explicitPartIds);
	}
	const explicitEpicIds =
		epicIds !== undefined ? normalizeEpicIds(epicIds) : undefined;
	if (explicitEpicIds !== undefined) {
		const effectiveProjectId =
			updateData.projectId !== undefined
				? updateData.projectId
				: existing.projectId;
		await validateTaskEpicIds(userId, effectiveProjectId, explicitEpicIds);
	}
	if (milestoneId !== undefined && milestoneId !== null) {
		const effectiveProjectId =
			updateData.projectId !== undefined
				? updateData.projectId
				: existing.projectId;
		if (!effectiveProjectId) {
			throw new UnprocessableError(
				"Milestone requires the task to belong to a project",
			);
		}
		const milestone = await prisma.projectMilestone.findFirst({
			where: { id: milestoneId, userId, projectId: effectiveProjectId },
			select: { id: true },
		});
		if (!milestone) {
			throw new UnprocessableError(
				"Milestone must belong to the selected project",
			);
		}
	}

	const nextProjectId =
		updateData.projectId !== undefined
			? updateData.projectId
			: existing.projectId;
	const hasFeatureGateUpdate =
		featureBlocked !== undefined ||
		featureBlockReason !== undefined ||
		blockingTaskIds !== undefined ||
		blockingTaskId !== undefined ||
		blocksTaskIds !== undefined ||
		blocksTaskId !== undefined;
	const currentGate = readFeatureGateDependencies(
		existing.sourceMetadata as Prisma.JsonValue,
	);

	const nextBlockingTaskIds = normalizeDependencyIds(
		blockingTaskIds !== undefined
			? blockingTaskIds
			: currentGate.blockingTaskIds,
		blockingTaskId !== undefined ? blockingTaskId : null,
	);
	const currentBlocksTaskIds = currentGate.blocksTaskIds;
	const nextBlocksTaskIds = normalizeDependencyIds(
		blocksTaskIds !== undefined ? blocksTaskIds : currentBlocksTaskIds,
		blocksTaskId !== undefined ? blocksTaskId : null,
	);

	if (nextBlockingTaskIds.length > 0) {
		if (!nextProjectId) {
			throw new UnprocessableError(
				"Blocking task requires the task to belong to a project",
			);
		}
		for (const nextBlockingTaskId of nextBlockingTaskIds) {
			if (nextBlockingTaskId === existing.id) {
				throw new UnprocessableError("A task cannot be blocked by itself");
			}
			const blockingTask = await prisma.task.findFirst({
				where: { id: nextBlockingTaskId, userId, deletedAt: null },
				select: { id: true, projectId: true },
			});
			if (!blockingTask) {
				throw new NotFoundError("Blocking task");
			}
			if (blockingTask.projectId !== nextProjectId) {
				throw new UnprocessableError(
					"Blocking task must belong to the same project",
				);
			}
		}
	}

	if (nextBlocksTaskIds.length > 0) {
		if (!nextProjectId) {
			throw new UnprocessableError(
				"Blocked task requires the task to belong to a project",
			);
		}
		for (const nextBlocksTaskId of nextBlocksTaskIds) {
			if (nextBlocksTaskId === existing.id) {
				throw new UnprocessableError("A task cannot block itself");
			}
			const blockedTask = await prisma.task.findFirst({
				where: { id: nextBlocksTaskId, userId, deletedAt: null },
				select: { id: true, projectId: true },
			});
			if (!blockedTask) {
				throw new NotFoundError("Blocked task");
			}
			if (blockedTask.projectId !== nextProjectId) {
				throw new UnprocessableError(
					"Blocked task must belong to the same project",
				);
			}
		}
	}

	if (
		nextBlockingTaskIds.some((taskId) => nextBlocksTaskIds.includes(taskId))
	) {
		throw new UnprocessableError(
			"A task cannot be blocked by and block the same task(s)",
		);
	}

	const incompleteNextBlockingTaskIds = await findIncompleteTaskIds(
		prisma,
		userId,
		nextBlockingTaskIds,
	);
	const preservesManualFeatureBlock =
		featureBlocked === undefined &&
		currentGate.blocked &&
		currentGate.blockingTaskIds.length === 0;
	const nextFeatureBlocked =
		featureBlocked !== undefined
			? featureBlocked &&
				(nextBlockingTaskIds.length === 0 ||
					incompleteNextBlockingTaskIds.length > 0)
			: preservesManualFeatureBlock || incompleteNextBlockingTaskIds.length > 0;
	const effectiveNextBlockingTaskIds =
		nextBlockingTaskIds.length > 0 ? incompleteNextBlockingTaskIds : [];
	const nextFeatureBlockReason = nextFeatureBlocked
		? featureBlockReason !== undefined
			? featureBlockReason
			: currentGate.reason
		: null;
	const shouldWriteFeatureGate =
		hasFeatureGateUpdate ||
		(currentGate.blocked &&
			currentGate.blockingTaskIds.length > 0 &&
			incompleteNextBlockingTaskIds.length !==
				currentGate.blockingTaskIds.length);
	const autoUnblockedState =
		!state &&
		shouldWriteFeatureGate &&
		!nextFeatureBlocked &&
		existing.state === "Blocked"
			? "Ready"
			: null;

	const updatedTask = await prisma.$transaction(async (tx) => {
		const removedBlockedTaskIds = currentBlocksTaskIds.filter(
			(taskId) => !nextBlocksTaskIds.includes(taskId),
		);
		const addedBlockedTaskIds = nextBlocksTaskIds.filter(
			(taskId) => !currentBlocksTaskIds.includes(taskId),
		);

		for (const blockedTaskId of removedBlockedTaskIds) {
			await reconcileBlockedTaskGate(tx, {
				userId,
				blockedTaskId,
				resolvedBlockingTaskId: existing.id,
			});
		}

		for (const blockedTaskId of addedBlockedTaskIds) {
			const blockedTask = await tx.task.findFirst({
				where: { id: blockedTaskId, userId, deletedAt: null },
				select: { sourceMetadata: true },
			});
			if (!blockedTask) {
				throw new NotFoundError("Blocked task");
			}
			const blockedTaskGate = readFeatureGateDependencies(
				blockedTask.sourceMetadata as Prisma.JsonValue,
			);
			const nextBlockingTaskIds = Array.from(
				new Set([...blockedTaskGate.blockingTaskIds, existing.id]),
			);
			await reconcileBlockedTaskGate(tx, {
				userId,
				blockedTaskId,
				blockingTaskIds: nextBlockingTaskIds,
			});
		}

		if (state === "Done") {
			const blockedTaskIds = Array.from(
				new Set([...currentBlocksTaskIds, ...nextBlocksTaskIds]),
			);
			await reconcileTaskDependencyCompletion(
				userId,
				existing.id,
				tx,
				blockedTaskIds,
			);
		}

		const nextState = state ?? autoUnblockedState;
		const nextStateReason = state
			? "Manual state change"
			: "Unblocked after dependency completed";

		return tx.task.update({
			where: { id: taskId },
			data: {
				...updateData,
				partId:
					explicitPartIds !== undefined
						? (explicitPartIds[0] ?? null)
						: updateData.projectId !== undefined
							? null
							: undefined,
				parts:
					explicitPartIds !== undefined
						? {
								deleteMany: {},
								create: explicitPartIds.map((partId) => ({
									partId,
								})),
							}
						: updateData.projectId === null
							? { deleteMany: {} }
							: undefined,
				epics:
					explicitEpicIds !== undefined
						? {
								deleteMany: {},
								create: explicitEpicIds.map((epicId) => ({
									epicId,
								})),
							}
						: updateData.projectId === null
							? { deleteMany: {} }
							: undefined,
				milestoneId:
					milestoneId !== undefined
						? milestoneId
						: updateData.projectId === null
							? null
							: undefined,
				priority: priority !== undefined ? priority : undefined,
				priorityOverride: priority !== undefined ? priority : undefined,
				priorityOverrideUntil: priority !== undefined ? null : undefined,
				priorityOverrideReason:
					priority !== undefined
						? priority === null
							? null
							: "Manual task priority"
						: undefined,
				deadline:
					updateData.deadline !== undefined
						? updateData.deadline
							? new Date(updateData.deadline)
							: null
						: undefined,
				sourceMetadata: shouldWriteFeatureGate
					? mergeFeatureGateMetadata(
							existing.sourceMetadata,
							nextFeatureBlocked,
							nextFeatureBlockReason,
							effectiveNextBlockingTaskIds,
							nextBlocksTaskIds,
						)
					: undefined,
				...(nextState
					? {
							state: nextState as TaskState,
							stateChangedAt: new Date(),
							stateHistory: {
								create: {
									fromState: existing.state,
									toState: nextState as TaskState,
									reason: nextStateReason,
									userId,
								},
							},
						}
					: {}),
			},
			include: {
				project: {
					select: { id: true, name: true, type: true, structureType: true },
				},
				part: {
					select: { id: true, name: true, order: true },
				},
				parts: {
					select: {
						part: { select: { id: true, name: true, order: true } },
					},
				},
				epics: {
					select: {
						epic: { select: { id: true, key: true, name: true, order: true } },
					},
				},
				milestone: {
					select: { id: true, title: true, targetDate: true, status: true },
				},
				subtasks: {
					where: { deletedAt: null },
					orderBy: { order: "asc" },
				},
			},
		});
	});

	let task = updatedTask;
	if (state === "Done" && existing.parentId) {
		const nextSubtask = await prisma.task.findFirst({
			where: {
				parentId: existing.parentId,
				userId,
				deletedAt: null,
				state: { in: ["Ongoing", "Paused"] },
				order:
					existing.order === null || existing.order === undefined
						? undefined
						: { gt: existing.order },
			},
			orderBy: { order: "asc" },
		});

		if (nextSubtask) {
			await prisma.task.update({
				where: { id: nextSubtask.id },
				data: {
					state: "Ready",
					stateChangedAt: new Date(),
					stateHistory: {
						create: {
							fromState: nextSubtask.state,
							toState: "Ready",
							reason: "Previous subtask completed",
							userId,
						},
					},
				},
			});
		}
	}
	if (shouldReclassifyAfterEdit) {
		requestLogger?.set("task_edit_reclassification", {
			task_id: taskId,
			user_id: userId,
			title_changed: titleChanged,
			description_changed: descriptionChanged,
		});
		try {
			task = await refreshTaskClassificationAfterContentUpdate(
				userId,
				taskId,
				requestLogger,
			);
		} catch (error) {
			logger.warn({
				event: "task_reclassification_after_edit_failed",
				task_id: taskId,
				user_id: userId,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	void recalculatePrioritiesForUser(userId).catch((error) => {
		logger.warn({
			event: "priority_recalc_after_task_update_failed",
			task_id: taskId,
			user_id: userId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	});

	return task;
}

export async function createTaskBranch(
	userId: string,
	taskId: string,
	input: CreateBranchInput,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "create_branch",
		user_id: userId,
		task_id: taskId,
	});
	return createBranchForTask({
		userId,
		taskId,
		baseBranch: input.baseBranch,
		branchName: input.branchName,
		requestLogger,
	});
}

export async function convertTaskToIdea(
	userId: string,
	taskId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "convert_to_idea",
		user_id: userId,
		task_id: taskId,
	});
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
	});
	if (!task) throw new NotFoundError("Task");

	const idea = await prisma.$transaction(async (tx) => {
		const createdIdea = await tx.idea.create({
			data: {
				title: task.title,
				description: task.description,
				state: mapTaskStateToIdeaState(task.state),
				deadline: task.deadline,
				source: "task_conversion",
				sourceMetadata: {
					fromTaskId: task.id,
					fromTaskSource: task.source,
					migration: {
						preserved: ["title", "description", "deadline"],
						reset: [
							"state (mapped to idea lifecycle)",
							"size",
							"urgency",
							"protected",
							"protectionReason",
							"tags",
							"projectId",
						],
					},
				},
				userId,
			},
		});
		await tx.task.update({
			where: { id: task.id },
			data: { deletedAt: new Date() },
		});
		return createdIdea;
	});

	return {
		idea,
		migration: {
			applied: ["title", "description", "deadline"],
			reset: [
				"state (mapped to idea lifecycle)",
				"size",
				"urgency",
				"protected",
				"protectionReason",
				"tags",
				"projectId",
			],
			suggestion:
				"Run AI classification on the new idea to regenerate size/urgency/details from title and description.",
		},
	};
}

export async function migrateLegacyIdeaTasks(
	userId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "migrate_legacy_idea_tasks",
		user_id: userId,
	});
	const legacyTasks = await prisma.task.findMany({
		where: {
			userId,
			deletedAt: null,
			tags: {
				hasSome: ["idea", "idea/raw", "idea/validated", "idea/next"],
			},
		},
	});

	let migrated = 0;
	for (const task of legacyTasks) {
		await prisma.$transaction(async (tx) => {
			await tx.idea.create({
				data: {
					title: task.title,
					description: task.description,
					state: mapTaskStateToIdeaState(task.state),
					deadline: task.deadline,
					source: "legacy_task_idea_migration",
					sourceMetadata: {
						fromTaskId: task.id,
						fromTaskSource: task.source,
					},
					userId,
				},
			});
			await tx.task.update({
				where: { id: task.id },
				data: { deletedAt: new Date() },
			});
		});
		migrated += 1;
	}

	return { scanned: legacyTasks.length, migrated };
}

export async function deleteTask(
	userId: string,
	taskId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "delete",
		user_id: userId,
		task_id: taskId,
	});
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	if (task.state === "Active") {
		throw new ConflictError("Cannot delete Active task (end session first)");
	}

	// Soft delete task and its subtasks
	await prisma.task.updateMany({
		where: {
			OR: [{ id: taskId }, { parentId: taskId }],
			userId,
		},
		data: { deletedAt: new Date() },
	});

	void recalculatePrioritiesForUser(userId).catch((error) => {
		logger.warn({
			event: "priority_recalc_after_task_delete_failed",
			task_id: taskId,
			user_id: userId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	});
}

export async function restoreTask(
	userId: string,
	taskId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "restore",
		user_id: userId,
		task_id: taskId,
	});
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: { not: null } },
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	if (task.projectId) {
		const project = await prisma.project.findFirst({
			where: { id: task.projectId, deletedAt: null },
		});
		if (!project) {
			throw new ConflictError("Task's project was deleted");
		}
	}

	const restored = await prisma.task.update({
		where: { id: taskId },
		data: { deletedAt: null },
		include: {
			project: {
				select: { id: true, name: true, type: true, structureType: true },
			},
			part: {
				select: { id: true, name: true, order: true },
			},
			parts: {
				select: {
					part: { select: { id: true, name: true, order: true } },
				},
			},
			epics: {
				select: {
					epic: { select: { id: true, key: true, name: true, order: true } },
				},
			},
			milestone: {
				select: { id: true, title: true, targetDate: true, status: true },
			},
		},
	});

	void recalculatePrioritiesForUser(userId).catch((error) => {
		logger.warn({
			event: "priority_recalc_after_task_restore_failed",
			task_id: taskId,
			user_id: userId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	});

	return restored;
}

async function generateTaskDecomposition(
	userId: string,
	taskId: string,
	feedback?: string,
) {
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
	});

	if (!task) throw new NotFoundError("Task");
	if (task.size === "Small") {
		throw new UnprocessableError("Task size is Small (cannot decompose)");
	}

	const decomposition = await decomposeTaskWithAI({
		title: task.title,
		description: task.description,
		size: task.size,
		feedback,
	});

	const subtasks = decomposition.subtasks.slice(0, 10);
	if (subtasks.length === 0) {
		throw new UnprocessableError("AI decomposition returned no subtasks");
	}

	return { task, decomposition, subtasks };
}

export async function previewTaskDecomposition(
	userId: string,
	taskId: string,
	feedback?: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "preview_decomposition",
		user_id: userId,
		task_id: taskId,
		has_feedback: Boolean(feedback),
	});

	const { decomposition, subtasks } = await generateTaskDecomposition(
		userId,
		taskId,
		feedback,
	);

	return {
		taskId,
		reason: decomposition.reason,
		provider: decomposition.provider,
		model: decomposition.model,
		subtasks: subtasks.map((subtask, index) => ({
			title: subtask.title,
			description: subtask.description ?? null,
			estimatedSessions: subtask.estimatedSessions,
			order: index,
			state: index === 0 ? "Ready" : "Ongoing",
		})),
	};
}

async function createSubtasksFromDecomposition(
	userId: string,
	taskId: string,
	feedback?: string,
	replaceExisting = false,
	acceptedSubtasks?: Array<{
		title: string;
		description?: string | null;
		estimatedSessions: number;
	}>,
) {
	const generated = acceptedSubtasks
		? null
		: await generateTaskDecomposition(userId, taskId, feedback);
	const subtasks = acceptedSubtasks ?? generated?.subtasks ?? [];
	const decomposition = generated?.decomposition ?? {
		reason: "Accepted decomposition preview",
		provider: "preview",
		model: "accepted",
	};

	await prisma.$transaction(async (tx) => {
		const parentTask = await tx.task.findFirst({
			where: { id: taskId, userId, deletedAt: null },
			include: {
				project: {
					select: { structureType: true },
				},
				parts: {
					select: { partId: true },
				},
				epics: {
					select: { epicId: true },
				},
			},
		});
		if (!parentTask) return;
		const parentPartIds =
			parentTask.project?.structureType === "Monorepo"
				? normalizePartIds(
						parentTask.parts.map((entry) => entry.partId),
						parentTask.partId,
					)
				: [];
		const parentEpicIds = normalizeEpicIds(
			parentTask.epics.map((entry) => entry.epicId),
		);

		const currentSubtasks = await tx.task.count({
			where: { parentId: taskId, deletedAt: null },
		});
		if (currentSubtasks > 0 && !replaceExisting) {
			throw new ConflictError("Task already has subtasks");
		}
		if (currentSubtasks > 0 && replaceExisting) {
			await tx.task.updateMany({
				where: { parentId: taskId, userId, deletedAt: null },
				data: { deletedAt: new Date() },
			});
		}

		if (parentTask.state !== "Ongoing") {
			await tx.task.update({
				where: { id: taskId },
				data: {
					state: "Ongoing",
					stateChangedAt: new Date(),
					stateHistory: {
						create: {
							fromState: parentTask.state,
							toState: "Ongoing",
							reason: replaceExisting
								? "Decomposition replaced"
								: "Decomposition applied",
							userId,
						},
					},
				},
			});
		}

		for (const [index, subtask] of subtasks.entries()) {
			const targetState: TaskState = index === 0 ? "Ready" : "Ongoing";

			await tx.task.create({
				data: {
					title: subtask.title,
					description: subtask.description ?? null,
					state: targetState,
					size: "Small",
					urgency: parentTask.urgency,
					protected: parentTask.protected,
					tags: parentTask.tags,
					estimatedSessions: subtask.estimatedSessions,
					parentId: parentTask.id,
					order: index,
					userId,
					projectId: parentTask.projectId,
					partId: parentPartIds[0],
					parts:
						parentPartIds.length > 0
							? {
									create: parentPartIds.map((partId) => ({
										partId,
									})),
								}
							: undefined,
					epics:
						parentEpicIds.length > 0
							? {
									create: parentEpicIds.map((epicId) => ({
										epicId,
									})),
								}
							: undefined,
					source: parentTask.source,
					sourceMetadata: {
						decomposedBy: decomposition.provider,
						decompositionModel: decomposition.model,
					},
					stateHistory: {
						create: {
							fromState: "Inbox",
							toState: targetState,
							reason: `AI decomposition via ${decomposition.provider}`,
							userId,
						},
					},
				},
			});
		}
	});

	void recalculatePrioritiesForUser(userId).catch((error) => {
		logger.warn({
			event: "priority_recalc_after_decomposition_failed",
			task_id: taskId,
			user_id: userId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	});

	logger.info({
		event: "task_decomposition_completed",
		task_id: taskId,
		user_id: userId,
		subtasks_count: subtasks.length,
		provider: decomposition.provider,
		model: decomposition.model,
	});

	return {
		message: replaceExisting
			? "Decomposition replaced"
			: "Decomposition applied",
		taskId,
		subtasksCreated: subtasks.length,
		reason: decomposition.reason,
		provider: decomposition.provider,
		model: decomposition.model,
	};
}

export async function decomposeTask(
	userId: string,
	taskId: string,
	feedback?: string,
	replaceExisting = false,
	acceptedSubtasks?: Array<{
		title: string;
		description?: string | null;
		estimatedSessions: number;
	}>,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "decompose",
		user_id: userId,
		task_id: taskId,
		has_feedback: Boolean(feedback),
		replace_existing: replaceExisting,
		accepted_preview: Boolean(acceptedSubtasks?.length),
	});
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	const existingSubtasks = await prisma.task.count({
		where: { parentId: taskId, deletedAt: null },
	});

	if (existingSubtasks > 0) {
		if (!replaceExisting) throw new ConflictError("Task already has subtasks");
	}

	if (task.size === "Small") {
		throw new UnprocessableError("Task size is Small (cannot decompose)");
	}

	return createSubtasksFromDecomposition(
		userId,
		taskId,
		feedback,
		replaceExisting,
		acceptedSubtasks,
	);
}

export async function getSubtasks(
	userId: string,
	taskId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "get_subtasks",
		user_id: userId,
		task_id: taskId,
	});
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	const subtasks = await prisma.task.findMany({
		where: { parentId: taskId, deletedAt: null },
		orderBy: { order: "asc" },
		select: {
			id: true,
			title: true,
			state: true,
			order: true,
			estimatedSessions: true,
			completedSessions: true,
		},
	});

	return subtasks;
}
