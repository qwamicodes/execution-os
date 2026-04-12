import type { Task } from "@/lib/types";

export function getTaskFeatureGate(task: Task) {
	const fallback = {
		blocked: task.featureBlocked === true,
		reason: task.featureBlockReason ?? null,
		blockingTaskIds: [] as string[],
		blocksTaskIds: [] as string[],
	};
	if (!task.sourceMetadata || typeof task.sourceMetadata !== "object") {
		return fallback;
	}
	const metadata = task.sourceMetadata as Record<string, unknown>;
	const featureGate = metadata.featureGate;
	if (!featureGate || typeof featureGate !== "object") {
		return fallback;
	}
	const gate = featureGate as Record<string, unknown>;
	const blockingTaskIds = Array.isArray(gate.blockingTaskIds)
		? gate.blockingTaskIds.filter((id): id is string => typeof id === "string")
		: typeof gate.blockingTaskId === "string"
			? [gate.blockingTaskId]
			: [];
	const blocksTaskIds = Array.isArray(gate.blocksTaskIds)
		? gate.blocksTaskIds.filter((id): id is string => typeof id === "string")
		: typeof gate.blocksTaskId === "string"
			? [gate.blocksTaskId]
			: [];
	return {
		blocked: gate.blocked === true || fallback.blocked,
		reason:
			typeof gate.reason === "string" && gate.reason.trim().length > 0
				? gate.reason
				: fallback.reason,
		blockingTaskIds: Array.from(new Set(blockingTaskIds)),
		blocksTaskIds: Array.from(new Set(blocksTaskIds)),
	};
}

export function isTaskBlocked(task: Task) {
	return task.state === "Blocked" || getTaskFeatureGate(task).blocked;
}
