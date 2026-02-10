import { z } from "zod";

export const CreateProjectSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	type: z.enum(["Core", "SideQuest"]).default("Core"),
	color: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/)
		.optional(),
});

export const UpdateProjectSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	color: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/)
		.optional(),
	archived: z.boolean().optional(),
});

export const ProjectQuerySchema = z.object({
	type: z.enum(["Core", "SideQuest"]).optional(),
	includeArchived: z.coerce.boolean().default(false),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type ProjectQuery = z.infer<typeof ProjectQuerySchema>;
