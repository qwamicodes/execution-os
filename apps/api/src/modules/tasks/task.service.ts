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
		type: "Clients" | "Core" | "SideQuest" | "Office";
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
	projectType: "Clients" | "Core" | "SideQuest" | "Office" | undefined,
) {
	if (projectType === "Clients" || projectType === "Office") return 15;
	if (projectType === "Core") return 5;
	if (projectType === "SideQuest") return -15;
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

function hasIdeaTag(tags: string[]) {
	return tags.some((tag) => {
		const normalized = tag.toLowerCase();
		return normalized === "idea" || normalized.startsWith("idea/");
	});
}

function isIdeaTagValue(tag: string) {
	const normalized = tag.toLowerCase();
	return normalized === "idea" || normalized.startsWith("idea/");
}

function normalizeUniqueTags(tags: string[]) {
	return Array.from(
		new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
	);
}

function mergeClassificationTags(existingTags: string[], aiTags: string[]) {
	const normalizedExisting = normalizeUniqueTags(existingTags);
	const normalizedAI = normalizeUniqueTags(aiTags);

	if (!hasIdeaTag(normalizedExisting)) {
		return normalizedAI.length > 0 ? normalizedAI : existingTags;
	}

	const ideaTags = normalizedExisting.filter(isIdeaTagValue);
	const aiNonIdeaTags = normalizedAI.filter((tag) => !isIdeaTagValue(tag));
	return Array.from(new Set([...ideaTags, ...aiNonIdeaTags]));
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

	const task = await prisma.task.create({
		data: {
			title: input.title,
			description: input.description,
			projectId: input.projectId,
			deadline: input.deadline ? new Date(input.deadline) : undefined,
			tags: input.tags ?? [],
			source: input.source,
			sourceMetadata: input.sourceMetadata as Prisma.InputJsonValue,
			userId,
			state: "Inbox",
		},
		include: {
			project: {
				select: { id: true, name: true, type: true },
			},
		},
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
			task.priorityOverrideUntil &&
			task.priorityOverrideUntil > now,
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
				select: { id: true, name: true, type: true },
			},
		},
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	const isIdeaTask = hasIdeaTag(task.tags);

	if (task.state !== "Inbox" && !isIdeaTask) {
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

	if (isIdeaTask) {
		const reviewUpdate = await prisma.task.update({
			where: { id: task.id },
			data: {
				title: rewrittenTitle || task.title,
				description: rewrittenDescription || task.description,
				sourceMetadata: mergeAIClassificationMetadata(task.sourceMetadata, {
					status: "needs_review",
					jobStatus: "completed_idea_review",
					confidence,
					suggested: {
						project: classification.project,
						size: classification.size,
						urgency: classification.urgency,
						deadline: classification.deadline,
						protected: classification.protected,
						protectionReason: classification.protectionReason,
						tags: mergedTags,
						title: rewrittenTitle,
						description: rewrittenDescription,
					},
					provider: classification.provider,
					model: classification.model,
					reason: classification.reason ?? null,
					classifiedAt: new Date().toISOString(),
					ideaMode: true,
				}),
			},
			include: {
				project: {
					select: { id: true, name: true, type: true },
				},
			},
		});

		logger.info({
			event: "task_auto_classification_idea_needs_review",
			task_id: task.id,
			user_id: userId,
			confidence,
			provider: classification.provider,
			model: classification.model,
			state: reviewUpdate.state,
		});

		return reviewUpdate;
	}

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
					select: { id: true, name: true, type: true },
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
				select: { id: true, name: true, type: true },
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
		void runAIDecomposition(userId, task.id).catch((error) => {
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
	if (query.size) where.size = query.size;
	if (query.protected !== undefined) where.protected = query.protected;
	if (query.hasDeadline !== undefined) {
		where.deadline = query.hasDeadline ? { not: null } : null;
	}
	if (query.search) {
		where.OR = [
			{ title: { contains: query.search, mode: "insensitive" } },
			{ description: { contains: query.search, mode: "insensitive" } },
		];
	}
	if (query.tag) {
		where.tags = { has: query.tag };
	}
	if (query.kind === "idea") {
		where.tags = { has: "idea" };
	}
	if (query.kind === "execution") {
		where.NOT = [{ tags: { has: "idea" } }];
	}

	const [tasks, total] = await Promise.all([
		prisma.task.findMany({
			where,
			orderBy: { [query.sortBy]: query.sortOrder },
			skip: (query.page - 1) * query.limit,
			take: query.limit,
			include: {
				project: {
					select: { id: true, name: true, type: true },
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
				select: { id: true, name: true, type: true },
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

	return task;
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

	const { state, ...updateData } = input;

	const task = await prisma.task.update({
		where: { id: taskId },
		data: {
			...updateData,
			deadline:
				updateData.deadline !== undefined
					? updateData.deadline
						? new Date(updateData.deadline)
						: null
					: undefined,
			...(state
				? {
						state: state as TaskState,
						stateChangedAt: new Date(),
						stateHistory: {
							create: {
								fromState: existing.state,
								toState: state as TaskState,
								reason: "Manual state change",
								userId,
							},
						},
					}
				: {}),
		},
		include: {
			project: {
				select: { id: true, name: true, type: true },
			},
			subtasks: {
				where: { deletedAt: null },
				orderBy: { order: "asc" },
			},
		},
	});

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
				select: { id: true, name: true, type: true },
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

async function runAIDecomposition(
	userId: string,
	taskId: string,
	feedback?: string,
) {
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
	});

	if (!task) {
		return;
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

	await prisma.$transaction(async (tx) => {
		const parentTask = await tx.task.findFirst({
			where: { id: taskId, userId, deletedAt: null },
		});
		if (!parentTask) return;

		const currentSubtasks = await tx.task.count({
			where: { parentId: taskId, deletedAt: null },
		});
		if (currentSubtasks > 0) return;

		for (const [index, subtask] of subtasks.entries()) {
			const targetState: TaskState = index === 0 ? "Ready" : "Ongoing";

			await tx.task.create({
				data: {
					title: subtask.title,
					description: subtask.description,
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
}

export async function decomposeTask(
	userId: string,
	taskId: string,
	feedback?: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("task_service", {
		operation: "decompose",
		user_id: userId,
		task_id: taskId,
		has_feedback: Boolean(feedback),
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
		throw new ConflictError("Task already has subtasks");
	}

	if (task.size === "Small") {
		throw new UnprocessableError("Task size is Small (cannot decompose)");
	}

	// Transition to Ongoing
	if (task.state !== "Ongoing") {
		await prisma.task.update({
			where: { id: taskId },
			data: {
				state: "Ongoing",
				stateChangedAt: new Date(),
				stateHistory: {
					create: {
						fromState: task.state,
						toState: "Ongoing",
						reason: "Decomposition requested",
						userId,
					},
				},
			},
		});
	}

	void runAIDecomposition(userId, taskId, feedback).catch((error) => {
		logger.error({
			event: "task_decomposition_failed",
			task_id: taskId,
			user_id: userId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	});

	void recalculatePrioritiesForUser(userId).catch((error) => {
		logger.warn({
			event: "priority_recalc_after_decomposition_request_failed",
			task_id: taskId,
			user_id: userId,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	});

	return {
		message: "Decomposition requested with AI",
		taskId,
		jobId: `job_${Date.now()}`,
	};
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
