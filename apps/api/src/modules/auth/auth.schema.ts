import { z } from "zod";

export const RegisterSchema = z.object({
	email: z.string().email("Invalid email format"),
	password: z
		.string()
		.min(12, "Password must be at least 12 characters")
		.regex(/[A-Z]/, "Password must contain uppercase letter")
		.regex(/[a-z]/, "Password must contain lowercase letter")
		.regex(/[0-9]/, "Password must contain number")
		.regex(/[^A-Za-z0-9]/, "Password must contain special character"),
	name: z.string().min(1, "Name is required").max(100),
	timezone: z.string().optional().default("UTC"),
});

export const LoginSchema = z.object({
	email: z.string().email(),
	password: z.string(),
	rememberMe: z.boolean().optional().default(false),
});

export const OtpRequestSchema = z.object({
	email: z.string().email("Invalid email format"),
});

export const OtpVerifySchema = z.object({
	email: z.string().email("Invalid email format"),
	code: z.string().length(6, "Code must be 6 digits"),
});

export const MagicLinkRequestSchema = z.object({
	email: z.string().email("Invalid email format"),
});

export const MagicLinkVerifySchema = z.object({
	token: z.string().min(1, "Token is required"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type OtpRequestInput = z.infer<typeof OtpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof OtpVerifySchema>;
export type MagicLinkRequestInput = z.infer<typeof MagicLinkRequestSchema>;
export type MagicLinkVerifyInput = z.infer<typeof MagicLinkVerifySchema>;
