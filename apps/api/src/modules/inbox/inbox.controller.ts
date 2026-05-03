import type { Prisma, TaskSize, TaskUrgency } from "@repo/database";

import Elysia from "elysia";

import { authMiddleware } from "../../middleware/auth";
import { basePlugin } from "../../plugins/base";
import { prisma } from "../../shared/database";
import { NotFoundError, ValidationError } from "../../shared/errors";
import { success } from "../../shared/response";

import { publishRealtimeEvent } from "../events/realtime.service";
import {
	autoClassifyTask,
	recalculatePrioritiesForUser,
} from "../tasks/task.service";

import { InboxQuerySchema, ManualClassificationSchema } from "./inbox.schema";

function manualClassifiedState(
	size?: TaskSize,
	urgency?: TaskUrgency,
	deadline?: Date | null,
) {
	if (urgency === "Low" && deadline) {
		const diffDays = Math.floor((deadline.getTime() - Date.now()) / 86_400_000);
		if (diffDays > 30) return "Paused" as const;
	}
	if (size === "Large" || size === "Huge") return "Ongoing" as const;
	return "Ready" as const;
}

function isNeedsReview(sourceMetadata: unknown) {
	if (!sourceMetadata || typeof sourceMetadata !== "object") {
		return false;
	}
	const metadata = sourceMetadata as Record<string, unknown>;
	const aiClassification = metadata.aiClassification;
	if (!aiClassification || typeof aiClassification !== "object") {
		return false;
	}
	const status = (aiClassification as Record<string, unknown>).status;
	return status === "needs_review";
}

