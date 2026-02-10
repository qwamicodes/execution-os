import type { Prisma, SessionOutcome, TaskState } from "@repo/database";
import { prisma } from "../../shared/database";
import {
	ConflictError,
	NotFoundError,
	UnprocessableError,
} from "../../shared/errors";
import { redis } from "../../shared/redis";
import type {
	CompleteSessionInput,
	SessionHistoryQuery,
	StartSessionInput,
} from "./session.schema";

export async function startSession(userId: string, input: StartSessionInput) {
	// Check for existing active session
	const activeKey = `active_session:${userId}`;
	const existing = await redis.get(activeKey);
	if (existing) {
		const data = JSON.parse(existing);
		throw new ConflictError("User already has an active session", {
			activeSessionId: data.sessionId,
			activeTaskId: data.taskId,
		});
	}

	// Validate task
	const task = await prisma.task.findFirst({
		where: { id: input.taskId, userId, deletedAt: null },
		include: {
			project: { select: { id: true, name: true } },
		},
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	if (task.state !== "Ready") {
		throw new UnprocessableError(
			`Task is not in Ready state (current: ${task.state})`,
		);
	}

	const now = new Date();
	const expiresAt = new Date(now.getTime() + input.duration * 60 * 1000);

	// Create session and transition task atomically
	const session = await prisma.$transaction(async (tx) => {
		const sess = await tx.session.create({
			data: {
				taskId: input.taskId,
				userId,
				state: "Active",
				duration: input.duration,
				startedAt: now,
				expiresAt,
			},
		});

		await tx.task.update({
			where: { id: input.taskId },
			data: {
				state: "Active",
				stateChangedAt: now,
				stateHistory: {
					create: {
						fromState: task.state,
						toState: "Active",
						reason: "Focus session started",
						userId,
					},
				},
			},
		});

		return sess;
	});

	// Store active session in Redis
	await redis.setex(
		activeKey,
		input.duration * 60,
		JSON.stringify({
			sessionId: session.id,
			taskId: input.taskId,
			startedAt: now.toISOString(),
		}),
	);

	return {
		...session,
		task: {
			id: task.id,
			title: task.title,
			project: task.project,
		},
	};
}

export async function getActiveSession(userId: string) {
	const activeKey = `active_session:${userId}`;
	const data = await redis.get(activeKey);

	if (!data) {
		return null;
	}

	const { sessionId } = JSON.parse(data);

	const session = await prisma.session.findUnique({
		where: { id: sessionId },
		include: {
			task: {
				select: { id: true, title: true, state: true },
			},
		},
	});

	if (!session || (session.state !== "Active" && session.state !== "Paused")) {
		await redis.del(activeKey);
		return null;
	}

	const now = new Date();
	const elapsedMs = session.pausedAt
		? session.pausedAt.getTime() - session.startedAt.getTime()
		: now.getTime() - session.startedAt.getTime();
	const elapsedSeconds = Math.floor(elapsedMs / 1000);
	const totalSeconds = session.duration * 60;
	const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

	return {
		...session,
		elapsedSeconds,
		remainingSeconds,
		isPaused: session.state === "Paused",
	};
}

export async function pauseSession(userId: string, sessionId: string) {
	const session = await prisma.session.findFirst({
		where: { id: sessionId, userId },
	});

	if (!session) {
		throw new NotFoundError("Session");
	}

	if (session.state !== "Active") {
		throw new ConflictError("Session is not active");
	}

	const now = new Date();
	const elapsedMs = now.getTime() - session.startedAt.getTime();

	const updated = await prisma.session.update({
		where: { id: sessionId },
		data: {
			state: "Paused",
			pausedAt: now,
		},
	});

	return {
		id: updated.id,
		state: updated.state,
		pausedAt: now.toISOString(),
		elapsedSeconds: Math.floor(elapsedMs / 1000),
		remainingSeconds: Math.max(
			0,
			session.duration * 60 - Math.floor(elapsedMs / 1000),
		),
	};
}

export async function resumeSession(userId: string, sessionId: string) {
	const session = await prisma.session.findFirst({
		where: { id: sessionId, userId },
	});

	if (!session) {
		throw new NotFoundError("Session");
	}

	if (session.state !== "Paused") {
		throw new ConflictError("Session is not paused");
	}

	const now = new Date();
	// Calculate remaining time and set new expiration
	const pausedDuration = session.pausedAt
		? now.getTime() - session.pausedAt.getTime()
		: 0;
	const newExpiresAt = new Date(session.expiresAt.getTime() + pausedDuration);

	const updated = await prisma.session.update({
		where: { id: sessionId },
		data: {
			state: "Active",
			resumedAt: now,
			expiresAt: newExpiresAt,
		},
	});

	// Refresh Redis TTL
	const remainingMs = newExpiresAt.getTime() - now.getTime();
	const activeKey = `active_session:${userId}`;
	await redis.expire(activeKey, Math.ceil(remainingMs / 1000));

	return {
		id: updated.id,
		state: updated.state,
		resumedAt: now.toISOString(),
		expiresAt: newExpiresAt.toISOString(),
	};
}

export async function completeSession(
	userId: string,
	sessionId: string,
	input: CompleteSessionInput,
) {
	const session = await prisma.session.findFirst({
		where: { id: sessionId, userId },
		include: {
			task: { select: { id: true, title: true, state: true } },
		},
	});

	if (!session) {
		throw new NotFoundError("Session");
	}

	if (session.state === "Completed" || session.state === "Abandoned") {
		throw new ConflictError("Session already completed");
	}

	const now = new Date();
	const actualDurationMs = now.getTime() - session.startedAt.getTime();
	const actualDuration = Math.round(actualDurationMs / 60000); // minutes

	// Determine new task state based on outcome
	const outcomeTaskStateMap: Record<string, string> = {
		Done: "Done",
		Continue: "Ready",
		Blocked: "Blocked",
		TooBig: "Ongoing",
	};
	const newTaskState = outcomeTaskStateMap[input.outcome];

	const result = await prisma.$transaction(async (tx) => {
		// Update session
		const updatedSession = await tx.session.update({
			where: { id: sessionId },
			data: {
				state: "Completed",
				outcome: input.outcome as SessionOutcome,
				actualDuration,
				completedAt: now,
				notes: input.notes,
				blockerNote: input.blockerNote,
			},
		});

		// Transition task state
		await tx.task.update({
			where: { id: session.taskId },
			data: {
				state: newTaskState as TaskState,
				stateChangedAt: now,
				completedSessions: { increment: 1 },
				stateHistory: {
					create: {
						fromState: session.task.state,
						toState: newTaskState as TaskState,
						reason: `Session completed with outcome: ${input.outcome}`,
						userId,
					},
				},
			},
		});

		return updatedSession;
	});

	// Remove active session from Redis
	await redis.del(`active_session:${userId}`);

	// Get next suggested task
	const nextTask = await prisma.task.findFirst({
		where: {
			userId,
			state: "Ready",
			deletedAt: null,
			id: { not: session.taskId },
		},
		orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
		include: {
			project: { select: { id: true, name: true } },
		},
	});

	return {
		session: {
			id: result.id,
			state: result.state,
			outcome: result.outcome,
			duration: result.duration,
			actualDuration,
			completedAt: now.toISOString(),
		},
		task: {
			id: session.task.id,
			state: newTaskState,
			title: session.task.title,
		},
		nextTask: nextTask
			? {
					id: nextTask.id,
					title: nextTask.title,
					state: nextTask.state,
					priority: nextTask.priority,
					project: nextTask.project,
				}
			: null,
	};
}

export async function updateScratchpad(
	userId: string,
	sessionId: string,
	content: string,
) {
	const session = await prisma.session.findFirst({
		where: { id: sessionId, userId },
	});

	if (!session) {
		throw new NotFoundError("Session");
	}

	const updated = await prisma.session.update({
		where: { id: sessionId },
		data: { scratchpad: content },
		select: { id: true, scratchpad: true, updatedAt: true },
	});

	return updated;
}

export async function getSessionHistory(
	userId: string,
	query: SessionHistoryQuery,
) {
	const where: Prisma.SessionWhereInput = {
		userId,
		state: "Completed",
	};

	if (query.taskId) where.taskId = query.taskId;
	if (query.outcome) where.outcome = query.outcome as SessionOutcome;
	if (query.startDate || query.endDate) {
		where.startedAt = {};
		if (query.startDate) where.startedAt.gte = new Date(query.startDate);
		if (query.endDate) where.startedAt.lte = new Date(query.endDate);
	}

	const [sessions, total] = await Promise.all([
		prisma.session.findMany({
			where,
			orderBy: { completedAt: "desc" },
			skip: (query.page - 1) * query.limit,
			take: query.limit,
			include: {
				task: { select: { id: true, title: true } },
			},
		}),
		prisma.session.count({ where }),
	]);

	return { sessions, total };
}
