import { randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { prisma } from "../../shared/database";
import { ConflictError, UnauthorizedError } from "../../shared/errors";
import { redis } from "../../shared/redis";
import type { LoginInput, RegisterInput } from "./auth.schema";

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days
const REMEMBER_ME_TTL = 30 * 24 * 60 * 60; // 30 days

function generateSessionId(): string {
	return randomBytes(32).toString("hex");
}

export async function register(input: RegisterInput) {
	const existing = await prisma.user.findUnique({
		where: { email: input.email },
	});

	if (existing) {
		throw new ConflictError("Email already registered");
	}

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

	const sessionId = generateSessionId();
	const ttl = SESSION_TTL;
	const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

	await redis.setex(
		`session:${sessionId}`,
		ttl,
		JSON.stringify({
			userId: user.id,
			createdAt: new Date().toISOString(),
			expiresAt,
		}),
	);

	// Track session for logout-all
	await redis.sadd(`user_sessions:${user.id}`, sessionId);

	return { user, sessionId, expiresAt };
}

export async function login(input: LoginInput) {
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

	if (!user) {
		throw new UnauthorizedError("Invalid credentials");
	}

	const validPassword = await argon2.verify(user.password, input.password);

	if (!validPassword) {
		throw new UnauthorizedError("Invalid credentials");
	}

	const sessionId = generateSessionId();
	const ttl = input.rememberMe ? REMEMBER_ME_TTL : SESSION_TTL;
	const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

	await redis.setex(
		`session:${sessionId}`,
		ttl,
		JSON.stringify({
			userId: user.id,
			createdAt: new Date().toISOString(),
			expiresAt,
		}),
	);

	await redis.sadd(`user_sessions:${user.id}`, sessionId);

	const { password: _, ...userWithoutPassword } = user;

	return { user: userWithoutPassword, sessionId, expiresAt };
}

export async function logout(sessionId: string, userId: string) {
	await redis.del(`session:${sessionId}`);
	await redis.srem(`user_sessions:${userId}`, sessionId);
}

export async function logoutAll(userId: string) {
	const sessions = await redis.smembers(`user_sessions:${userId}`);

	if (sessions.length > 0) {
		const pipeline = redis.pipeline();
		for (const sid of sessions) {
			pipeline.del(`session:${sid}`);
		}
		pipeline.del(`user_sessions:${userId}`);
		await pipeline.exec();
	}

	return sessions.length;
}

export async function getMe(userId: string) {
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

	return user;
}
