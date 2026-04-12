import Elysia from "elysia";

import { authMiddleware } from "../../middleware/auth";
import { basePlugin } from "../../plugins/base";
import { created, success } from "../../shared/response";
import {
	LoginSchema,
	MagicLinkRequestSchema,
	MagicLinkVerifySchema,
	OtpRequestSchema,
	OtpVerifySchema,
	RegisterSchema,
} from "./auth.schema";
import * as authService from "./auth.service";
import * as magicLinkService from "./magic-link.service";
import * as otpService from "./otp.service";

const SESSION_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "strict" as const,
	path: "/",
};

export const authController = new Elysia({ prefix: "/auth" })
	.use(basePlugin)
	.post(
		"/register",
		async ({ body, cookie, set, internal_logger }) => {
			internal_logger.set("flow", "auth_register");

			internal_logger.set("auth", {
				action: "register",
				email_domain: body.email.split("@")[1] ?? null,
			});

			const result = await authService.register(body, internal_logger);
			internal_logger.set("result", {
				user_id: result.user.id,
				session_created: true,
			});

			cookie.sessionId?.set({
				...SESSION_COOKIE_OPTIONS,
				value: result.sessionId,
				maxAge: 7 * 24 * 60 * 60,
			});

			set.status = 201;
			return created({ user: result.user, sessionId: result.sessionId });
		},
		{ body: RegisterSchema },
	)

	.post(
		"/login",
		async ({ body, cookie, internal_logger }) => {
			internal_logger.set("flow", "auth_login");

			internal_logger.set("auth", {
				action: "login",
				email_domain: body.email.split("@")[1] ?? null,
				remember_me: Boolean(body.rememberMe),
			});

			const result = await authService.login(body, internal_logger);
			internal_logger.set("result", {
				user_id: result.user.id,
				session_created: true,
			});

			const maxAge = body.rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;

			cookie.sessionId?.set({
				...SESSION_COOKIE_OPTIONS,
				value: result.sessionId,
				maxAge,
			});

			return success({
				user: result.user,
				sessionId: result.sessionId,
				expiresAt: result.expiresAt,
			});
		},
		{ body: LoginSchema },
	)

	// ─── OTP Routes ────────────────────────────────────────────────────────────

	.post(
		"/otp/request",
		async ({ body, internal_logger }) => {
			internal_logger.set("flow", "auth_otp_request");

			internal_logger.set("auth", {
				action: "otp_request",
				email_domain: body.email.split("@")[1] ?? null,
			});

			await otpService.requestOtp(body.email, internal_logger);
			internal_logger.set("result", { delivery_attempted: true });

			// Always return 200 — don't leak whether email exists
			return success({ message: "If an account exists, a code has been sent" });
		},
		{ body: OtpRequestSchema },
	)

	.post(
		"/otp/verify",
		async ({ body, cookie, internal_logger }) => {
			internal_logger.set("flow", "auth_otp_verify");

			internal_logger.set("auth", {
				action: "otp_verify",
				email_domain: body.email.split("@")[1] ?? null,
				code_length: body.code.length,
			});

			const result = await otpService.verifyOtp(
				body.email,
				body.code,
				internal_logger,
			);
			internal_logger.set("result", {
				user_id: result.user.id,
				session_created: true,
			});

			cookie.sessionId?.set({
				...SESSION_COOKIE_OPTIONS,
				value: result.sessionId,
				maxAge: 7 * 24 * 60 * 60,
			});

			return success({
				user: result.user,
				sessionId: result.sessionId,
				expiresAt: result.expiresAt,
			});
		},
		{ body: OtpVerifySchema },
	)

	// ─── Magic Link Routes ─────────────────────────────────────────────────────

	.post(
		"/magic-link/request",
		async ({ body, internal_logger }) => {
			internal_logger.set("flow", "auth_magic_link_request");

			internal_logger.set("auth", {
				action: "magic_link_request",
				email_domain: body.email.split("@")[1] ?? null,
			});

			await magicLinkService.requestMagicLink(body.email, internal_logger);
			internal_logger.set("result", { delivery_attempted: true });

			// Always return 200 — don't leak whether email exists
			return success({ message: "If an account exists, a link has been sent" });
		},
		{ body: MagicLinkRequestSchema },
	)

	.post(
		"/magic-link/verify",
		async ({ body, cookie, internal_logger }) => {
			internal_logger.set("flow", "auth_magic_link_verify");
			internal_logger.set("auth", {
				action: "magic_link_verify",
				token_length: body.token.length,
			});

			const result = await magicLinkService.verifyMagicLink(
				body.token,
				internal_logger,
			);
			internal_logger.set("result", {
				user_id: result.user.id,
				session_created: true,
			});

			cookie.sessionId?.set({
				...SESSION_COOKIE_OPTIONS,
				value: result.sessionId,
				maxAge: 7 * 24 * 60 * 60,
			});

			return success({
				user: result.user,
				sessionId: result.sessionId,
				expiresAt: result.expiresAt,
			});
		},
		{ body: MagicLinkVerifySchema },
	)

	// ─── Protected Routes ──────────────────────────────────────────────────────

	.use(authMiddleware)

	.post("/logout", async ({ cookie, userId, internal_logger }) => {
		internal_logger.set("flow", "auth_logout");
		const sessionId = cookie.sessionId?.value;
		if (typeof sessionId === "string" && typeof userId === "string") {
			internal_logger.set("auth", {
				action: "logout",
				user_id: userId,
				has_session_cookie: true,
			});
			await authService.logout(sessionId, userId, internal_logger);
		}

		cookie.sessionId?.set({
			...SESSION_COOKIE_OPTIONS,
			value: "",
			maxAge: 0,
		});

		return success({ message: "Logged out successfully" });
	})

	.post("/logout-all", async ({ userId, internal_logger }) => {
		internal_logger.set("flow", "auth_logout_all");
		internal_logger.set("auth", { action: "logout_all", user_id: userId });
		const count = await authService.logoutAll(userId, internal_logger);
		internal_logger.set("result", { sessions_invalidated: count });
		return success({
			message: "Logged out from all devices",
			sessionsInvalidated: count,
		});
	})

	.get("/me", async ({ userId, internal_logger }) => {
		internal_logger.set("flow", "auth_me");
		internal_logger.set("auth", { action: "me", user_id: userId });
		const user = await authService.getMe(userId, internal_logger);
		internal_logger.set("result", { user_id: user?.id ?? null });
		return success(user);
	});
