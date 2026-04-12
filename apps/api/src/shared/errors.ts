export class AppError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly statusCode: number,
		public readonly details?: Record<string, unknown>,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class ValidationError extends AppError {
	constructor(details: Record<string, unknown>) {
		super("VALIDATION_ERROR", "Request validation failed", 400, details);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = "Authentication required") {
		super("UNAUTHORIZED", message, 401);
	}
}

export class ForbiddenError extends AppError {
	constructor(message = "You do not have permission to access this resource") {
		super("FORBIDDEN", message, 403);
	}
}

export class NotFoundError extends AppError {
	constructor(resource: string) {
		super("NOT_FOUND", `${resource} not found`, 404);
	}
}

export class ConflictError extends AppError {
	constructor(message: string, details?: Record<string, unknown>) {
		super("CONFLICT", message, 409, details);
	}
}

export class UnprocessableError extends AppError {
	constructor(message: string) {
		super("UNPROCESSABLE_ENTITY", message, 422);
	}
}

export class RateLimitError extends AppError {
	constructor(retryAfter: number) {
		super(
			"RATE_LIMIT_EXCEEDED",
			"Too many requests, please try again later",
			429,
			{
				retryAfter,
			},
		);
	}
}

export class ServiceUnavailableError extends AppError {
	constructor(
		message = "Service temporarily unavailable",
		details?: Record<string, unknown>,
	) {
		super("SERVICE_UNAVAILABLE", message, 503, details);
	}
}
