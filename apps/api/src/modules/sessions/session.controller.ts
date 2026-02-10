import Elysia from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { ValidationError } from "../../shared/errors";
import { created, paginated, success } from "../../shared/response";
import {
	CompleteSessionSchema,
	ScratchpadUpdateSchema,
	SessionHistoryQuerySchema,
	StartSessionSchema,
} from "./session.schema";
import * as sessionService from "./session.service";

export const sessionController = new Elysia({ prefix: "/sessions" })
	.use(authMiddleware)

	.post("/start", async ({ body, userId, set }) => {
		const parsed = StartSessionSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const session = await sessionService.startSession(userId, parsed.data);
		set.status = 201;
		return created(session);
	})

	.get("/active", async ({ userId, set }) => {
		const session = await sessionService.getActiveSession(userId);
		if (!session) {
			set.status = 204;
			return;
		}
		return success(session);
	})

	.patch("/:id/pause", async ({ params, userId }) => {
		const result = await sessionService.pauseSession(userId, params.id);
		return success(result);
	})

	.patch("/:id/resume", async ({ params, userId }) => {
		const result = await sessionService.resumeSession(userId, params.id);
		return success(result);
	})

	.post("/:id/complete", async ({ params, body, userId }) => {
		const parsed = CompleteSessionSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const result = await sessionService.completeSession(
			userId,
			params.id,
			parsed.data,
		);
		return success(result);
	})

	.patch("/:id/scratchpad", async ({ params, body, userId }) => {
		const parsed = ScratchpadUpdateSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const result = await sessionService.updateScratchpad(
			userId,
			params.id,
			parsed.data.content,
		);
		return success(result);
	})

	.get("/history", async ({ query, userId }) => {
		const parsed = SessionHistoryQuerySchema.safeParse(query);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const { sessions, total } = await sessionService.getSessionHistory(
			userId,
			parsed.data,
		);
		return paginated(sessions, total, parsed.data.page, parsed.data.limit);
	});
