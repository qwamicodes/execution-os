import { existsSync } from "node:fs";
import { config } from "dotenv";
import z from "zod";

if (process.env.NODE_ENV !== "production" && existsSync(".env.local")) {
	config({ path: ".env.local", quiet: true });
}

export const EnvSchema = z.object({
	PORT: z.coerce.number().catch(8901),
	CORS_ORIGIN: z.preprocess(
		(value) => {
			if (Array.isArray(value)) return value;
			if (typeof value === "string") {
				return value
					.split(",")
					.map((origin) => origin.trim())
					.filter(Boolean);
			}
			return value;
		},
		z
			.array(z.string())
			.default([
				"http://localhost:8900",
				"http://localhost:8901",
				"http://localhost:8902",
				"http://localhost:8903",
			]),
	),
	REDIS_URL: z.string().default("redis://localhost:8911"),
	AUTH_APP_URL: z.string().default("http://localhost:8902"),
	PURPLE_BOX_API_KEY: z.string().optional(),
	BRRR_WEBHOOK_SECRET: z.string().optional(),
	BRRR_WEBHOOK_URL: z.string().optional(),
	BRRR_DEFAULT_SOUND: z.string().optional(),
	SESSION_SECRET: z.string().optional(),
	EMAIL_FROM: z.string().optional(),
	SERVICE_NAME: z.string().default("unknown"),
	SERVICE_VERSION: z.string().default("unknown"),
	COMMIT_SHA: z.string().default("unknown"),
	ENVIRONMENT: z.string().default("development"),
	LOG_LEVEL: z.string().default("info"),
	LOG_SLOW_REQUEST_THRESHOLD_MS: z.coerce
		.number()
		.int()
		.min(1)
		.max(120_000)
		.default(500),
	LOG_SUCCESS_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

	AI_AUTO_CLASSIFY_ON_TASK_CREATE: z.coerce.boolean().default(true),
	AI_ROUTING_MODE: z
		.enum(["round_robin", "random", "fixed"])
		.default("round_robin"),
	AI_FIXED_PROVIDER: z.enum(["anthropic", "openai", "ollama"]).optional(),
	AI_PROVIDER_ORDER: z.string().default("anthropic,openai,ollama"),
	AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(20000),
	AI_TASK_RECOMMENDATION_TTL_SECONDS: z.coerce
		.number()
		.int()
		.min(30)
		.max(3600)
		.default(300),
	AI_PRIORITY_RECALC_INTERVAL_MS: z.coerce
		.number()
		.int()
		.min(60_000)
		.max(86_400_000)
		.default(900_000),
	AI_CLASSIFICATION_RETRY_ATTEMPTS: z.coerce
		.number()
		.int()
		.min(1)
		.max(10)
		.default(3),
	AI_CLASSIFICATION_LOW_CONFIDENCE_THRESHOLD: z.coerce
		.number()
		.min(0)
		.max(1)
		.default(0.8),

	ANTHROPIC_API_KEY: z.string().optional(),
	ANTHROPIC_MODEL: z.string().default("claude-3-5-sonnet-latest"),
	ANTHROPIC_BASE_URL: z.string().default("https://api.anthropic.com/v1"),

	OPENAI_API_KEY: z.string().optional(),
	OPENAI_MODEL: z.string().default("gpt-5-mini"),
	OPENAI_NANO_MODEL: z.string().default("gpt-5-nano"),
	OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),

	OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
	OLLAMA_MODEL: z.string().default("llama3.2"),

	SLACK_CLIENT_ID: z.string().optional(),
	SLACK_CLIENT_SECRET: z.string().optional(),
	SLACK_REDIRECT_URI: z.string().optional(),
	SLACK_SCOPES: z.string().optional(),
	SLACK_SIGNING_SECRET: z.string().optional(),

	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	GOOGLE_REDIRECT_URI: z.string().optional(),
	GOOGLE_SCOPES: z.string().optional(),

	INTEGRATION_IMPORT_DEDUP_TTL_SECONDS: z.coerce
		.number()
		.int()
		.min(60)
		.max(31_536_000)
		.default(7_776_000), // 90 days
	GIT_WEBHOOK_SECRET: z.string().optional(),
	REALTIME_HEARTBEAT_MS: z.coerce
		.number()
		.int()
		.min(5_000)
		.max(120_000)
		.default(25_000),
	VOICE_TRANSCRIPTION_JOB_TTL_SECONDS: z.coerce
		.number()
		.int()
		.min(300)
		.max(604_800)
		.default(86_400),
});

const SENSITIVE_ENV_KEY_PARTS = [
	"SECRET",
	"PASSWORD",
	"KEY",
	"TOKEN",
	"DATABASE_URL",
	"REDIS_URL",
];

export function maskEnvValue(key: string, value: unknown): unknown {
	const isSensitive = SENSITIVE_ENV_KEY_PARTS.some((part) =>
		key.includes(part),
	);
	if (!isSensitive) return value;
	if (typeof value !== "string") return "***";
	if (value.length <= 8) return "***";
	return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

export const env = EnvSchema.parse(process.env);

// const maskedEnv = Object.fromEntries(
// 	Object.entries(env).map(([key, value]) => [key, maskEnvValue(key, value)]),
// );
// console.info("[env] loaded_config", maskedEnv);

export type Env = z.infer<typeof EnvSchema>;
