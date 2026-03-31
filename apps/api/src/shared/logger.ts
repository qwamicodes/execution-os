import pino from "pino";
import { env } from "../config";

export const logger = pino({
	level: env.LOG_LEVEL,
	formatters: {
		level: (label) => ({ level: label }),
	},
	base: {
		service: process.env.SERVICE_NAME || "execution-os-api",
		version: process.env.SERVICE_VERSION || "0.0.0",
		commit_hash: process.env.COMMIT_SHA || "unknown",
		environment: process.env.NODE_ENV || "development",
	},
});
