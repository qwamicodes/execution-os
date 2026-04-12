import { randomBytes } from "node:crypto";

import { env } from "../../config";
import { getBrrrWebhookUrl, sendBrrrNotification } from "../../shared/brrr";
import { sendEmail } from "../../shared/email";
import { magicLinkTemplate } from "../../shared/email-templates";
import { RateLimitError } from "../../shared/errors";
import { redis } from "../../shared/redis";
import type { RequestLogger } from "../../shared/wide-event";
import { createSession, findOrCreateUser } from "./auth.service";

const MAGIC_LINK_TTL = 15 * 60; // 15 minutes
const MAGIC_LINK_RATE_LIMIT_TTL = 15 * 60; // 15 minutes
const MAGIC_LINK_RATE_LIMIT_MAX = 3;

function generateToken(): string {
	return randomBytes(32).toString("hex"); // 64-char hex token
}

export async function requestMagicLink(
	email: string,
	logger?: RequestLogger,
): Promise<void> {
	logger?.set("magic_link_service", {
		operation: "request",
		email_domain: email.split("@")[1] ?? null,
	});
	// Rate limit check
	const rateKey = `magic_rate:${email}`;
	const rateCount = await redis.incr(rateKey);

	if (rateCount === 1) {
		await redis.expire(rateKey, MAGIC_LINK_RATE_LIMIT_TTL);
	}

	if (rateCount > MAGIC_LINK_RATE_LIMIT_MAX) {
		const ttl = await redis.ttl(rateKey);
		throw new RateLimitError(ttl);
	}

	const token = generateToken();

	// Store token in Redis
	const tokenKey = `magic:${token}`;
	await redis.setex(tokenKey, MAGIC_LINK_TTL, JSON.stringify({ email }));

	// Build magic link URL
	const authAppUrl = env.AUTH_APP_URL;
	const url = `${authAppUrl}/magic-link/verify?token=${token}`;

	// If brrr webhook is configured, prefer that for magic-link delivery.
	// Otherwise fallback to email. Always swallow failures to avoid leaking identity.
	try {
		if (getBrrrWebhookUrl()) {
			await sendBrrrNotification({
				title: "Execution OS magic link",
				message: "Tap to sign in with your one-time magic link.",
				threadId: "auth-magic-link",
				openUrl: url,
				interruptionLevel: "active",
			});
			logger?.set("magic_link_delivery", {
				channel: "brrr",
				delivered: true,
			});
		} else {
			const template = magicLinkTemplate(url);
			await sendEmail({
				to: email,
				subject: template.subject,
				body: template.body,
			});
			logger?.set("magic_link_delivery", {
				channel: "email",
				delivered: true,
			});
		}
	} catch {
		// Intentionally swallowed — wide event will show outcome: "success"
		// from the user's perspective (no information leaked)
		logger?.set("magic_link_delivery", {
			channel: getBrrrWebhookUrl() ? "brrr" : "email",
			delivered: false,
		});
	}
}

export async function verifyMagicLink(
	token: string,
	logger?: RequestLogger,
): Promise<{
	user: { id: string; email: string; name: string; timezone: string };
	sessionId: string;
	expiresAt: string;
}> {
	// Token is sensitive; only log shape/length.
	logger?.set("magic_link_service", {
		operation: "verify",
		token_length: token.length,
	});
	const tokenKey = `magic:${token}`;
	const stored = await redis.get(tokenKey);

	if (!stored) throw new Error("Invalid or expired link");

	const { email } = JSON.parse(stored) as { email: string };

	// Single-use — delete immediately
	await redis.del(tokenKey);

	const user = await findOrCreateUser(email, logger);
	const session = await createSession(user.id, false, logger);
	logger?.set("magic_link_service_result", {
		operation: "verify",
		user_id: user.id,
	});

	return { user, sessionId: session.sessionId, expiresAt: session.expiresAt };
}
