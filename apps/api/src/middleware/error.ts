import Elysia from "elysia";
import { AppError } from "../shared/errors";
import { error as errorResponse } from "../shared/response";
import type { RequestLogger } from "../shared/wide-event";

export const errorMiddleware = new Elysia({ name: "error-handler" }).onError(
	{ as: "global" },
	(context) => {
		const { error, set } = context;

		const requestId = (context as unknown as { requestId?: string }).requestId;
		const internal_logger =
			(context as unknown as { internal_logger?: RequestLogger }).internal_logger;

		if (error instanceof AppError) {
			set.status = error.statusCode;
			internal_logger?.set("error", {
				code: error.code,
				details: error.details,
				type: "app_error",
			});
			return errorResponse(error.code, error.message, error.details, requestId);
		}

		if (error instanceof Error) {
			if (
				error.name === "ValidationError" ||
				("code" in error &&
					(error as Record<string, unknown>).code === "VALIDATION")
			) {
				set.status = 400;
				internal_logger?.set("error", {
					code: "VALIDATION_ERROR",
					type: "validation",
					message: error.message,
				});

				return errorResponse(
					"VALIDATION_ERROR",
					"Request validation failed",
					{ message: error.message },
					requestId,
				);
			}

			internal_logger?.set("error", {
				code: "INTERNAL_ERROR",
				type: "unhandled",
				message: error.message,
			});
		}

		set.status = 500;
		return errorResponse(
			"INTERNAL_ERROR",
			"An unexpected error occurred",
			undefined,
			requestId,
		);
	},
);
