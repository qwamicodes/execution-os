import type {
	Prisma,
	ProjectStructureType,
	ProjectType,
	TaskState,
} from "@repo/database";

import { prisma } from "../../shared/database";
import {
	ConflictError,
	NotFoundError,
	UnprocessableError,
} from "../../shared/errors";
import type { RequestLogger } from "../../shared/wide-event";
import { updateTask } from "../tasks/task.service";
import type {
	BatchApplyProjectTasksInput,
	CreateMilestoneInput,
	CreateProjectEpicInput,
	CreateProjectInput,
	CreateProjectPartInput,
	ProjectQuery,
	UpdateMilestoneInput,
	UpdateProjectEpicInput,
	UpdateProjectInput,
	UpdateProjectPartInput,
} from "./project.schema";

function buildProjectTaskBatchWhere(
	userId: string,
	projectId: string,
	filters: BatchApplyProjectTasksInput["filters"],
) {
	const where: Prisma.TaskWhereInput = {
		userId,
		projectId,
		deletedAt: null,
	};

	if (filters.state) where.state = filters.state as TaskState;
	if (filters.partId) {
		where.AND = [
			...(Array.isArray(where.AND) ? where.AND : []),
			{
				OR: [
					{ partId: filters.partId },
					{ parts: { some: { partId: filters.partId } } },
				],
			},
		];
	}
	if (filters.epicId) {
		where.AND = [
			...(Array.isArray(where.AND) ? where.AND : []),
			{ epics: { some: { epicId: filters.epicId } } },
		];
	}
	if (filters.milestoneId) where.milestoneId = filters.milestoneId;
	if (filters.size) where.size = filters.size;
	if (filters.searchQuery) {
		where.AND = [
			...(Array.isArray(where.AND) ? where.AND : []),
			{
				OR: [
					{ title: { contains: filters.searchQuery, mode: "insensitive" } },
					{
						description: {
							contains: filters.searchQuery,
							mode: "insensitive",
						},
					},
				],
			},
		];
	}

	return where;
}

async function recalculateProjectTargetCompletionDate(projectId: string) {
	const latestMilestone = await prisma.projectMilestone.findFirst({
		where: { projectId },
		orderBy: [{ targetDate: "desc" }],
		select: { targetDate: true },
	});
	return prisma.project.update({
		where: { id: projectId },
		data: {
			targetCompletionDate: latestMilestone?.targetDate ?? null,
		},
		select: { id: true, targetCompletionDate: true },
	});
}

export async function createProject(
	userId: string,
	input: CreateProjectInput,
	logger?: RequestLogger,
) {
	logger?.set("project_service", { operation: "create", user_id: userId });
	const project = await prisma.project.create({
		data: {
			name: input.name,
			description: input.description,
			type: input.type as ProjectType,
			structureType: input.structureType as ProjectStructureType,
			targetCompletionDate: input.targetCompletionDate
				? new Date(input.targetCompletionDate)
				: undefined,
			color: input.color,
			userId,
		},
	});
	logger?.set("project_service_result", {
		operation: "create",
		project_id: project.id,
	});

	return { ...project, taskCount: 0 };
}

export async function listProjects(
	userId: string,
	query: ProjectQuery,
	logger?: RequestLogger,
) {
	logger?.set("project_service", { operation: "list", user_id: userId });
	const where: Prisma.ProjectWhereInput = {
		userId,
		deletedAt: null,
	};

	if (query.type) where.type = query.type as ProjectType;
	if (!query.includeArchived) where.archivedAt = null;
	const searchQuery = query.searchQuery ?? query.search;
	if (searchQuery) {
		where.OR = [
			{ name: { contains: searchQuery, mode: "insensitive" } },
			{ description: { contains: searchQuery, mode: "insensitive" } },
		];
	}

	const projects = await prisma.project.findMany({
		where,
		orderBy: { [query.sortBy]: query.sortOrder },
		include: {
			_count: {
				select: { tasks: true },
			},
		},
	});

	// Enrich with task state counts
	const enriched = await Promise.all(
		projects.map(async (project) => {
			const [activeTasks, completedTasks] = await Promise.all([
				prisma.task.count({
					where: {
						projectId: project.id,
						state: { in: ["Active", "Ready", "Ongoing"] },
						deletedAt: null,
					},
				}),
				prisma.task.count({
					where: {
						projectId: project.id,
						state: "Done",
						deletedAt: null,
					},
				}),
			]);

			return {
				id: project.id,
				name: project.name,
				description: project.description,
				type: project.type,
				structureType: project.structureType,
				targetCompletionDate: project.targetCompletionDate,
				color: project.color,
				taskCount: project._count.tasks,
				activeTasks,
				completedTasks,
				createdAt: project.createdAt,
				archivedAt: project.archivedAt,
				updatedAt: project.updatedAt,
			};
		}),
	);
	logger?.set("project_service_result", {
		operation: "list",
		returned: enriched.length,
	});

	return enriched;
}

