import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:8911";

export const redis = new Redis(redisUrl, {
	maxRetriesPerRequest: 3,
	retryStrategy(times) {
		const delay = Math.min(times * 50, 2000);
		return delay;
	},
});

redis.on("error", (err) => {
	console.error("[redis] connection error:", err.message);
});

redis.on("connect", () => {
	console.log("[redis] connected");
});
