import Elysia from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { basePlugin } from "../../plugins/base";
import { publishRealtimeEvent } from "../events/realtime.service";
import { ValidationError } from "../../shared/errors";
import { created, success } from "../../shared/response";
import {
	CreateMilestoneSchema,
	CreateProjectPartSchema,
	CreateProjectSchema,
	ProjectQuerySchema,
	UpdateMilestoneSchema,
	UpdateProjectPartSchema,
	UpdateProjectSchema,
} from "./project.schema";
import * as projectService from "./project.service";

export const projectController = new Elysia({ prefix: "/projects" })
	.use(basePlugin)
	.use(authMiddleware)

	.post("/", async ({ body, userId, internal_logger }) => {
		internal_logger.set("flow", "projects_create");
		const parsed = CreateProjectSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("project_input", {
			user_id: userId,
			type: parsed.data.type,
			has_color: Boolean(parsed.data.color),
		});

		const project = await projectService.createProject(
			userId,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", { project_id: project.id });
		publishRealtimeEvent(userId, "project.created", { projectId: project.id });
		return created(project);
	})

	.get("/", async ({ query, userId, internal_logger }) => {
		internal_logger.set("flow", "projects_list");
		const parsed = ProjectQuerySchema.safeParse(query);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("query", parsed.data);

		const projects = await projectService.listProjects(
			userId,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", { returned: projects.length });
		return success(projects);
	})

	.get("/:id", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "projects_get");
		internal_logger.set("project_ref", {
			project_id: params.id,
			user_id: userId,
		});
		const project = await projectService.getProject(
			userId,
			params.id,
			internal_logger,
		);
		internal_logger.set("result", { project_id: project.id });
		return success(project);
	})

	.patch("/:id", async ({ params, body, userId, internal_logger }) => {
		internal_logger.set("flow", "projects_update");
		const parsed = UpdateProjectSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("project_update", {
			project_id: params.id,
			user_id: userId,
			fields: Object.keys(parsed.data),
		});

		const project = await projectService.updateProject(
			userId,
			params.id,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", { project_id: project.id });
		publishRealtimeEvent(userId, "project.updated", { projectId: project.id });
		return success(project);
	})

	.get("/:id/milestones", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "projects_milestones_list");
		const milestones = await projectService.listMilestones(
			userId,
			params.id,
			internal_logger,
		);
		internal_logger.set("result", { returned: milestones.length });
		return success(milestones);
	})

	.get("/:id/parts", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "projects_parts_list");
		const parts = await projectService.listParts(
			userId,
			params.id,
			internal_logger,
		);
		internal_logger.set("result", { returned: parts.length });
		return success(parts);
	})

	.post("/:id/parts", async ({ params, body, userId, internal_logger }) => {
		internal_logger.set("flow", "projects_parts_create");
		const parsed = CreateProjectPartSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		const part = await projectService.createPart(
			userId,
			params.id,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", { part_id: part.id });
		publishRealtimeEvent(userId, "project.part.created", {
			projectId: params.id,
			partId: part.id,
		});
		return created(part);
	})

	.patch("/:id/parts/:partId", async ({ params, body, userId, internal_logger }) => {
		internal_logger.set("flow", "projects_parts_update");
		const parsed = UpdateProjectPartSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		const part = await projectService.updatePart(
			userId,
			params.id,
			params.partId,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", { part_id: part.id });
		publishRealtimeEvent(userId, "project.part.updated", {
			projectId: params.id,
			partId: part.id,
		});
		return success(part);
	})

	.delete("/:id/parts/:partId", async ({ params, userId, internal_logger, set }) => {
		internal_logger.set("flow", "projects_parts_delete");
		await projectService.deletePart(
			userId,
			params.id,
			params.partId,
			internal_logger,
		);
		internal_logger.set("result", {
			project_id: params.id,
			part_id: params.partId,
			deleted: true,
		});
		publishRealtimeEvent(userId, "project.part.deleted", {
			projectId: params.id,
			partId: params.partId,
		});
		set.status = 204;
	})

	.post("/:id/milestones", async ({ params, body, userId, internal_logger }) => {
		internal_logger.set("flow", "projects_milestones_create");
		const parsed = CreateMilestoneSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		const milestone = await projectService.createMilestone(
			userId,
			params.id,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", { milestone_id: milestone.id });
		publishRealtimeEvent(userId, "project.milestone.created", {
			projectId: params.id,
			milestoneId: milestone.id,
		});
		return created(milestone);
	})

	.patch(
		"/:id/milestones/:milestoneId",
		async ({ params, body, userId, internal_logger }) => {
			internal_logger.set("flow", "projects_milestones_update");
			const parsed = UpdateMilestoneSchema.safeParse(body);
			if (!parsed.success) {
				throw new ValidationError(parsed.error.flatten().fieldErrors);
			}
			const milestone = await projectService.updateMilestone(
				userId,
				params.id,
				params.milestoneId,
				parsed.data,
				internal_logger,
			);
			internal_logger.set("result", { milestone_id: milestone.id });
			publishRealtimeEvent(userId, "project.milestone.updated", {
				projectId: params.id,
				milestoneId: milestone.id,
			});
			return success(milestone);
		},
	)

	.delete(
		"/:id/milestones/:milestoneId",
		async ({ params, userId, internal_logger, set }) => {
			internal_logger.set("flow", "projects_milestones_delete");
			await projectService.deleteMilestone(
				userId,
				params.id,
				params.milestoneId,
				internal_logger,
			);
			internal_logger.set("result", {
				project_id: params.id,
				milestone_id: params.milestoneId,
				deleted: true,
			});
			publishRealtimeEvent(userId, "project.milestone.deleted", {
				projectId: params.id,
				milestoneId: params.milestoneId,
			});
			set.status = 204;
		},
	)

	.delete("/:id", async ({ params, userId, internal_logger, set }) => {
		internal_logger.set("flow", "projects_delete");
		internal_logger.set("project_ref", {
			project_id: params.id,
			user_id: userId,
		});
		await projectService.deleteProject(userId, params.id, internal_logger);
		internal_logger.set("result", { project_id: params.id, deleted: true });
		publishRealtimeEvent(userId, "project.deleted", { projectId: params.id });
		set.status = 204;
	});
