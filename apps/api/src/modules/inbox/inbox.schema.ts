import { z } from "zod";

export const ManualClassificationSchema = z.object({
	projectId: z.string().uuid().nullable().optional(),
	size: z.enum(["Small", "Medium", "Large", "Huge"]).optional(),
	urgency: z.enum(["Urgent", "High", "Medium", "Low"]).optional(),
	protected: z.boolean().optional(),
	tags: z.array(z.string()).max(10).optional(),
});

export type ManualClassificationInput = z.infer<
	typeof ManualClassificationSchema
>;
