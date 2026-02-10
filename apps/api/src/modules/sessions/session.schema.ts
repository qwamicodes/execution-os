import { z } from "zod";

export const StartSessionSchema = z.object({
	taskId: z.string().uuid(),
	duration: z.number().int().min(5).max(120).default(30),
});

export const CompleteSessionSchema = z
	.object({
		outcome: z.enum(["Done", "Continue", "Blocked", "TooBig"]),
		notes: z.string().max(1000).optional(),
		blockerNote: z.string().max(500).optional(),
	})
	.refine(
		(data) => {
			return (
				data.outcome !== "Blocked" ||
				(data.blockerNote && data.blockerNote.length > 0)
			);
		},
		{
			message: "Blocker note is required when outcome is Blocked",
			path: ["blockerNote"],
		},
	);

export const ScratchpadUpdateSchema = z.object({
	content: z.string().max(10000),
});

export const SessionHistoryQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	taskId: z.string().uuid().optional(),
	outcome: z.enum(["Done", "Continue", "Blocked", "TooBig"]).optional(),
	startDate: z.string().datetime().optional(),
	endDate: z.string().datetime().optional(),
});

export type StartSessionInput = z.infer<typeof StartSessionSchema>;
export type CompleteSessionInput = z.infer<typeof CompleteSessionSchema>;
export type SessionHistoryQuery = z.infer<typeof SessionHistoryQuerySchema>;
