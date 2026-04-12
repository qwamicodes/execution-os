import Elysia from "elysia";

import { authMiddleware } from "../../middleware/auth";
import { basePlugin } from "../../plugins/base";
import { success } from "../../shared/response";

import { AIRecommendationQuerySchema, AITestPromptSchema } from "./ai.schema";
import {
	generateText,
	getAIRoutingStatus,
	recommendTaskForFocus,
} from "./ai.service";

export const aiController = new Elysia({ prefix: "/ai" })
	.use(basePlugin)
	.use(authMiddleware)

	.get("/providers", ({ internal_logger }) => {
		internal_logger.set("flow", "ai_providers");
		const status = getAIRoutingStatus();
		internal_logger.set("result", {
			mode: status.routingMode,
			order: status.providerOrder,
		});
		return success(status);
	})

	.get(
		"/recommendation",
		async ({ query, userId, internal_logger }) => {
			internal_logger.set("flow", "ai_recommendation");

			internal_logger.set("query", {
				force_refresh: Boolean(query.forceRefresh),
			});

			const recommendation = await recommendTaskForFocus(
				userId,
				{
					forceRefresh: query.forceRefresh,
				},
				internal_logger,
			);
			internal_logger.set("result", {
				has_now: Boolean(recommendation.recommendedTask),
				next_count: recommendation.nextTasks.length,
			});
			return success(recommendation);
		},
		{ query: AIRecommendationQuerySchema },
	)

	.post(
		"/test",
		async ({ body, internal_logger }) => {
			internal_logger.set("flow", "ai_test_prompt");

			internal_logger.set("ai_test", {
				prompt_length: body.prompt.length,
				has_system_prompt: Boolean(body.systemPrompt),
				json_mode: Boolean(body.jsonMode),
			});

			const { prompt, systemPrompt, jsonMode } = body;
			const result = await generateText(
				{
					operation: "general",
					systemPrompt:
						systemPrompt ??
						(jsonMode
							? "You are a concise assistant. Respond with one JSON object."
							: "You are a concise assistant."),
					userPrompt: prompt,
					jsonMode,
					maxTokens: 900,
				},
				internal_logger,
			);
			internal_logger.set("result", {
				provider: result.provider,
				model: result.model,
				latency_ms: result.latencyMs,
			});

			return success(result);
		},
		{ body: AITestPromptSchema },
	);
