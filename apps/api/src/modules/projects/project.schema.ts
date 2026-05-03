import { z } from "zod";

export const CreateProjectSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	type: z.enum(["Clients", "Core", "InHouse", "Office"]).default("Core"),
	structureType: z.enum(["SingleRepo", "Monorepo"]).default("SingleRepo"),
	targetCompletionDate: z.string().datetime().optional(),
	color: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/)
		.optional(),
});

export const UpdateProjectSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	structureType: z.enum(["SingleRepo", "Monorepo"]).optional(),
	targetCompletionDate: z.string().datetime().nullable().optional(),
	color: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/)
		.optional(),
	archived: z.boolean().optional(),
});

export const ProjectQuerySchema = z.object({
	type: z.enum(["Clients", "Core", "InHouse", "Office"]).optional(),
	includeArchived: z.coerce.boolean().default(false),
	search: z.string().max(200).optional(),
	searchQuery: z.string().max(200).optional(),
	sortBy: z
		.enum(["updatedAt", "createdAt", "name", "targetCompletionDate"])
		.default("updatedAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const MilestoneStatusSchema = z.enum(["Pending", "Completed", "AtRisk"]);

export const CreateMilestoneSchema = z.object({
	title: z.string().min(1).max(200),
	description: z.string().max(1000).optional(),
	targetDate: z.string().datetime().nullable().optional(),
	status: MilestoneStatusSchema.default("Pending"),
	order: z.number().int().min(0).max(10_000).optional(),
});

export const CreateProjectPartSchema = z.object({
	name: z.string().min(1).max(120),
	description: z.string().max(500).optional(),
	order: z.number().int().min(0).max(10_000).optional(),
});

export const UpdateProjectPartSchema = z.object({
	name: z.string().min(1).max(120).optional(),
	description: z.string().max(500).nullable().optional(),
	order: z.number().int().min(0).max(10_000).optional(),
});

export const CreateProjectEpicSchema = z.object({
	key: z.string().max(40).optional(),
	name: z.string().min(1).max(160),
	description: z.string().max(1000).optional(),
	targetDate: z.string().datetime().nullable().optional(),
	order: z.number().int().min(0).max(10_000).optional(),
});

export const UpdateProjectEpicSchema = z.object({
	key: z.string().max(40).nullable().optional(),
	name: z.string().min(1).max(160).optional(),
	description: z.string().max(1000).nullable().optional(),
	targetDate: z.string().datetime().nullable().optional(),
	order: z.number().int().min(0).max(10_000).optional(),
});

export const BatchApplyProjectTasksSchema = z.object({
	filters: z
		.object({
			state: z
				.enum(["Inbox", "Ongoing", "Ready", "Active", "Blocked", "Paused", "Done"])
				.optional(),
			partId: z.string().uuid().optional(),
			epicId: z.string().uuid().optional(),
			milestoneId: z.string().uuid().optional(),
			size: z.enum(["Small", "Medium", "Large", "Huge"]).optional(),
			searchQuery: z.string().max(200).optional(),
		})
		.default({}),
	apply: z
		.object({
			state: z
				.enum(["Ongoing", "Ready", "Blocked", "Paused", "Done"])
				.optional(),
			partIds: z.array(z.string().uuid()).max(20).nullable().optional(),
			epicIds: z.array(z.string().uuid()).max(20).nullable().optional(),
			milestoneId: z.string().uuid().nullable().optional(),
			priority: z.number().int().min(0).max(100).nullable().optional(),
		})
		.refine((data) => Object.keys(data).length > 0, {
			message: "At least one batch update field must be provided",
		}),
});

export const UpdateMilestoneSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	description: z.string().max(1000).nullable().optional(),
	targetDate: z.string().datetime().nullable().optional(),
	status: MilestoneStatusSchema.optional(),
	order: z.number().int().min(0).max(10_000).optional(),
	completedAt: z.string().datetime().nullable().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type ProjectQuery = z.infer<typeof ProjectQuerySchema>;
export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;
export type CreateProjectPartInput = z.infer<typeof CreateProjectPartSchema>;
export type UpdateProjectPartInput = z.infer<typeof UpdateProjectPartSchema>;
export type CreateProjectEpicInput = z.infer<typeof CreateProjectEpicSchema>;
export type UpdateProjectEpicInput = z.infer<typeof UpdateProjectEpicSchema>;
export type BatchApplyProjectTasksInput = z.infer<
	typeof BatchApplyProjectTasksSchema
>;
