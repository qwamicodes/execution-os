import Redis from "ioredis";

import { env } from "../config";
import { logger } from "./logger";

const redisUrl = env.REDIS_URL ;
logger.info({ event: "redis_url", url: redisUrl });

export const redis = new Redis(redisUrl, {
	maxRetriesPerRequest: 3,
	retryStrategy(times) {
		const delay = Math.min(times * 50, 2000);
		return delay;
	},
});

redis.on("error", (err) => {
	logger.error({ event: "redis_connection_error", error: err.message });
});

redis.on("connect", () => {
	logger.info({ event: "redis_connected" });
});
