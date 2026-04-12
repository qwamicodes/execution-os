import type { TaskSize, TaskUrgency } from "@repo/database";

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

import { ManualClassificationSchema } from "./inbox.schema";

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

export const inboxController = new Elysia({ prefix: "/inbox" })
	.use(basePlugin)
	.use(authMiddleware)

	.get("/", async ({ userId, internal_logger }) => {
		internal_logger.set("flow", "inbox_list");
		const tasks = await prisma.task.findMany({
			where: {
				userId,
				state: "Inbox",
				deletedAt: null,
			},
			orderBy: { createdAt: "desc" },
			include: {
				project: {
					select: { id: true, name: true },
				},
			},
		});

		const pendingClassification = tasks.filter(
			(t) => !t.size && !t.urgency,
		).length;

		const needsReview = tasks.filter((task) => {
			if (!task.sourceMetadata || typeof task.sourceMetadata !== "object") {
				return false;
			}
			const metadata = task.sourceMetadata as Record<string, unknown>;
			const aiClassification = metadata.aiClassification;
			if (!aiClassification || typeof aiClassification !== "object") {
				return false;
			}
			const status = (aiClassification as Record<string, unknown>).status;
			return status === "needs_review";
		}).length;

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
	});