function toMetadataObject(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function getAIClassification(sourceMetadata: unknown): Record<string, unknown> {
	const metadata = toMetadataObject(sourceMetadata);
	return toMetadataObject(metadata.aiClassification);
}

function getAISuggestion(sourceMetadata: unknown): Record<string, unknown> {
	return toMetadataObject(getAIClassification(sourceMetadata).suggested);
}

function isTaskSize(value: unknown): value is TaskSize {
	return (
		value === "Small" ||
		value === "Medium" ||
		value === "Large" ||
		value === "Huge"
	);
}

function isTaskUrgency(value: unknown): value is TaskUrgency {
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

function toSuggestedTags(value: unknown) {
	if (!Array.isArray(value)) return undefined;
	const tags = value.filter((tag): tag is string => typeof tag === "string");
	return tags.length > 0 ? Array.from(new Set(tags)) : undefined;
}

function toSuggestedDeadline(value: unknown) {
	if (typeof value !== "string") return undefined;
	const deadline = new Date(value);
	return Number.isNaN(deadline.getTime()) ? undefined : deadline;
}

async function getInboxTasksAwaitingAISuggestions(userId: string) {
	const tasks = await prisma.task.findMany({
		where: {
			userId,
			state: "Inbox",
			deletedAt: null,
		},
	});
	return tasks.filter((task) => isNeedsReview(task.sourceMetadata));
}

export const inboxController = new Elysia({ prefix: "/inbox" })
	.use(basePlugin)
	.use(authMiddleware)

	.get("/", async ({ query, userId, internal_logger }) => {
		internal_logger.set("flow", "inbox_list");
		const parsed = InboxQuerySchema.safeParse(query);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("query", parsed.data);

		const where: Prisma.TaskWhereInput = {
			userId,
			state: "Inbox",
			deletedAt: null,
		};
		if (parsed.data.projectId) where.projectId = parsed.data.projectId;
		if (parsed.data.size) where.size = parsed.data.size;
		if (parsed.data.protected !== undefined) {
			where.protected = parsed.data.protected;
		}
		if (parsed.data.hasDeadline !== undefined) {
			where.deadline = parsed.data.hasDeadline ? { not: null } : null;
		}
		if (parsed.data.source) where.source = parsed.data.source;
		if (parsed.data.tag) where.tags = { has: parsed.data.tag };
		if (parsed.data.triageStatus === "pending") {
			where.size = null;
			where.urgency = null;
		}

		const searchQuery = parsed.data.searchQuery ?? parsed.data.search;
		if (searchQuery) {
			where.AND = [
				...(Array.isArray(where.AND) ? where.AND : []),
				{
					OR: [
						{ title: { contains: searchQuery, mode: "insensitive" } },
						{ description: { contains: searchQuery, mode: "insensitive" } },
					],
				},
			];
		}

		let tasks = await prisma.task.findMany({
			where,
			orderBy: { [parsed.data.sortBy]: parsed.data.sortOrder },
			include: {
				project: {
					select: { id: true, name: true, type: true },
				},
			},
		});

		if (parsed.data.triageStatus === "needsReview") {
			tasks = tasks.filter((task) => isNeedsReview(task.sourceMetadata));
		}
		if (parsed.data.triageStatus === "classified") {
			tasks = tasks.filter((task) => task.size && task.urgency);
		}

		const pendingClassification = tasks.filter(
			(t) => !t.size && !t.urgency,
		).length;

		const needsReview = tasks.filter((task) =>
			isNeedsReview(task.sourceMetadata),
		).length;

		internal_logger?.set("result", {
			total: tasks.length,
			pending_classification: pendingClassification,
			needs_review: needsReview,
		});

		return success({
			tasks,
			meta: {
				total: tasks.length,
				pendingClassification,
				needsReview,
			},
		});
	})

	.post("/classify/ignore-all", async ({ userId, internal_logger }) => {
		internal_logger.set("flow", "inbox_ignore_all_ai_suggestions");
		const tasks = await getInboxTasksAwaitingAISuggestions(userId);
		const ignoredAt = new Date().toISOString();

		for (const task of tasks) {
			const metadata = toMetadataObject(task.sourceMetadata);
			const aiClassification = getAIClassification(task.sourceMetadata);
			await prisma.task.update({
				where: { id: task.id },
				data: {
					sourceMetadata: {
						...metadata,
						aiClassification: {
							...aiClassification,
							status: "ignored",
							ignoredAt,
						},
					},
				},
			});
			publishRealtimeEvent(userId, "inbox.ai_suggestion_ignored", {
				taskId: task.id,
			});
		}

		internal_logger.set("result", { ignored: tasks.length });
		return success({ ignored: tasks.length });
	})

	.post("/classify/apply-all", async ({ userId, internal_logger }) => {
		internal_logger.set("flow", "inbox_apply_all_ai_suggestions");
		const tasks = await getInboxTasksAwaitingAISuggestions(userId);
		let applied = 0;

		for (const task of tasks) {
			const suggestion = getAISuggestion(task.sourceMetadata);
			const size = isTaskSize(suggestion.size) ? suggestion.size : undefined;
			const urgency = isTaskUrgency(suggestion.urgency)
				? suggestion.urgency
				: undefined;
			const deadline = toSuggestedDeadline(suggestion.deadline);
			const nextState = manualClassifiedState(size, urgency, deadline ?? null);

			await prisma.task.update({
				where: { id: task.id },
				data: {
					title:
						typeof suggestion.title === "string" ? suggestion.title : undefined,
					description:
						typeof suggestion.description === "string"
							? suggestion.description
							: undefined,
					size,
					urgency,
					protected:
						typeof suggestion.protected === "boolean"
							? suggestion.protected
							: undefined,
					protectionReason: isProtectionReason(suggestion.protectionReason)
						? suggestion.protectionReason
						: undefined,
					deadline,
					tags: toSuggestedTags(suggestion.tags),
					state: nextState,
					stateChangedAt: new Date(),
					stateHistory: {
						create: {
							fromState: "Inbox",
							toState: nextState,
							reason: "Bulk AI suggestion applied",
							userId,
						},
					},
				},
			});
			applied += 1;
			publishRealtimeEvent(userId, "inbox.classified", {
				taskId: task.id,
				state: nextState,
			});
			publishRealtimeEvent(userId, "task.state_changed", {
				taskId: task.id,
				toState: nextState,
			});
		}

		if (applied > 0) {
			void recalculatePrioritiesForUser(userId, internal_logger);
		}
		internal_logger.set("result", { applied });
		return success({ applied });
	})

	.delete("/classify/delete-all", async ({ userId, internal_logger }) => {
		internal_logger.set("flow", "inbox_delete_all_ai_suggestions");
		const tasks = await getInboxTasksAwaitingAISuggestions(userId);
		const deletedAt = new Date();

		if (tasks.length > 0) {
			await prisma.task.updateMany({
				where: {
					id: { in: tasks.map((task) => task.id) },
					userId,
					state: "Inbox",
					deletedAt: null,
				},
				data: { deletedAt },
			});
		}

		for (const task of tasks) {
			publishRealtimeEvent(userId, "task.deleted", { taskId: task.id });
		}

		internal_logger.set("result", { deleted: tasks.length });
		return success({ deleted: tasks.length });
	})

	.post(
		"/:id/classify",
		async ({ params, body, userId, internal_logger }) => {
			internal_logger.set("flow", "inbox_manual_classify");

			internal_logger.set("classify_input", {
				task_id: params.id,
				user_id: userId,
				size: body.size ?? null,
				urgency: body.urgency ?? null,
				protected: body.protected,
			});

			const task = await prisma.task.findFirst({
				where: { id: params.id, userId, state: "Inbox", deletedAt: null },
			});

			if (!task) {
				throw new NotFoundError("Inbox task");
			}

			const input = body;
			const deadline =
				input.deadline === undefined
					? undefined
					: input.deadline
						? new Date(input.deadline)
						: null;
			const nextState = manualClassifiedState(
				input.size as TaskSize | undefined,
				input.urgency as TaskUrgency | undefined,
				deadline ?? null,
			);
			const mergedTags = input.tags;

			const updated = await prisma.task.update({
				where: { id: params.id },
				data: {
					title: input.title ?? undefined,
					description:
						input.description === undefined ? undefined : input.description,
					projectId: input.projectId,
					size: input.size as TaskSize | undefined,
					urgency: input.urgency as TaskUrgency | undefined,
					protected: input.protected,
					protectionReason: input.protectionReason ?? undefined,
					deadline,
					tags: mergedTags,
					state: nextState,
					stateChangedAt: new Date(),
					stateHistory: {
						create: {
							fromState: "Inbox",
							toState: nextState,
							reason: "Manual classification",
							userId,
						},
					},
				},
				include: {
					project: {
						select: { id: true, name: true },
					},
				},
			});
			internal_logger?.set("result", {
				task_id: updated.id,
				state: updated.state,
			});

			void recalculatePrioritiesForUser(userId, internal_logger);
			publishRealtimeEvent(userId, "inbox.classified", {
				taskId: updated.id,
				state: updated.state,
			});
			publishRealtimeEvent(userId, "task.state_changed", {
				taskId: updated.id,
				toState: updated.state,
			});

			return success(updated);
		},
		{ body: ManualClassificationSchema },
	)

	.post("/:id/classify/auto", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "inbox_auto_classify");
		internal_logger.set("classify_input", {
			task_id: params.id,
			user_id: userId,
		});
		const updated = await autoClassifyTask(userId, params.id, internal_logger);
		internal_logger.set("result", {
			task_id: updated.id,
			state: updated.state,
		});
		publishRealtimeEvent(userId, "inbox.classified_auto", {
			taskId: updated.id,
			state: updated.state,
		});
		publishRealtimeEvent(userId, "task.state_changed", {
			taskId: updated.id,
			toState: updated.state,
		});
		return success(updated);
	})

	.post("/:id/classify/ignore", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "inbox_ignore_ai_suggestion");
		internal_logger.set("classify_input", {
			task_id: params.id,
			user_id: userId,
		});

		const task = await prisma.task.findFirst({
			where: { id: params.id, userId, state: "Inbox", deletedAt: null },
		});

		if (!task) {
			throw new NotFoundError("Inbox task");
		}

		const metadata =
			task.sourceMetadata &&
			typeof task.sourceMetadata === "object" &&
			!Array.isArray(task.sourceMetadata)
				? (task.sourceMetadata as Record<string, unknown>)
				: {};
		const aiClassification =
			metadata.aiClassification &&
			typeof metadata.aiClassification === "object" &&
			!Array.isArray(metadata.aiClassification)
				? (metadata.aiClassification as Record<string, unknown>)
				: {};

		const updated = await prisma.task.update({
			where: { id: task.id },
			data: {
				sourceMetadata: {
					...metadata,
					aiClassification: {
						...aiClassification,
						status: "ignored",
						ignoredAt: new Date().toISOString(),
					},
				},
			},
			include: {
				project: {
					select: { id: true, name: true, type: true },
				},
			},
		});

		internal_logger.set("result", {
			task_id: updated.id,
			ai_status: "ignored",
		});
		publishRealtimeEvent(userId, "inbox.ai_suggestion_ignored", {
			taskId: updated.id,
		});

		return success(updated);
	});
