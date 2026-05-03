import { z } from "zod";

export const InboxQuerySchema = z.object({
	sortBy: z
		.enum(["createdAt", "updatedAt", "deadline", "priority", "title"])
		.default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	projectId: z.string().uuid().optional(),
	size: z.enum(["Small", "Medium", "Large", "Huge"]).optional(),
	protected: z.coerce.boolean().optional(),
	hasDeadline: z.coerce.boolean().optional(),
	search: z.string().max(200).optional(),
	searchQuery: z.string().max(200).optional(),
	tag: z.string().max(50).optional(),
	source: z.string().max(50).optional(),
	triageStatus: z.enum(["pending", "needsReview", "classified"]).optional(),
});

export const ManualClassificationSchema = z.object({
	title: z.string().min(3).max(180).optional(),
	description: z.string().max(2000).nullable().optional(),
	projectId: z.string().uuid().nullable().optional(),
	size: z.enum(["Small", "Medium", "Large", "Huge"]).optional(),
	urgency: z.enum(["Urgent", "High", "Medium", "Low"]).optional(),
	protected: z.boolean().optional(),
	protectionReason: z
		.enum(["contract", "sla", "client", "investor"])
		.nullable()
		.optional(),
	deadline: z.string().datetime().nullable().optional(),
	tags: z.array(z.string()).max(10).optional(),
});

export type ManualClassificationInput = z.infer<
	typeof ManualClassificationSchema
>;
export type InboxQuery = z.infer<typeof InboxQuerySchema>;
