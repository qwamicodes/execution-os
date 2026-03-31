import Elysia from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { basePlugin } from "../../plugins/base";
import { createRealtimeStreamResponse } from "./realtime.service";

export const realtimeController = new Elysia({ prefix: "/events" })
	.use(basePlugin)
	.use(authMiddleware)
	.get("/stream", ({ userId, internal_logger }) => {
		internal_logger.set("flow", "realtime_stream_connect");
		internal_logger.set("realtime", { user_id: userId });
		internal_logger._sample();
		return createRealtimeStreamResponse(userId);
	});
