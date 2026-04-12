import Elysia from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { basePlugin } from "../../plugins/base";
import { publishRealtimeEvent } from "../events/realtime.service";
import { ValidationError } from "../../shared/errors";
import { created, paginated, success } from "../../shared/response";
import {
	CreateBranchSchema,
	CreateTaskSchema,
	DecomposeRequestSchema,
	PriorityOverrideSchema,
	RecalculatePrioritySchema,
	TaskQuerySchema,
	UpdateTaskSchema,
} from "./task.schema";
import * as taskService from "./task.service";

export const taskController = new Elysia({ prefix: "/tasks" })
	.use(basePlugin)
	.use(authMiddleware)

	.post(
		"/",
		async ({ body, userId, internal_logger, set }) => {
			internal_logger.set("flow", "tasks_create");

			internal_logger.set("task_input", {
				user_id: userId,
				has_project_id: Boolean(body.projectId),
				source: body.source ?? "manual",
			});

			const task = await taskService.createTask(userId, body, internal_logger);
			internal_logger.set("result", {
				task_id: task.id,
				state: task.state,
			});
			publishRealtimeEvent(userId, "task.created", {
				taskId: task.id,
				state: task.state,
			});
			set.status = 201;
			return created(task);
		},
		{ body: CreateTaskSchema },
	)

	.get("/", async ({ query, userId, internal_logger }) => {
		internal_logger.set("flow", "tasks_list");
		const parsed = TaskQuerySchema.safeParse(query);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("query", parsed.data);

		const { tasks, total } = await taskService.listTasks(
			userId,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", { total, returned: tasks.length });
		return paginated(tasks, total, parsed.data.page, parsed.data.limit);
	})

	.get("/:id", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "tasks_get");
		internal_logger.set("task_ref", { task_id: params.id, user_id: userId });
		const task = await taskService.getTask(userId, params.id, internal_logger);
		internal_logger.set("result", { task_id: task.id, state: task.state });
		return success(task);
	})

	.patch("/:id", async ({ params, body, userId, internal_logger }) => {
		internal_logger.set("flow", "tasks_update");
		const parsed = UpdateTaskSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("task_update", {
			task_id: params.id,
			user_id: userId,
			fields: Object.keys(parsed.data),
			next_state: parsed.data.state ?? null,
		});

		const task = await taskService.updateTask(
			userId,
			params.id,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", { task_id: task.id, state: task.state });
		publishRealtimeEvent(userId, "task.updated", {
			taskId: task.id,
			state: task.state,
		});
		if (parsed.data.state) {
			publishRealtimeEvent(userId, "task.state_changed", {
				taskId: task.id,
				toState: parsed.data.state,
			});
		}
		return success(task);
	})

	.delete("/:id", async ({ params, userId, internal_logger, set }) => {
		internal_logger.set("flow", "tasks_delete");
		internal_logger.set("task_ref", { task_id: params.id, user_id: userId });
		await taskService.deleteTask(userId, params.id, internal_logger);
		internal_logger.set("result", { task_id: params.id, deleted: true });
		publishRealtimeEvent(userId, "task.deleted", {
			taskId: params.id,
		});
		set.status = 204;
	})

	.post("/:id/restore", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "tasks_restore");
		internal_logger.set("task_ref", { task_id: params.id, user_id: userId });
		const task = await taskService.restoreTask(
			userId,
			params.id,
			internal_logger,
		);
		internal_logger.set("result", { task_id: task.id, state: task.state });
		publishRealtimeEvent(userId, "task.restored", {
			taskId: task.id,
			state: task.state,
		});
		return success(task);
	})

	.post("/:id/convert-to-idea", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "tasks_convert_to_idea");
		const result = await taskService.convertTaskToIdea(
			userId,
			params.id,
			internal_logger,
		);
		return success(result);
	})

	.post("/migrations/legacy-ideas", async ({ userId, internal_logger }) => {
		internal_logger.set("flow", "tasks_migrate_legacy_ideas");
		const result = await taskService.migrateLegacyIdeaTasks(
			userId,
			internal_logger,
		);
		return success(result);
	})

	.post(
		"/:id/create-branch",
		async ({ params, body, userId, internal_logger }) => {
			internal_logger.set("flow", "tasks_create_branch");
			const parsed = CreateBranchSchema.safeParse(body ?? {});
			if (!parsed.success) {
				throw new ValidationError(parsed.error.flatten().fieldErrors);
			}
			internal_logger.set("branch_request", {
				task_id: params.id,
				user_id: userId,
				base_branch: parsed.data.baseBranch ?? null,
				has_custom_branch_name: Boolean(parsed.data.branchName),
			});

			const branch = await taskService.createTaskBranch(
				userId,
				params.id,
				parsed.data,
				internal_logger,
			);
			internal_logger.set("result", {
				task_id: params.id,
				branch_name: branch.branchName,
				provider: branch.provider,
			});
			publishRealtimeEvent(userId, "task.branch_created", {
				taskId: params.id,
				branchName: branch.branchName,
			});
			return created(branch);
		},
	)

	.post("/:id/decompose", async ({ params, body, userId, internal_logger }) => {
		internal_logger.set("flow", "tasks_decompose");
		const parsed = DecomposeRequestSchema.safeParse(body ?? {});
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("decompose_request", {
			task_id: params.id,
			user_id: userId,
			has_feedback: Boolean(parsed.data.feedback),
		});

		const result = await taskService.decomposeTask(
			userId,
			params.id,
			parsed.data.feedback,
			internal_logger,
		);
		internal_logger.set("result", {
			task_id: params.id,
			job_id: result.jobId,
		});
		return success(result);
	})

	.post("/:id/classify/ai", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "tasks_ai_classify");
		internal_logger.set("task_ref", { task_id: params.id, user_id: userId });
		const task = await taskService.autoClassifyTask(
			userId,
			params.id,
			internal_logger,
		);
		internal_logger.set("result", { task_id: task.id, state: task.state });
		publishRealtimeEvent(userId, "task.classified_ai", {
			taskId: task.id,
			state: task.state,
		});
		return success(task);
	})

	.get("/:id/subtasks", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "tasks_subtasks");
		const subtasks = await taskService.getSubtasks(
			userId,
			params.id,
			internal_logger,
		);
		internal_logger.set("result", {
			task_id: params.id,
			subtask_count: subtasks.length,
		});
		return success(subtasks);
	})

	.get("/:id/priority/explain", async ({ params, userId, internal_logger }) => {
		internal_logger.set("flow", "tasks_priority_explain");
		const explanation = await taskService.explainTaskPriority(
			userId,
			params.id,
			internal_logger,
		);
		internal_logger.set("result", {
			task_id: params.id,
			score: explanation.score,
			layer: explanation.layer,
		});
		return success(explanation);
	})

	.post(
		"/:id/priority/override",
		async ({ params, body, userId, internal_logger }) => {
			internal_logger.set("flow", "tasks_priority_override");
			const parsed = PriorityOverrideSchema.safeParse(body ?? {});
			if (!parsed.success) {
				throw new ValidationError(parsed.error.flatten().fieldErrors);
			}
			internal_logger.set("priority_override", {
				task_id: params.id,
				user_id: userId,
				mode: parsed.data.mode,
				score: parsed.data.score ?? null,
				has_reason: Boolean(parsed.data.reason),
			});

			const result = await taskService.overrideTaskPriority(
				userId,
				params.id,
				parsed.data,
				internal_logger,
			);
			internal_logger.set("result", {
				task_id: params.id,
				priority: result.task.priority,
			});
			return success(result);
		},
	)

	.delete(
		"/:id/priority/override",
		async ({ params, userId, internal_logger }) => {
			internal_logger.set("flow", "tasks_priority_override_clear");
			const task = await taskService.clearTaskPriorityOverride(
				userId,
				params.id,
				internal_logger,
			);
			internal_logger.set("result", {
				task_id: task?.id ?? params.id,
				override_cleared: true,
			});
			return success(task);
		},
	)

	.post(
		"/priorities/recalculate",
		async ({ body, userId, internal_logger }) => {
			internal_logger.set("flow", "tasks_priorities_recalculate");
			const parsed = RecalculatePrioritySchema.safeParse(body ?? {});
			if (!parsed.success) {
				throw new ValidationError(parsed.error.flatten().fieldErrors);
			}
			internal_logger.set("recalc_request", parsed.data);

			const result = await taskService.recalculatePrioritiesForUser(
				userId,
				internal_logger,
			);
			internal_logger.set("result", result);
			return success(result);
		},
	);
