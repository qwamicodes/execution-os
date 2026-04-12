import pino from "pino";
import { env } from "../config";

export const logger = pino({
	level: env.LOG_LEVEL,
	formatters: {
		level: (label) => ({ level: label }),
	},
	base: {
		service: env.SERVICE_NAME || "execution-os-api",
		version: env.SERVICE_VERSION || "0.0.0",
		commit_hash: env.COMMIT_SHA || "unknown",
		environment: env.ENVIRONMENT || "development",
	},
});
