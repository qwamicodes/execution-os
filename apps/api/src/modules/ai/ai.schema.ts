import { z } from "zod";

export const AITestPromptSchema = z.object({
	prompt: z.string().min(1).max(4000),
	systemPrompt: z.string().max(2000).optional(),
	jsonMode: z.boolean().optional(),
});

export const AIRecommendationQuerySchema = z.object({
	forceRefresh: z.coerce.boolean().optional(),
});

export type AITestPromptInput = z.infer<typeof AITestPromptSchema>;
export type AIRecommendationQuery = z.infer<typeof AIRecommendationQuerySchema>;