export async function getProject(
	userId: string,
	projectId: string,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "get",
		user_id: userId,
		project_id: projectId,
	});
	const project = await prisma.project.findFirst({
		where: { id: projectId, userId, deletedAt: null },
		include: {
			_count: { select: { tasks: true } },
		},
	});

	if (!project) {
		throw new NotFoundError("Project");
	}
	logger?.set("project_service_result", {
		operation: "get",
		project_id: project.id,
	});

	return project;
}

export async function updateProject(
	userId: string,
	projectId: string,
	input: UpdateProjectInput,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "update",
		user_id: userId,
		project_id: projectId,
	});
	const existing = await prisma.project.findFirst({
		where: { id: projectId, userId, deletedAt: null },
	});

	if (!existing) {
		throw new NotFoundError("Project");
	}

	const data: Prisma.ProjectUpdateInput = {};
	if (input.name !== undefined) data.name = input.name;
	if (input.description !== undefined) data.description = input.description;
	if (input.structureType !== undefined) {
		data.structureType = input.structureType as ProjectStructureType;
	}
	if (input.targetCompletionDate !== undefined) {
		data.targetCompletionDate = input.targetCompletionDate
			? new Date(input.targetCompletionDate)
			: null;
	}
	if (input.color !== undefined) data.color = input.color;
	if (input.archived !== undefined) {
		data.archivedAt = input.archived ? new Date() : null;
	}

	const project = await prisma.project.update({
		where: { id: projectId },
		data,
		include: {
			_count: { select: { tasks: true } },
		},
	});
	logger?.set("project_service_result", {
		operation: "update",
		project_id: project.id,
	});

	return project;
}

export async function deleteProject(
	userId: string,
	projectId: string,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "delete",
		user_id: userId,
		project_id: projectId,
	});
	const project = await prisma.project.findFirst({
		where: { id: projectId, userId, deletedAt: null },
	});

	if (!project) {
		throw new NotFoundError("Project");
	}

	// Check for active sessions on project tasks
	const activeSession = await prisma.session.findFirst({
		where: {
			task: { projectId, deletedAt: null },
			state: "Active",
		},
	});

	if (activeSession) {
		throw new ConflictError("Project has active focus session");
	}

	// Soft delete project and its tasks
	await prisma.$transaction([
		prisma.project.update({
			where: { id: projectId },
			data: { deletedAt: new Date() },
		}),
		prisma.task.updateMany({
			where: { projectId, userId, deletedAt: null },
			data: { deletedAt: new Date() },
		}),
	]);
	logger?.set("project_service_result", {
		operation: "delete",
		project_id: projectId,
		deleted: true,
	});
}

