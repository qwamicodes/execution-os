import Elysia from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { basePlugin } from "../../plugins/base";
import { ValidationError } from "../../shared/errors";
import { created, paginated, success } from "../../shared/response";
import {
	CreateIdeaSchema,
	IdeaQuerySchema,
	UpdateIdeaWithStateSchema,
} from "./idea.schema";
import * as ideaService from "./idea.service";

export const ideaController = new Elysia({ prefix: "/ideas" })
	.use(basePlugin)
	.use(authMiddleware)
	.get("/", async ({ query, userId, internal_logger }) => {
		internal_logger.set("flow", "ideas_list");
		const parsed = IdeaQuerySchema.safeParse(query);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		const { ideas, total } = await ideaService.listIdeas(
			userId,
			parsed.data,
			internal_logger,
		);
		return paginated(ideas, total, parsed.data.page, parsed.data.limit);
	})
	.post("/", async ({ body, userId, internal_logger, set }) => {
		internal_logger.set("flow", "ideas_create");
		const idea = await ideaService.createIdea(userId, body, internal_logger);
		set.status = 201;
		return created(idea);
	}, { body: CreateIdeaSchema })
	.get("/:id", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "ideas_get");
		const idea = await ideaService.getIdea(userId, params.id, internal_logger);
		return success(idea);
	})
	.patch("/:id", async ({ params, body, userId, internal_logger }) => {
		internal_logger.set("flow", "ideas_update");
		const idea = await ideaService.updateIdea(
			userId,
			params.id,
			body,
			internal_logger,
		);
		return success(idea);
	}, { body: UpdateIdeaWithStateSchema })
	.post("/:id/classify/ai", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "ideas_classify_ai");
		const idea = await ideaService.classifyAndClarifyIdea(
			userId,
			params.id,
			internal_logger,
		);
		return success(idea);
	})
	.delete("/:id", async ({ params, userId, internal_logger, set }) => {
		internal_logger.set("flow", "ideas_delete");
		await ideaService.deleteIdea(userId, params.id, internal_logger);
		set.status = 204;
	})
	.post("/:id/convert-to-task", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "ideas_convert_to_task");
		const task = await ideaService.convertIdeaToTask(
			userId,
			params.id,
			internal_logger,
		);
		return success({ task });
	})
	.post("/:id/convert-to-project", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "ideas_convert_to_project");
		const result = await ideaService.convertIdeaToProject(
			userId,
			params.id,
			internal_logger,
		);
		return success(result);
	});
