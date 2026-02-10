import { randomUUID } from "node:crypto";

export interface SuccessResponse<T> {
	data: T;
	meta?: {
		timestamp: string;
		requestId: string;
	};
}

export interface PaginatedResponse<T> {
	data: T[];
	meta: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
	};
}

export interface ErrorResponse {
	error: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
		requestId: string;
	};
}

export function success<T>(data: T): SuccessResponse<T> {
	return {
		data,
		meta: {
			timestamp: new Date().toISOString(),
			requestId: randomUUID(),
		},
	};
}

export function created<T>(data: T): SuccessResponse<T> {
	return success(data);
}

export function paginated<T>(
	data: T[],
	total: number,
	page: number,
	limit: number,
): PaginatedResponse<T> {
	const totalPages = Math.ceil(total / limit);
	return {
		data,
		meta: {
			page,
			limit,
			total,
			totalPages,
			hasNext: page < totalPages,
			hasPrev: page > 1,
		},
	};
}

export function error(
	code: string,
	message: string,
	details?: Record<string, unknown>,
): ErrorResponse {
	return {
		error: {
			code,
			message,
			details,
			requestId: randomUUID(),
		},
	};
}