export async function batchApplyProjectTasks(
	userId: string,
	projectId: string,
	input: BatchApplyProjectTasksInput,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "batch_apply_tasks",
		user_id: userId,
		project_id: projectId,
	});
	await getProject(userId, projectId, logger);

	const where = buildProjectTaskBatchWhere(userId, projectId, input.filters);
	const candidates = await prisma.task.findMany({
		where,
		select: { id: true, title: true },
		orderBy: { createdAt: "asc" },
	});

	const updated: Array<{ id: string; title: string }> = [];
	const failed: Array<{ id: string; title: string; reason: string }> = [];

	for (const candidate of candidates) {
		try {
			const task = await updateTask(
				userId,
				candidate.id,
				input.apply,
				logger,
			);
			updated.push({ id: task.id, title: task.title });
		} catch (error) {
			failed.push({
				id: candidate.id,
				title: candidate.title,
				reason: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	logger?.set("project_service_result", {
		operation: "batch_apply_tasks",
		matched: candidates.length,
		updated: updated.length,
		failed: failed.length,
	});

	return {
		matched: candidates.length,
		updated: updated.length,
		failed: failed.length,
		updatedTasks: updated,
		failedTasks: failed,
	};
}

export async function listMilestones(
	userId: string,
	projectId: string,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "list_milestones",
		user_id: userId,
		project_id: projectId,
	});
	await getProject(userId, projectId, logger);
	const milestones = await prisma.projectMilestone.findMany({
		where: { projectId, userId },
		orderBy: [{ order: "asc" }, { targetDate: "asc" }, { createdAt: "asc" }],
	});
	return milestones;
}

export async function createMilestone(
	userId: string,
	projectId: string,
	input: CreateMilestoneInput,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "create_milestone",
		user_id: userId,
		project_id: projectId,
	});
	await getProject(userId, projectId, logger);
	const created = await prisma.projectMilestone.create({
		data: {
			projectId,
			userId,
			title: input.title,
			description: input.description,
			targetDate: input.targetDate ? new Date(input.targetDate) : null,
			status: input.status,
			order: input.order,
			completedAt: input.status === "Completed" ? new Date() : null,
		},
	});
	await recalculateProjectTargetCompletionDate(projectId);
	return created;
}

export async function updateMilestone(
	userId: string,
	projectId: string,
	milestoneId: string,
	input: UpdateMilestoneInput,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "update_milestone",
		user_id: userId,
		project_id: projectId,
		milestone_id: milestoneId,
	});
	await getProject(userId, projectId, logger);
	const existing = await prisma.projectMilestone.findFirst({
		where: { id: milestoneId, projectId, userId },
	});
	if (!existing) throw new NotFoundError("Project milestone");

	const updated = await prisma.projectMilestone.update({
		where: { id: milestoneId },
		data: {
			title: input.title,
			description:
				input.description === undefined
					? undefined
					: (input.description ?? null),
			targetDate:
				input.targetDate === undefined
					? undefined
					: input.targetDate
						? new Date(input.targetDate)
						: null,
			status: input.status,
			order: input.order,
			completedAt:
				input.completedAt === undefined
					? input.status === "Completed" && existing.completedAt === null
						? new Date()
						: undefined
					: input.completedAt
						? new Date(input.completedAt)
						: null,
		},
	});
	await recalculateProjectTargetCompletionDate(projectId);
	return updated;
}

export async function deleteMilestone(
	userId: string,
	projectId: string,
	milestoneId: string,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "delete_milestone",
		user_id: userId,
		project_id: projectId,
		milestone_id: milestoneId,
	});
	await getProject(userId, projectId, logger);
	const existing = await prisma.projectMilestone.findFirst({
		where: { id: milestoneId, projectId, userId },
		select: { id: true },
	});
	if (!existing) throw new NotFoundError("Project milestone");
	await prisma.projectMilestone.delete({
		where: { id: milestoneId },
	});
	await recalculateProjectTargetCompletionDate(projectId);
}

export async function listParts(
	userId: string,
	projectId: string,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "list_parts",
		user_id: userId,
		project_id: projectId,
	});
	const project = await getProject(userId, projectId, logger);
	if (project.structureType !== "Monorepo") return [];
	return prisma.projectPart.findMany({
		where: { projectId, userId },
		orderBy: [{ order: "asc" }, { name: "asc" }],
	});
}

