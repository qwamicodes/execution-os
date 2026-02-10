import Elysia from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { ValidationError } from "../../shared/errors";
import { created, success } from "../../shared/response";
import {
	CreateProjectSchema,
	ProjectQuerySchema,
	UpdateProjectSchema,
} from "./project.schema";
import * as projectService from "./project.service";

export const projectController = new Elysia({ prefix: "/projects" })
	.use(authMiddleware)

	.post("/", async ({ body, userId, set }) => {
		const parsed = CreateProjectSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const project = await projectService.createProject(userId, parsed.data);
		set.status = 201;
		return created(project);
	})

	.get("/", async ({ query, userId }) => {
		const parsed = ProjectQuerySchema.safeParse(query);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const projects = await projectService.listProjects(userId, parsed.data);
		return success(projects);
	})

	.get("/:id", async ({ params, userId }) => {
		const project = await projectService.getProject(userId, params.id);
		return success(project);
	})

	.patch("/:id", async ({ params, body, userId }) => {
		const parsed = UpdateProjectSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const project = await projectService.updateProject(
			userId,
			params.id,
			parsed.data,
		);
		return success(project);
	})

	.delete("/:id", async ({ params, userId, set }) => {
		await projectService.deleteProject(userId, params.id);
		set.status = 204;
	});
