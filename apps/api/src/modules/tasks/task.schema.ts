import { z } from "zod";

export const CreateTaskSchema = z.object({
	title: z.string().min(1).max(500),
	description: z.string().max(10000).optional(),
	projectId: z.string().uuid().optional(),
	partId: z.string().uuid().optional(),
	milestoneId: z.string().uuid().optional(),
	deadline: z.string().datetime().optional(),
	featureBlocked: z.boolean().optional(),
	featureBlockReason: z.string().max(300).nullable().optional(),
	blockingTaskIds: z.array(z.string().uuid()).max(50).optional(),
	blockingTaskId: z.string().uuid().nullable().optional(),
	blocksTaskIds: z.array(z.string().uuid()).max(50).optional(),
	blocksTaskId: z.string().uuid().nullable().optional(),
	tags: z.array(z.string()).max(10).optional(),
	source: z
		.enum(["manual", "slack", "email", "git", "voice", "api", "linear"])
		.default("manual"),
	sourceMetadata: z.record(z.any()).optional(),
});

export const UpdateTaskSchema = z
	.object({
		title: z.string().min(1).max(500).optional(),
		description: z.string().max(10000).optional(),
		projectId: z.string().uuid().nullable().optional(),
		partId: z.string().uuid().nullable().optional(),
		milestoneId: z.string().uuid().nullable().optional(),
		deadline: z.string().datetime().nullable().optional(),
		featureBlocked: z.boolean().optional(),
		featureBlockReason: z.string().max(300).nullable().optional(),
		blockingTaskIds: z.array(z.string().uuid()).max(50).optional(),
		blockingTaskId: z.string().uuid().nullable().optional(),
		blocksTaskIds: z.array(z.string().uuid()).max(50).optional(),
		blocksTaskId: z.string().uuid().nullable().optional(),
		tags: z.array(z.string()).max(10).optional(),
		state: z.enum(["Ongoing", "Ready", "Blocked", "Paused", "Done"]).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided",
	});

export const TaskQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce
		.number()
		.int()
		.refine((value) => value === -1 || (value >= 1 && value <= 100), {
			message: "Limit must be -1 or between 1 and 100",
		})
		.default(50),
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
	searchQuery: z.string().max(200).optional(),
	tag: z.string().max(50).optional(),
});

export const DecomposeRequestSchema = z.object({
	feedback: z.string().max(500).optional(),
});

export const PriorityOverrideSchema = z.object({
	mode: z.enum(["promote", "demote", "set"]),
	score: z.number().int().min(0).max(100).optional(),
	reason: z.string().max(200).optional(),
});

export const RecalculatePrioritySchema = z.object({
	userScope: z.enum(["self"]).default("self"),
});

export const CreateBranchSchema = z.object({
	baseBranch: z.string().max(100).optional().default("main"),
	branchName: z.string().max(100).optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type TaskQuery = z.infer<typeof TaskQuerySchema>;
export type PriorityOverrideInput = z.infer<typeof PriorityOverrideSchema>;
export type CreateBranchInput = z.infer<typeof CreateBranchSchema>;
