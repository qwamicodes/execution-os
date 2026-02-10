import type { TaskSize, TaskUrgency } from "@repo/database";
import Elysia from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { prisma } from "../../shared/database";
import { NotFoundError, ValidationError } from "../../shared/errors";
import { success } from "../../shared/response";
import { ManualClassificationSchema } from "./inbox.schema";

export const inboxController = new Elysia({ prefix: "/inbox" })
	.use(authMiddleware)

	.get("/", async ({ userId }) => {
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

		return success({
			tasks,
			meta: {
				total: tasks.length,
				pendingClassification,
			},
		});
	})

	.post("/:id/classify", async ({ params, body, userId }) => {
		const parsed = ManualClassificationSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const task = await prisma.task.findFirst({
			where: { id: params.id, userId, state: "Inbox", deletedAt: null },
		});

		if (!task) {
			throw new NotFoundError("Inbox task");
		}

		const input = parsed.data;

		const updated = await prisma.task.update({
			where: { id: params.id },
			data: {
				projectId: input.projectId,
				size: input.size as TaskSize | undefined,
				urgency: input.urgency as TaskUrgency | undefined,
				protected: input.protected,
				tags: input.tags,
				state: "Ready",
				stateChangedAt: new Date(),
				stateHistory: {
					create: {
						fromState: "Inbox",
						toState: "Ready",
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

		return success(updated);
	});
