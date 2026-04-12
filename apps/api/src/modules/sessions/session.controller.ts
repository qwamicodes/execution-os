import Elysia from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { basePlugin } from "../../plugins/base";
import { ValidationError } from "../../shared/errors";
import { created, paginated, success } from "../../shared/response";
import { publishRealtimeEvent } from "../events/realtime.service";
import {
	CompleteSessionSchema,
	ExtendSessionSchema,
	ScratchpadUpdateSchema,
	SessionHistoryQuerySchema,
	StartSessionSchema,
} from "./session.schema";
import * as sessionService from "./session.service";

export const sessionController = new Elysia({ prefix: "/sessions" })
	.use(basePlugin)
	.use(authMiddleware)

	.post("/start", async ({ body, userId, internal_logger }) => {
		internal_logger.set("flow", "sessions_start");
		const parsed = StartSessionSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("session_input", {
			user_id: userId,
			task_id: parsed.data.taskId,
			duration: parsed.data.duration,
		});

		const session = await sessionService.startSession(
			userId,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", {
			session_id: session.id,
			task_id: session.taskId,
			state: session.state,
		});
		publishRealtimeEvent(userId, "session.started", {
			sessionId: session.id,
			taskId: session.taskId,
			state: session.state,
		});
		publishRealtimeEvent(userId, "task.state_changed", {
			taskId: session.taskId,
			toState: "Active",
		});
		return created(session);
	})

	.get("/active", async ({ userId, internal_logger }) => {
		internal_logger.set("flow", "sessions_active");
		const session = await sessionService.getActiveSession(
			userId,
			internal_logger,
		);
		if (!session) {
			internal_logger.set("result", { has_active_session: false });
			return;
		}
		internal_logger.set("result", {
			has_active_session: true,
			session_id: session.id,
			state: session.state,
		});
		return success(session);
	})

	.get("/:id", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "sessions_get_by_id");
		internal_logger.set("session_ref", {
			session_id: params.id,
			user_id: userId,
		});
		const session = await sessionService.getSessionById(
			userId,
			params.id,
			internal_logger,
		);
		internal_logger.set("result", {
			session_id: session.id,
			state: session.state,
		});
		return success(session);
	})

	.patch("/:id/pause", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "sessions_pause");
		internal_logger.set("session_ref", {
			session_id: params.id,
			user_id: userId,
		});
		const result = await sessionService.pauseSession(
			userId,
			params.id,
			internal_logger,
		);
		internal_logger.set("result", {
			session_id: result.id,
			state: result.state,
		});
		publishRealtimeEvent(userId, "session.paused", {
			sessionId: params.id,
		});
		return success(result);
	})

	.patch("/:id/resume", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "sessions_resume");
		internal_logger.set("session_ref", {
			session_id: params.id,
			user_id: userId,
		});
		const result = await sessionService.resumeSession(
			userId,
			params.id,
			internal_logger,
		);
		internal_logger.set("result", {
			session_id: result.id,
			state: result.state,
		});
		publishRealtimeEvent(userId, "session.resumed", {
			sessionId: params.id,
		});
		return success(result);
	})

	.patch("/:id/extend", async ({ params, body, userId, internal_logger }) => {
		internal_logger.set("flow", "sessions_extend");
		const parsed = ExtendSessionSchema.safeParse(body ?? {});
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("session_extend_input", {
			session_id: params.id,
			user_id: userId,
			minutes: parsed.data.minutes,
		});

		const result = await sessionService.extendSession(
			userId,
			params.id,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", {
			session_id: result.id,
			state: result.state,
			duration: result.duration,
		});
		publishRealtimeEvent(userId, "session.extended", {
			sessionId: params.id,
			minutes: parsed.data.minutes,
		});
		return success(result);
	})

	.post("/:id/complete", async ({ params, body, userId, internal_logger }) => {
		internal_logger.set("flow", "sessions_complete");
		const parsed = CompleteSessionSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("session_complete_input", {
			session_id: params.id,
			user_id: userId,
			outcome: parsed.data.outcome,
			has_notes: Boolean(parsed.data.notes),
			has_blocker_note: Boolean(parsed.data.blockerNote),
		});

		const result = await sessionService.completeSession(
			userId,
			params.id,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", {
			session_id: params.id,
			task_id: result.task.id,
			task_state: result.task.state,
		});
		publishRealtimeEvent(userId, "session.completed", {
			sessionId: params.id,
			taskId: result.task.id,
			outcome: parsed.data.outcome,
		});
		publishRealtimeEvent(userId, "task.state_changed", {
			taskId: result.task.id,
			toState: result.task.state,
		});
		return success(result);
	})

	.patch(
		"/:id/scratchpad",
		async ({ params, body, userId, internal_logger }) => {
			internal_logger.set("flow", "sessions_scratchpad_update");
			const parsed = ScratchpadUpdateSchema.safeParse(body);
			if (!parsed.success) {
				throw new ValidationError(parsed.error.flatten().fieldErrors);
			}
			internal_logger.set("scratchpad", {
				session_id: params.id,
				user_id: userId,
				content_length: parsed.data.content.length,
			});

			const result = await sessionService.updateScratchpad(
				userId,
				params.id,
				parsed.data.content,
				internal_logger,
			);
			internal_logger.set("result", { session_id: result.id, updated: true });
			publishRealtimeEvent(userId, "session.scratchpad_updated", {
				sessionId: params.id,
			});
			return success(result);
		},
	)

	.get("/history", async ({ query, userId, internal_logger }) => {
		internal_logger.set("flow", "sessions_history");
		const parsed = SessionHistoryQuerySchema.safeParse(query);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("query", parsed.data);

		const { sessions, total } = await sessionService.getSessionHistory(
			userId,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", { total, returned: sessions.length });
		return paginated(sessions, total, parsed.data.page, parsed.data.limit);
	});
