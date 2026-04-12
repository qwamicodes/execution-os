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
		status_code: string;
		code?: string;
		message: string;
		details?: string;
		suggestion?: string;
		requestId: string;
	};
}

export function success<T>(data: T, requestId?: string): SuccessResponse<T> {
	return {
		data,
		meta: {
			timestamp: new Date().toISOString(),
			requestId: requestId || randomUUID(),
		},
	};
}

export function created<T>(data: T, requestId?: string): SuccessResponse<T> {
	return success(data, requestId);
}

export function paginated<T>(
	data: T[],
	total: number,
	page: number,
	limit: number,
): PaginatedResponse<T> {
	const normalizedPage = limit === -1 ? 1 : page;
	const totalPages = limit === -1 ? (total > 0 ? 1 : 0) : Math.ceil(total / limit);
	return {
		data,
		meta: {
			page: normalizedPage,
			limit,
			total,
			totalPages,
			hasNext: normalizedPage < totalPages,
			hasPrev: normalizedPage > 1,
		},
	};
}

export function error(
	statusCode: string,
	message: string,
	details?: string,
	suggestion?: string,
	requestId?: string,
): ErrorResponse {
	return {
		error: {
			status_code: statusCode,
			code: statusCode,
			message,
			details,
			suggestion,
			requestId: requestId || randomUUID(),
		},
	};
}
