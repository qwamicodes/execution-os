import type { Prisma, ProjectType } from "@repo/database";

import { prisma } from "../../shared/database";
import { ConflictError, NotFoundError } from "../../shared/errors";
import type { RequestLogger } from "../../shared/wide-event";
import type {
	CreateMilestoneInput,
	CreateProjectInput,
	ProjectQuery,
	UpdateMilestoneInput,
	UpdateProjectInput,
} from "./project.schema";

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

	const projects = await prisma.project.findMany({
		where,
		orderBy: { createdAt: "desc" },
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
				input.description === undefined ? undefined : (input.description ?? null),
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
