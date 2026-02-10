import Elysia from "elysia";
import { AppError } from "../shared/errors";
import { logger } from "../shared/logger";
import { error as errorResponse } from "../shared/response";

export const errorMiddleware = new Elysia({ name: "error-handler" }).onError(
	{ as: "global" },
	({ error, set }) => {
		if (error instanceof AppError) {
			set.status = error.statusCode;
			return errorResponse(error.code, error.message, error.details);
		}

		if (error instanceof Error) {
			// Elysia validation errors
			if (
				error.name === "ValidationError" ||
				("code" in error &&
					(error as Record<string, unknown>).code === "VALIDATION")
			) {
				set.status = 400;
				return errorResponse("VALIDATION_ERROR", "Request validation failed", {
					message: error.message,
				});
			}

			// Unknown errors
			logger.error("Unhandled error", "error-middleware", {
				name: error.name,
				message: error.message,
				stack: error.stack,
			});
		}

		set.status = 500;
		return errorResponse("INTERNAL_ERROR", "An unexpected error occurred");
	},
);
