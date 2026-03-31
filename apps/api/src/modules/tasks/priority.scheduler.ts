import { env } from "../../config";
import { prisma } from "../../shared/database";
import { logger } from "../../shared/logger";
import { recalculatePrioritiesForUser } from "./task.service";

let schedulerStarted = false;
let schedulerRunning = false;

async function runPriorityRecalculationTick() {
	if (schedulerRunning) return;
	schedulerRunning = true;

	try {
		const users = await prisma.task.findMany({
			where: {
				deletedAt: null,
				state: { in: ["Ready", "Ongoing"] },
			},
			select: { userId: true },
			distinct: ["userId"],
		});

		let totalUpdated = 0;
		for (const user of users) {
			const result = await recalculatePrioritiesForUser(user.userId);
			totalUpdated += result.updated;
		}

		logger.info({
			event: "priority_recalculation_tick_completed",
			users_processed: users.length,
			tasks_updated: totalUpdated,
		});
	} catch (error) {
		logger.error({
			event: "priority_recalculation_tick_failed",
			error: error instanceof Error ? error.message : "Unknown error",
		});
	} finally {
		schedulerRunning = false;
	}
}

export function startPriorityRecalculationScheduler() {
	if (schedulerStarted) return;
	schedulerStarted = true;

	const intervalMs = env.AI_PRIORITY_RECALC_INTERVAL_MS;
	void runPriorityRecalculationTick();
	setInterval(() => {
		void runPriorityRecalculationTick();
	}, intervalMs);

	logger.info({
		event: "priority_recalculation_scheduler_started",
		interval_ms: intervalMs,
	});
}