export async function createPart(
	userId: string,
	projectId: string,
	input: CreateProjectPartInput,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "create_part",
		user_id: userId,
		project_id: projectId,
	});
	const project = await getProject(userId, projectId, logger);
	if (project.structureType !== "Monorepo") {
		throw new UnprocessableError(
			"Project parts are only available for monorepos",
		);
	}

	return prisma.projectPart.create({
		data: {
			projectId,
			userId,
			name: input.name.trim(),
			description: input.description,
			order: input.order,
		},
	});
}

export async function updatePart(
	userId: string,
	projectId: string,
	partId: string,
	input: UpdateProjectPartInput,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "update_part",
		user_id: userId,
		project_id: projectId,
		part_id: partId,
	});
	const project = await getProject(userId, projectId, logger);
	if (project.structureType !== "Monorepo") {
		throw new UnprocessableError(
			"Project parts are only available for monorepos",
		);
	}
	const existing = await prisma.projectPart.findFirst({
		where: { id: partId, projectId, userId },
		select: { id: true },
	});
	if (!existing) throw new NotFoundError("Project part");

	return prisma.projectPart.update({
		where: { id: partId },
		data: {
			name: input.name?.trim(),
			description:
				input.description === undefined
					? undefined
					: (input.description ?? null),
			order: input.order,
		},
	});
}

export async function deletePart(
	userId: string,
	projectId: string,
	partId: string,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "delete_part",
		user_id: userId,
		project_id: projectId,
		part_id: partId,
	});
	const project = await getProject(userId, projectId, logger);
	if (project.structureType !== "Monorepo") {
		throw new UnprocessableError(
			"Project parts are only available for monorepos",
		);
	}
	const existing = await prisma.projectPart.findFirst({
		where: { id: partId, projectId, userId },
		select: { id: true },
	});
	if (!existing) throw new NotFoundError("Project part");

	await prisma.projectPart.delete({
		where: { id: partId },
	});
}

export async function listEpics(
	userId: string,
	projectId: string,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "list_epics",
		user_id: userId,
		project_id: projectId,
	});
	await getProject(userId, projectId, logger);
	return prisma.projectEpic.findMany({
		where: { projectId, userId },
		orderBy: [{ order: "asc" }, { name: "asc" }],
	});
}

export async function createEpic(
	userId: string,
	projectId: string,
	input: CreateProjectEpicInput,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "create_epic",
		user_id: userId,
		project_id: projectId,
	});
	await getProject(userId, projectId, logger);

	return prisma.projectEpic.create({
		data: {
			projectId,
			userId,
			key: input.key?.trim() || null,
			name: input.name.trim(),
			description: input.description,
			targetDate: input.targetDate ? new Date(input.targetDate) : null,
			order: input.order,
		},
	});
}

export async function updateEpic(
	userId: string,
	projectId: string,
	epicId: string,
	input: UpdateProjectEpicInput,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "update_epic",
		user_id: userId,
		project_id: projectId,
		epic_id: epicId,
	});
	await getProject(userId, projectId, logger);
	const existing = await prisma.projectEpic.findFirst({
		where: { id: epicId, projectId, userId },
		select: { id: true },
	});
	if (!existing) throw new NotFoundError("Project epic");

	return prisma.projectEpic.update({
		where: { id: epicId },
		data: {
			key: input.key === undefined ? undefined : input.key?.trim() || null,
			name: input.name?.trim(),
			description:
				input.description === undefined
					? undefined
					: (input.description ?? null),
			targetDate:
				input.targetDate === undefined
					? undefined
					: input.targetDate
						? new Date(input.targetDate)
						: null,
			order: input.order,
		},
	});
}

export async function deleteEpic(
	userId: string,
	projectId: string,
	epicId: string,
	logger?: RequestLogger,
) {
	logger?.set("project_service", {
		operation: "delete_epic",
		user_id: userId,
		project_id: projectId,
		epic_id: epicId,
	});
	await getProject(userId, projectId, logger);
	const existing = await prisma.projectEpic.findFirst({
		where: { id: epicId, projectId, userId },
		select: { id: true },
	});
	if (!existing) throw new NotFoundError("Project epic");

	await prisma.projectEpic.delete({
		where: { id: epicId },
	});
}
