import Elysia from "elysia";
import { UnauthorizedError } from "../shared/errors";
import { redis } from "../shared/redis";
import type { RequestLogger } from "../shared/wide-event";
import { basePlugin } from "../plugins/base";

interface SessionData {
	userId: string;
	createdAt: string;
	expiresAt: string;
}

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

export const authMiddleware = new Elysia({ name: "auth" })
	.use(basePlugin)
	.derive({ as: "scoped" }, async ({ cookie, internal_logger }) => {
		const sessionId = cookie.sessionId?.value;

		if (!sessionId) {
			throw new UnauthorizedError("No session cookie");
		}

		const sessionData = await redis.get(`session:${sessionId}`);

		if (!sessionData) {
			throw new UnauthorizedError("Invalid or expired session");
		}

		const session: SessionData = JSON.parse(sessionData);

		if (new Date(session.expiresAt) < new Date()) {
			await redis.del(`session:${sessionId}`);
			throw new UnauthorizedError("Session expired");
		}

		// Sliding expiration - refresh TTL on each request
		await redis.expire(`session:${sessionId}`, SESSION_TTL);

		internal_logger.set("auth", {
			user_id: session.userId,
			session_ttl_min: SESSION_TTL / 60,
		});

		return { userId: session.userId };
	});
