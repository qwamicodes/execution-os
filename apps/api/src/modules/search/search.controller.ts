import Elysia from "elysia";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth";
import { basePlugin } from "../../plugins/base";
import { prisma } from "../../shared/database";
import { ValidationError } from "../../shared/errors";
import { success } from "../../shared/response";

const SearchQuerySchema = z.object({
	q: z.string().min(1).max(200),
	scope: z.enum(["tasks", "projects", "all"]).default("all"),
	limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const searchController = new Elysia({ prefix: "/search" })
	.use(basePlugin)
	.use(authMiddleware)

	.get("/", async ({ query, userId, internal_logger }) => {
		internal_logger.set("flow", "search");
		const parsed = SearchQuerySchema.safeParse(query);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const { q, scope, limit } = parsed.data;
		internal_logger.set("search_input", {
			user_id: userId,
			query_length: q.length,
			scope,
			limit,
		});
		const startTime = performance.now();

		let tasks: Array<{
			id: string;
			title: string;
			description: string | null;
			state: string;
			priority: number | null;
		}> = [];

		let projects: Array<{
			id: string;
			name: string;
			description: string | null;
			_count: { tasks: number };
		}> = [];

		if (scope === "tasks" || scope === "all") {
			tasks = await prisma.task.findMany({
				where: {
					userId,
					deletedAt: null,
					OR: [
						{ title: { contains: q, mode: "insensitive" } },
						{ description: { contains: q, mode: "insensitive" } },
					],
				},
				take: limit,
				orderBy: { updatedAt: "desc" },
				select: {
					id: true,
					title: true,
					description: true,
					state: true,
					priority: true,
				},
			});
		}

		if (scope === "projects" || scope === "all") {
			projects = await prisma.project.findMany({
				where: {
					userId,
					deletedAt: null,
					OR: [
						{ name: { contains: q, mode: "insensitive" } },
						{ description: { contains: q, mode: "insensitive" } },
					],
				},
				take: limit,
				orderBy: { updatedAt: "desc" },
				select: {
					id: true,
					name: true,
					description: true,
					_count: { select: { tasks: true } },
				},
			});
		}

		const searchTimeMs = Math.round(performance.now() - startTime);
		internal_logger?.set("result", {
			task_count: tasks.length,
			project_count: projects.length,
			total_results: tasks.length + projects.length,
			search_time_ms: searchTimeMs,
		});

		return success({
			tasks: tasks.map((t) => ({
				id: t.id,
				title: t.title,
				snippet: t.description?.slice(0, 200) ?? null,
				state: t.state,
				priority: t.priority,
			})),
			projects: projects.map((p) => ({
				id: p.id,
				name: p.name,
				taskCount: p._count.tasks,
			})),
			meta: {
				query: q,
				totalResults: tasks.length + projects.length,
				searchTimeMs,
			},
		});
	});
