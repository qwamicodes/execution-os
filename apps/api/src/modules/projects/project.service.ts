import type { Prisma, ProjectType } from "@repo/database";
import { prisma } from "../../shared/database";
import { ConflictError, NotFoundError } from "../../shared/errors";
import type {
	CreateProjectInput,
	ProjectQuery,
	UpdateProjectInput,
} from "./project.schema";

export async function createProject(userId: string, input: CreateProjectInput) {
	const project = await prisma.project.create({
		data: {
			name: input.name,
			description: input.description,
			type: input.type as ProjectType,
			color: input.color,
			userId,
		},
	});

	return { ...project, taskCount: 0 };
}

export async function listProjects(userId: string, query: ProjectQuery) {
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
				color: project.color,
				taskCount: project._count.tasks,
				activeTasks,
				completedTasks,
				createdAt: project.createdAt,
				archivedAt: project.archivedAt,
			};
		}),
	);

	return enriched;
}

export async function getProject(userId: string, projectId: string) {
	const project = await prisma.project.findFirst({
		where: { id: projectId, userId, deletedAt: null },
		include: {
			_count: { select: { tasks: true } },
		},
	});

	if (!project) {
		throw new NotFoundError("Project");
	}

	return project;
}

export async function updateProject(
	userId: string,
	projectId: string,
	input: UpdateProjectInput,
) {
	const existing = await prisma.project.findFirst({
		where: { id: projectId, userId, deletedAt: null },
	});

	if (!existing) {
		throw new NotFoundError("Project");
	}

	const data: Prisma.ProjectUpdateInput = {};
	if (input.name !== undefined) data.name = input.name;
	if (input.description !== undefined) data.description = input.description;
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

	return project;
}

export async function deleteProject(userId: string, projectId: string) {
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
}
