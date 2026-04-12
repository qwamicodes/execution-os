import { z } from "zod";

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
	deadline: z
		.string()
		.datetime()
		.nullable()
		.optional(),
	tags: z.array(z.string()).max(10).optional(),
});

export type ManualClassificationInput = z.infer<
	typeof ManualClassificationSchema
>;
