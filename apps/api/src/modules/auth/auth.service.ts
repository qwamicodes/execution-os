import { randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { prisma } from "../../shared/database";
import { ConflictError, UnauthorizedError } from "../../shared/errors";
import { redis } from "../../shared/redis";
import type { RequestLogger } from "../../shared/wide-event";
import type { LoginInput, RegisterInput } from "./auth.schema";

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days
const REMEMBER_ME_TTL = 30 * 24 * 60 * 60; // 30 days

function generateSessionId(): string {
	return randomBytes(32).toString("hex");
}

// ─── Shared Helpers ──────────────────────────────────────────────────────────

export async function createSession(
	userId: string,
	rememberMe = false,
	logger?: RequestLogger,
): Promise<{ sessionId: string; expiresAt: string }> {
	logger?.set("auth_service", { operation: "create_session", user_id: userId });
	const sessionId = generateSessionId();
	const ttl = rememberMe ? REMEMBER_ME_TTL : SESSION_TTL;
	const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

	await redis.setex(
		`session:${sessionId}`,
		ttl,
		JSON.stringify({
			userId,
			createdAt: new Date().toISOString(),
			expiresAt,
		}),
	);

	// Track session for logout-all
	await redis.sadd(`user_sessions:${userId}`, sessionId);
	logger?.set("auth_service_result", {
		operation: "create_session",
		session_id: sessionId,
		ttl_seconds: ttl,
	});

	return { sessionId, expiresAt };
}

export async function findOrCreateUser(
	email: string,
	logger?: RequestLogger,
): Promise<{ id: string; email: string; name: string; timezone: string }> {
	logger?.set("auth_service", {
		operation: "find_or_create_user",
		email_domain: email.split("@")[1] ?? null,
	});
	const existing = await prisma.user.findUnique({
		where: { email, deletedAt: null },
		select: { id: true, email: true, name: true, timezone: true },
	});

	if (existing) {
		logger?.set("auth_service_result", {
			operation: "find_or_create_user",
			user_id: existing.id,
			created: false,
		});
		return existing;
	}

	// Auto-generate name from email (part before @)
	const name = email.split("@")[0] ?? email;

	const user = await prisma.user.create({
		data: {
			email,
			name,
			timezone: "UTC",
		},
		select: { id: true, email: true, name: true, timezone: true },
	});
	logger?.set("auth_service_result", {
		operation: "find_or_create_user",
		user_id: user.id,
		created: true,
	});

	return user;
}

// ─── Auth Functions ──────────────────────────────────────────────────────────

export async function register(input: RegisterInput, logger?: RequestLogger) {
	logger?.set("auth_service", { operation: "register" });
	const existing = await prisma.user.findUnique({
		where: { email: input.email },
	});

	if (existing) throw new ConflictError("Email already registered");

	const hashedPassword = await argon2.hash(input.password);

	const user = await prisma.user.create({
		data: {
			email: input.email,
			password: hashedPassword,
			name: input.name,
			timezone: input.timezone ?? "UTC",
		},
		select: {
			id: true,
			email: true,
			name: true,
			timezone: true,
			createdAt: true,
		},
	});

	const session = await createSession(user.id, false, logger);
	logger?.set("auth_service_result", {
		operation: "register",
		user_id: user.id,
	});

	return { user, sessionId: session.sessionId, expiresAt: session.expiresAt };
}

export async function login(input: LoginInput, logger?: RequestLogger) {
	logger?.set("auth_service", {
		operation: "login",
		remember_me: Boolean(input.rememberMe),
	});
	const user = await prisma.user.findUnique({
		where: { email: input.email, deletedAt: null },
		select: {
			id: true,
			email: true,
			name: true,
			timezone: true,
			password: true,
		},
	});

	if (!user) throw new UnauthorizedError("Invalid credentials");

	// Guard: users without a password (OTP/magic-link only) can't use password login
	if (!user.password) throw new UnauthorizedError("Invalid credentials");

	const validPassword = await argon2.verify(user.password, input.password);

	if (!validPassword) throw new UnauthorizedError("Invalid credentials");

	const session = await createSession(user.id, input.rememberMe, logger);

	const { password: _, ...userWithoutPassword } = user;

	return {
		user: userWithoutPassword,
		sessionId: session.sessionId,
		expiresAt: session.expiresAt,
	};
}

export async function logout(
	sessionId: string,
	userId: string,
	logger?: RequestLogger,
) {
	logger?.set("auth_service", { operation: "logout", user_id: userId });
	await redis.del(`session:${sessionId}`);
	await redis.srem(`user_sessions:${userId}`, sessionId);
}

export async function logoutAll(userId: string, logger?: RequestLogger) {
	logger?.set("auth_service", { operation: "logout_all", user_id: userId });
	const sessions = await redis.smembers(`user_sessions:${userId}`);

	if (sessions.length > 0) {
		const pipeline = redis.pipeline();
		for (const sid of sessions) {
			pipeline.del(`session:${sid}`);
		}
		pipeline.del(`user_sessions:${userId}`);
		await pipeline.exec();
	}
	logger?.set("auth_service_result", {
		operation: "logout_all",
		sessions_invalidated: sessions.length,
	});

	return sessions.length;
}

export async function getMe(userId: string, logger?: RequestLogger) {
	logger?.set("auth_service", { operation: "get_me", user_id: userId });
	const user = await prisma.user.findUnique({
		where: { id: userId, deletedAt: null },
		select: {
			id: true,
			email: true,
			name: true,
			timezone: true,
			preferences: true,
			createdAt: true,
		},
	});
	logger?.set("auth_service_result", {
		operation: "get_me",
		found: Boolean(user),
	});

	return user;
}
