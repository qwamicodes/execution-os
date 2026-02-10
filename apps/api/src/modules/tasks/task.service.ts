import type { Prisma, TaskState } from "@repo/database";
import { prisma } from "../../shared/database";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	UnprocessableError,
} from "../../shared/errors";
import type {
	CreateTaskInput,
	TaskQuery,
	UpdateTaskInput,
} from "./task.schema";

// Valid state transitions per spec
const VALID_TRANSITIONS: Record<string, string[]> = {
	Inbox: ["Ongoing", "Ready"],
	Ongoing: ["Ready", "Done"],
	Ready: ["Active", "Ongoing", "Blocked", "Paused", "Done"],
	Active: ["Ready", "Blocked", "Paused", "Done"],
	Blocked: ["Ready", "Ongoing"],
	Paused: ["Ready", "Ongoing"],
	Done: ["Ready"], // reopen
};

export function isValidTransition(from: string, to: string): boolean {
	return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function createTask(userId: string, input: CreateTaskInput) {
	if (input.projectId) {
		const project = await prisma.project.findFirst({
			where: { id: input.projectId, userId, deletedAt: null },
		});
		if (!project) {
			throw new NotFoundError("Project");
		}
	}

	if (input.deadline && new Date(input.deadline) < new Date()) {
		throw new UnprocessableError("Deadline cannot be in the past");
	}

	const task = await prisma.task.create({
		data: {
			title: input.title,
			description: input.description,
			projectId: input.projectId,
			deadline: input.deadline ? new Date(input.deadline) : undefined,
			tags: input.tags ?? [],
			source: input.source,
			sourceMetadata: input.sourceMetadata as Prisma.InputJsonValue,
			userId,
			state: "Inbox",
		},
		include: {
			project: {
				select: { id: true, name: true, type: true },
			},
		},
	});

	return task;
}

export async function listTasks(userId: string, query: TaskQuery) {
	const where: Prisma.TaskWhereInput = {
		userId,
		deletedAt: null,
	};

	if (query.state) where.state = query.state as TaskState;
	if (query.projectId) where.projectId = query.projectId;
	if (query.size) where.size = query.size;
	if (query.protected !== undefined) where.protected = query.protected;
	if (query.hasDeadline !== undefined) {
		where.deadline = query.hasDeadline ? { not: null } : null;
	}
	if (query.search) {
		where.OR = [
			{ title: { contains: query.search, mode: "insensitive" } },
			{ description: { contains: query.search, mode: "insensitive" } },
		];
	}

	const [tasks, total] = await Promise.all([
		prisma.task.findMany({
			where,
			orderBy: { [query.sortBy]: query.sortOrder },
			skip: (query.page - 1) * query.limit,
			take: query.limit,
			include: {
				project: {
					select: { id: true, name: true, type: true },
				},
			},
		}),
		prisma.task.count({ where }),
	]);

	return { tasks, total };
}

export async function getTask(userId: string, taskId: string) {
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
		include: {
			project: {
				select: { id: true, name: true, type: true },
			},
			subtasks: {
				where: { deletedAt: null },
				orderBy: { order: "asc" },
				select: {
					id: true,
					title: true,
					state: true,
					order: true,
					estimatedSessions: true,
					completedSessions: true,
				},
			},
			stateHistory: {
				orderBy: { createdAt: "desc" },
				take: 20,
				select: {
					fromState: true,
					toState: true,
					reason: true,
					createdAt: true,
				},
			},
		},
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	return task;
}

export async function updateTask(
	userId: string,
	taskId: string,
	input: UpdateTaskInput,
) {
	const existing = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
	});

	if (!existing) {
		throw new NotFoundError("Task");
	}

	if (existing.state === "Active" && !input.state) {
		throw new UnprocessableError("Cannot edit task in Active state");
	}

	// Handle state transition
	if (input.state) {
		if (!isValidTransition(existing.state, input.state)) {
			throw new ConflictError(
				`Invalid state transition from ${existing.state} to ${input.state}`,
			);
		}
	}

	const { state, ...updateData } = input;

	const task = await prisma.task.update({
		where: { id: taskId },
		data: {
			...updateData,
			deadline:
				updateData.deadline !== undefined
					? updateData.deadline
						? new Date(updateData.deadline)
						: null
					: undefined,
			...(state
				? {
						state: state as TaskState,
						stateChangedAt: new Date(),
						stateHistory: {
							create: {
								fromState: existing.state,
								toState: state as TaskState,
								reason: "Manual state change",
								userId,
							},
						},
					}
				: {}),
		},
		include: {
			project: {
				select: { id: true, name: true, type: true },
			},
			subtasks: {
				where: { deletedAt: null },
				orderBy: { order: "asc" },
			},
		},
	});

	return task;
}

export async function deleteTask(userId: string, taskId: string) {
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	if (task.state === "Active") {
		throw new ConflictError("Cannot delete Active task (end session first)");
	}

	// Soft delete task and its subtasks
	await prisma.task.updateMany({
		where: {
			OR: [{ id: taskId }, { parentId: taskId }],
			userId,
		},
		data: { deletedAt: new Date() },
	});
}

export async function restoreTask(userId: string, taskId: string) {
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: { not: null } },
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	if (task.projectId) {
		const project = await prisma.project.findFirst({
			where: { id: task.projectId, deletedAt: null },
		});
		if (!project) {
			throw new ConflictError("Task's project was deleted");
		}
	}

	const restored = await prisma.task.update({
		where: { id: taskId },
		data: { deletedAt: null },
		include: {
			project: {
				select: { id: true, name: true, type: true },
			},
		},
	});

	return restored;
}

export async function decomposeTask(userId: string, taskId: string) {
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	const existingSubtasks = await prisma.task.count({
		where: { parentId: taskId, deletedAt: null },
	});

	if (existingSubtasks > 0) {
		throw new ConflictError("Task already has subtasks");
	}

	if (task.size === "Small") {
		throw new UnprocessableError("Task size is Small (cannot decompose)");
	}

	// Transition to Ongoing
	if (task.state !== "Ongoing") {
		await prisma.task.update({
			where: { id: taskId },
			data: {
				state: "Ongoing",
				stateChangedAt: new Date(),
				stateHistory: {
					create: {
						fromState: task.state,
						toState: "Ongoing",
						reason: "Decomposition requested",
						userId,
					},
				},
			},
		});
	}

	// Return 202 stub — AI decomposition would run async
	return {
		message: "Decomposition requested",
		taskId,
		jobId: `job_${Date.now()}`,
	};
}

export async function getSubtasks(userId: string, taskId: string) {
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId, deletedAt: null },
	});

	if (!task) {
		throw new NotFoundError("Task");
	}

	const subtasks = await prisma.task.findMany({
		where: { parentId: taskId, deletedAt: null },
		orderBy: { order: "asc" },
		select: {
			id: true,
			title: true,
			state: true,
			order: true,
			estimatedSessions: true,
			completedSessions: true,
		},
	});

	return subtasks;
}
