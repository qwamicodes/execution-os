import Elysia from "elysia";
import { AppError } from "../shared/errors";
import { error as errorResponse } from "../shared/response";
import type { RequestLogger } from "../shared/wide-event";

function toDetailString(details: unknown) {
	if (!details) return undefined;
	if (typeof details === "string") return details;
	if (details instanceof Error) return details.message;
	try {
		return JSON.stringify(details);
	} catch {
		return String(details);
	}
}

function suggestionFor(statusCode: string) {
	switch (statusCode) {
		case "VALIDATION_ERROR":
			return "Check the request payload and try again.";
		case "UNAUTHORIZED":
			return "Sign in and retry this request.";
		case "FORBIDDEN":
			return "You do not have permission for this action.";
		case "NOT_FOUND":
			return "Confirm the resource exists, then retry.";
		case "CONFLICT":
			return "Resolve the conflict and try again.";
		case "UNPROCESSABLE_ENTITY":
			return "Review the input values and submit again.";
		case "RATE_LIMIT_EXCEEDED":
			return "Wait a moment, then retry.";
		case "SERVICE_UNAVAILABLE":
			return "The service is temporarily unavailable. Retry shortly.";
		case "INTERNAL_SERVER_ERROR":
			return "Retry. If it continues, contact support with the request ID.";
		default:
			return "Review the request and try again.";
	}
}

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
			return errorResponse(
				error.code,
				error.message,
				toDetailString(error.details),
				suggestionFor(error.code),
				requestId,
			);
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
					error.message,
					suggestionFor("VALIDATION_ERROR"),
					requestId,
				);
			}

			internal_logger?.set("error", {
				code: "INTERNAL_SERVER_ERROR",
				type: "unhandled",
				message: error.message,
			});
			set.status = 500;
			return errorResponse(
				"INTERNAL_SERVER_ERROR",
				"An unexpected error occurred",
				error.message,
				suggestionFor("INTERNAL_SERVER_ERROR"),
				requestId,
			);
		}

		set.status = 500;
		return errorResponse(
			"INTERNAL_SERVER_ERROR",
			"An unexpected error occurred",
			undefined,
			suggestionFor("INTERNAL_SERVER_ERROR"),
			requestId,
		);
	},
);
