const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8901";

interface ApiError {
	error: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
	};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
		...options,
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
	});

	const json = await response.json();

	if (!response.ok) {
		const error = json as ApiError;
		throw new Error(error.error?.message || "Something went wrong");
	}

	return json.data as T;
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	timezone: string;
	createdAt?: string;
	preferences?: Record<string, unknown>;
}

export interface AuthResponse {
	user: AuthUser;
	sessionId: string;
	expiresAt?: string;
}

export interface MessageResponse {
	message: string;
}

// ─── API Functions ─────────────────────────────────────────────────────────

export function register(data: {
	email: string;
	password: string;
	name: string;
	timezone?: string;
}): Promise<AuthResponse> {
	return request<AuthResponse>("/auth/register", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export function login(data: {
	email: string;
	password: string;
	rememberMe?: boolean;
}): Promise<AuthResponse> {
	return request<AuthResponse>("/auth/login", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export function requestOtp(email: string): Promise<MessageResponse> {
	return request<MessageResponse>("/auth/otp/request", {
		method: "POST",
		body: JSON.stringify({ email }),
	});
}

export function verifyOtp(email: string, code: string): Promise<AuthResponse> {
	return request<AuthResponse>("/auth/otp/verify", {
		method: "POST",
		body: JSON.stringify({ email, code }),
	});
}

export function requestMagicLink(email: string): Promise<MessageResponse> {
	return request<MessageResponse>("/auth/magic-link/request", {
		method: "POST",
		body: JSON.stringify({ email }),
	});
}

export function verifyMagicLink(token: string): Promise<AuthResponse> {
	return request<AuthResponse>("/auth/magic-link/verify", {
		method: "POST",
		body: JSON.stringify({ token }),
	});
}

export function getMe(): Promise<AuthUser> {
	return request<AuthUser>("/auth/me");
}

export function logout(): Promise<MessageResponse> {
	return request<MessageResponse>("/auth/logout", {
		method: "POST",
	});
}
