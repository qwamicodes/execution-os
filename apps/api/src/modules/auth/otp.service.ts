import { randomInt, timingSafeEqual } from "node:crypto";
import { getBrrrWebhookUrl, sendBrrrNotification } from "../../shared/brrr";
import { sendEmail } from "../../shared/email";
import { otpTemplate } from "../../shared/email-templates";
import { RateLimitError } from "../../shared/errors";
import { redis } from "../../shared/redis";
import type { RequestLogger } from "../../shared/wide-event";
import { createSession, findOrCreateUser } from "./auth.service";
import { log } from "node:console";

const OTP_TTL = 5 * 60; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_RATE_LIMIT_TTL = 15 * 60; // 15 minutes
const OTP_RATE_LIMIT_MAX = 5;

function generateOtp(): string {
	return String(randomInt(100000, 999999));
}

export async function requestOtp(
	email: string,
	logger?: RequestLogger,
): Promise<void> {
	logger?.set("otp_service", {
		operation: "request",
		email_domain: email.split("@")[1] ?? null,
	});
	// Rate limit check
	const rateKey = `otp_rate:${email}`;
	const rateCount = await redis.incr(rateKey);

	if (rateCount === 1) {
		await redis.expire(rateKey, OTP_RATE_LIMIT_TTL);
	}

	if (rateCount > OTP_RATE_LIMIT_MAX) {
		const ttl = await redis.ttl(rateKey);
		throw new RateLimitError(ttl);
	}

	const code = generateOtp();

	// Store OTP in Redis
	const otpKey = `otp:${email}`;
	await redis
		.setex(otpKey, OTP_TTL, JSON.stringify({ code, attempts: 0 }))
		.then(() => {
			logger?.set("otp_store", { success: true });
		})
		.catch((err) => {
			logger?.set("otp_store", { success: false, error: err });
		});

	// Send email (don't leak user existence — always send)
	// If brrr webhook is configured, prefer that for OTP delivery.
	// Otherwise fallback to email. Always swallow failures to avoid leaking identity.
	if (getBrrrWebhookUrl()) {
		await sendBrrrNotification({
			title: "Execution OS OTP",
			message: `Your OTP is ${code}. Expires in 5 minutes.`,
			threadId: "auth-otp",
			interruptionLevel: "time-sensitive",
		}, logger)
			.then(() => {
				logger?.set("otp_delivery", {
					channel: "brrr",
					delivered: true,
				});
			})
			.catch((err) => {
				logger?.set("otp_delivery", {
					channel: "brrr",
					delivered: false,
					error: err,
				});
			});
	} else {
		const template = otpTemplate(code);
		await sendEmail({
			to: email,
			subject: template.subject,
			body: template.body,
		})
			.then(() => {
				logger?.set("otp_delivery", {
					channel: "email",
					delivered: true,
				});
			})
			.catch((err) => {
				logger?.set("otp_delivery", {
					channel: "email",
					delivered: false,
					error: err,
				});
			});
	}
}

export async function verifyOtp(
	email: string,
	code: string,
	logger?: RequestLogger,
): Promise<{
	user: { id: string; email: string; name: string; timezone: string };
	sessionId: string;
	expiresAt: string;
}> {
	const otpKey = `otp:${email}`;
	logger?.set("otp_service", {
		operation: "verify",
		email_domain: email.split("@")[1] ?? null,
		code_length: code.length,
	});
	const stored = await redis.get(otpKey);

	if (!stored) {
		throw new Error("Invalid or expired code");
	}

	const otpData = JSON.parse(stored) as { code: string; attempts: number };

	// Increment attempts
	otpData.attempts += 1;

	if (otpData.attempts >= OTP_MAX_ATTEMPTS) {
		await redis.del(otpKey);
		throw new Error("Too many attempts. Please request a new code.");
	}

	// Update attempts count in Redis
	const ttl = await redis.ttl(otpKey);
	if (ttl > 0) {
		await redis.setex(otpKey, ttl, JSON.stringify(otpData));
	}

	// Constant-time comparison
	const codeBuffer = Buffer.from(code.padEnd(6));
	const storedBuffer = Buffer.from(otpData.code.padEnd(6));

	if (!timingSafeEqual(codeBuffer, storedBuffer)) {
		throw new Error("Invalid or expired code");
	}

	// OTP valid — delete and create session
	await redis.del(otpKey);

	const user = await findOrCreateUser(email, logger);
	const session = await createSession(user.id, false, logger);
	logger?.set("otp_service_result", {
		operation: "verify",
		user_id: user.id,
	});

	return { user, sessionId: session.sessionId, expiresAt: session.expiresAt };
}
