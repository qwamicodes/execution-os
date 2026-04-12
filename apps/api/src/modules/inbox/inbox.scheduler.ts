import { env } from "../../config";
import { prisma } from "../../shared/database";
import { logger } from "../../shared/logger";
import { autoClassifyTask } from "../tasks/task.service";

const INBOX_POLL_INTERVAL_MS = 5_000;
const AUTO_APPLY_DELAY_MS = 30_000;
const BATCH_SIZE = 10;

let schedulerStarted = false;
let schedulerRunning = false;

function classificationNeedsReview(sourceMetadata: unknown) {
	if (!sourceMetadata || typeof sourceMetadata !== "object") return false;
	const metadata = sourceMetadata as Record<string, unknown>;
	const aiClassification = metadata.aiClassification;
	if (!aiClassification || typeof aiClassification !== "object") return false;
	return (
		(aiClassification as Record<string, unknown>).status === "needs_review"
	);
}

async function runInboxClassificationTick() {
	if (schedulerRunning || !env.AI_AUTO_CLASSIFY_ON_TASK_CREATE) return;
	schedulerRunning = true;

	try {
		const now = new Date();
		const eligibleBefore = new Date(now.getTime() - AUTO_APPLY_DELAY_MS);
		const inboxCandidates = await prisma.task.findMany({
			where: {
				state: "Inbox",
				deletedAt: null,
				createdAt: { lte: eligibleBefore },
			},
			select: {
				id: true,
				userId: true,
				sourceMetadata: true,
			},
			orderBy: { createdAt: "asc" },
			take: 50,
		});

		const queue = inboxCandidates
			.filter((task) => !classificationNeedsReview(task.sourceMetadata))
			.slice(0, BATCH_SIZE);

		let processed = 0;
		for (const task of queue) {
			try {
				await autoClassifyTask(task.userId, task.id);
				processed += 1;
			} catch (error) {
				logger.warn({
					event: "inbox_auto_classification_job_failed",
					task_id: task.id,
					user_id: task.userId,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		if (queue.length > 0) {
			logger.info({
				event: "inbox_auto_classification_tick_completed",
				queued: queue.length,
				processed,
			});
		}
	} catch (error) {
		logger.error({
			event: "inbox_auto_classification_tick_failed",
			error: error instanceof Error ? error.message : "Unknown error",
		});
	} finally {
		schedulerRunning = false;
	}
}

export function startInboxClassificationScheduler() {
	if (schedulerStarted) return;
	schedulerStarted = true;

	setInterval(() => {
		void runInboxClassificationTick();
	}, INBOX_POLL_INTERVAL_MS);

	logger.info({
		event: "inbox_auto_classification_scheduler_started",
		poll_interval_ms: INBOX_POLL_INTERVAL_MS,
		auto_apply_delay_ms: AUTO_APPLY_DELAY_MS,
		batch_size: BATCH_SIZE,
	});
}
