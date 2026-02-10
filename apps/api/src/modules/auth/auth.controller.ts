import Elysia from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { ValidationError } from "../../shared/errors";
import { created, success } from "../../shared/response";
import { LoginSchema, RegisterSchema } from "./auth.schema";
import * as authService from "./auth.service";

export const authController = new Elysia({ prefix: "/auth" })
	.post("/register", async ({ body, cookie, set }) => {
		const parsed = RegisterSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const result = await authService.register(parsed.data);

		cookie.sessionId.set({
			value: result.sessionId,
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60,
			path: "/",
		});

		set.status = 201;
		return created({ user: result.user, sessionId: result.sessionId });
	})

	.post("/login", async ({ body, cookie }) => {
		const parsed = LoginSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const result = await authService.login(parsed.data);

		const maxAge = parsed.data.rememberMe
			? 30 * 24 * 60 * 60
			: 7 * 24 * 60 * 60;

		cookie.sessionId.set({
			value: result.sessionId,
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge,
			path: "/",
		});

		return success({
			user: result.user,
			sessionId: result.sessionId,
			expiresAt: result.expiresAt,
		});
	})

	.use(authMiddleware)

	.post("/logout", async ({ cookie, userId }) => {
		const sessionId = cookie.sessionId?.value;
		if (sessionId) {
			await authService.logout(sessionId, userId);
		}

		cookie.sessionId.set({
			value: "",
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 0,
			path: "/",
		});

		return success({ message: "Logged out successfully" });
	})

	.post("/logout-all", async ({ userId }) => {
		const count = await authService.logoutAll(userId);
		return success({
			message: "Logged out from all devices",
			sessionsInvalidated: count,
		});
	})

	.get("/me", async ({ userId }) => {
		const user = await authService.getMe(userId);
		return success(user);
	});
