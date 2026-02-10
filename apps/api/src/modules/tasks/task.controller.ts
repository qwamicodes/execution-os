import Elysia from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { ValidationError } from "../../shared/errors";
import { created, paginated, success } from "../../shared/response";
import {
	CreateTaskSchema,
	DecomposeRequestSchema,
	TaskQuerySchema,
	UpdateTaskSchema,
} from "./task.schema";
import * as taskService from "./task.service";

export const taskController = new Elysia({ prefix: "/tasks" })
	.use(authMiddleware)

	.post("/", async ({ body, userId, set }) => {
		const parsed = CreateTaskSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const task = await taskService.createTask(userId, parsed.data);
		set.status = 201;
		return created(task);
	})

	.get("/", async ({ query, userId }) => {
		const parsed = TaskQuerySchema.safeParse(query);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const { tasks, total } = await taskService.listTasks(userId, parsed.data);
		return paginated(tasks, total, parsed.data.page, parsed.data.limit);
	})

	.get("/:id", async ({ params, userId }) => {
		const task = await taskService.getTask(userId, params.id);
		return success(task);
	})

	.patch("/:id", async ({ params, body, userId }) => {
		const parsed = UpdateTaskSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const task = await taskService.updateTask(userId, params.id, parsed.data);
		return success(task);
	})

	.delete("/:id", async ({ params, userId, set }) => {
		await taskService.deleteTask(userId, params.id);
		set.status = 204;
	})

	.post("/:id/restore", async ({ params, userId }) => {
		const task = await taskService.restoreTask(userId, params.id);
		return success(task);
	})

	.post("/:id/decompose", async ({ params, body, userId, set }) => {
		const parsed = DecomposeRequestSchema.safeParse(body ?? {});
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const result = await taskService.decomposeTask(userId, params.id);
		set.status = 202;
		return success(result);
	})

	.get("/:id/subtasks", async ({ params, userId }) => {
		const subtasks = await taskService.getSubtasks(userId, params.id);
		return success(subtasks);
	});
