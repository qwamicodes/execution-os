import { randomUUID } from "node:crypto";
import Elysia from "elysia";
import { env } from "../config";
import { logger } from "../shared/logger";
import { createRequestLogger } from "../shared/wide-event";

export const requestLogger = new Elysia({ name: "canonical-request-logger" })
	.derive({ as: "global" }, ({ request, headers }) => {
		const requestId =
			(headers["x-request-id"] as string | undefined) || randomUUID();
		const internal_logger = createRequestLogger({
			requestId,
			method: request.method,
			path: new URL(request.url).pathname,
			userAgent: headers["user-agent"],
			startedAt: performance.now(),
			slowRequestThresholdMs: env.LOG_SLOW_REQUEST_THRESHOLD_MS,
			successSampleRate: env.LOG_SUCCESS_SAMPLE_RATE,
		});

		return {
			requestId,
			internal_logger,
		};
	})
	.onAfterResponse({ as: "global" }, ({ internal_logger, set }) => {
		const statusCode = typeof set.status === "number" ? set.status : 200;
		const canonicalLog = internal_logger?._emit(statusCode);
		if (!canonicalLog) return;

		if (statusCode >= 400) {
			logger.error(canonicalLog);
			return;
		}

		logger.info(canonicalLog);
	})
	.onError({ as: "global" }, (context) => {
		const { error } = context;
		const internal_logger =
			(context as unknown as { internal_logger?: ReturnType<typeof createRequestLogger> })
				.internal_logger;

		internal_logger?.capture(error);
		// canonical line is emitted once in onAfterResponse
	});
