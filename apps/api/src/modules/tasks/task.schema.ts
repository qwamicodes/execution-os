import { z } from "zod";

export const CreateTaskSchema = z.object({
	title: z.string().min(1).max(500),
	description: z.string().max(10000).optional(),
	projectId: z.string().uuid().optional(),
	deadline: z.string().datetime().optional(),
	tags: z.array(z.string()).max(10).optional(),
	source: z
		.enum(["manual", "slack", "email", "git", "voice", "api"])
		.default("manual"),
	sourceMetadata: z.record(z.any()).optional(),
});

export const UpdateTaskSchema = z
	.object({
		title: z.string().min(1).max(500).optional(),
		description: z.string().max(10000).optional(),
		projectId: z.string().uuid().nullable().optional(),
		deadline: z.string().datetime().nullable().optional(),
		tags: z.array(z.string()).max(10).optional(),
		state: z.enum(["Ongoing", "Ready", "Blocked", "Paused", "Done"]).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided",
	});

export const TaskQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	sortBy: z
		.enum(["createdAt", "updatedAt", "deadline", "priority", "title"])
		.default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	state: z
		.enum(["Inbox", "Ongoing", "Ready", "Active", "Blocked", "Paused", "Done"])
		.optional(),
	projectId: z.string().uuid().optional(),
	size: z.enum(["Small", "Medium", "Large", "Huge"]).optional(),
	protected: z.coerce.boolean().optional(),
	hasDeadline: z.coerce.boolean().optional(),
	search: z.string().max(200).optional(),
});

export const DecomposeRequestSchema = z.object({
	feedback: z.string().max(500).optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type TaskQuery = z.infer<typeof TaskQuerySchema>;
