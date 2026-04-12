import { createHmac, timingSafeEqual } from "node:crypto";
import Elysia from "elysia";

import { env } from "../../config";
import { authMiddleware } from "../../middleware/auth";
import { basePlugin } from "../../plugins/base";
import {
	ConflictError,
	UnauthorizedError,
	ValidationError,
} from "../../shared/errors";
import { created, success } from "../../shared/response";

import { publishRealtimeEvent } from "../events/realtime.service";

import {
	GitConnectSchema,
	GitImportCommitSchema,
	GmailImportEmailSchema,
	GmailOAuthCallbackQuerySchema,
	IntegrationTypeSchema,
	LinearConnectSchema,
	LinearImportIssueSchema,
	SlackImportMessageSchema,
	SlackOAuthCallbackQuerySchema,
	VoiceConnectSchema,
	VoiceTranscribeSchema,
} from "./integration.schema";
import * as integrationService from "./integration.service";

function queueAutoClassification() {
	return env.AI_AUTO_CLASSIFY_ON_TASK_CREATE;
}

function verifySlackSignature(
	rawBody: string,
	signature?: string,
	timestamp?: string,
) {
	if (!env.SLACK_SIGNING_SECRET) {
		throw new UnauthorizedError("Slack signing secret is not configured");
	}
	if (!signature || !timestamp) {
		throw new UnauthorizedError("Missing Slack signature headers");
	}

	const timestampValue = Number(timestamp);
	if (!Number.isFinite(timestampValue)) {
		throw new UnauthorizedError("Invalid Slack timestamp");
	}

	const ageSeconds = Math.floor(Date.now() / 1000) - timestampValue;
	if (Math.abs(ageSeconds) > 300) {
		throw new UnauthorizedError("Slack request timestamp is too old");
	}

	const baseString = `v0:${timestamp}:${rawBody}`;
	const expected = `v0=${createHmac("sha256", env.SLACK_SIGNING_SECRET).update(baseString).digest("hex")}`;
	const expectedBuf = Buffer.from(expected);
	const providedBuf = Buffer.from(signature);

	if (
		expectedBuf.length !== providedBuf.length ||
		!timingSafeEqual(expectedBuf, providedBuf)
	) {
		throw new UnauthorizedError("Invalid Slack signature");
	}
}

function verifyGitWebhookSignature(
	rawBody: string,
	headers: Record<string, string>,
) {
	if (!env.GIT_WEBHOOK_SECRET) return;

	const gitlabToken = headers["x-gitlab-token"];
	if (gitlabToken && gitlabToken === env.GIT_WEBHOOK_SECRET) {
		return;
	}

	const bitbucketToken = headers["x-bitbucket-token"];
	if (bitbucketToken && bitbucketToken === env.GIT_WEBHOOK_SECRET) {
		return;
	}

	const githubSignature = headers["x-hub-signature-256"];
	if (githubSignature) {
		const expected = `sha256=${createHmac("sha256", env.GIT_WEBHOOK_SECRET).update(rawBody).digest("hex")}`;
		const expectedBuf = Buffer.from(expected);
		const providedBuf = Buffer.from(githubSignature);
		if (
			expectedBuf.length === providedBuf.length &&
			timingSafeEqual(expectedBuf, providedBuf)
		) {
			return;
		}
	}

	throw new UnauthorizedError("Invalid Git webhook signature");
}

export const integrationController = new Elysia({ prefix: "/integrations" })
	.use(basePlugin)
	// public callback/webhook endpoints
	.get(
		"/slack/callback",
		async ({ query, internal_logger }) => {
			internal_logger.set("flow", "integrations_slack_callback");

			const integration = await integrationService.completeSlackOAuth(
				query.code,
				query.state,
				internal_logger,
			);
			internal_logger.set("result", {
				provider: "slack",
				integration_id: integration.id,
				connected: true,
			});

			return success({
				connected: true,
				provider: "slack",
				integrationId: integration.id,
				name: integration.name,
			});
		},
		{ query: SlackOAuthCallbackQuerySchema },
	)

	.get(
		"/gmail/callback",
		async ({ query, internal_logger }) => {
			internal_logger.set("flow", "integrations_gmail_callback");

			const integration = await integrationService.completeGmailOAuth(
				query.code,
				query.state,
				internal_logger,
			);
			internal_logger.set("result", {
				provider: "gmail",
				integration_id: integration.id,
				connected: true,
			});

			return success({
				connected: true,
				provider: "gmail",
				integrationId: integration.id,
				name: integration.name,
			});
		},
		{ query: GmailOAuthCallbackQuerySchema },
	)

	.post("/slack/webhook", async ({ headers, request, internal_logger }) => {
		internal_logger.set("flow", "integrations_slack_webhook");
		const rawBody = await request.text();
		internal_logger.set("webhook", {
			provider: "slack",
			payload_size_bytes: rawBody.length,
		});
		verifySlackSignature(
			rawBody,
			headers["x-slack-signature"],
			headers["x-slack-request-timestamp"],
		);

		let payload: Record<string, unknown>;
		try {
			payload = JSON.parse(rawBody) as Record<string, unknown>;
		} catch {
			throw new ValidationError({ body: ["Invalid JSON payload"] });
		}
		const result = await integrationService.handleSlackWebhook(
			payload,
			internal_logger,
		);
		if ("challenge" in result) {
			internal_logger.set("result", { challenge: true });
			return result;
		}
		if (result.userId && result.importedTaskId) {
			publishRealtimeEvent(result.userId, "task.created", {
				taskId: result.importedTaskId,
				source: "slack",
			});
		}
		internal_logger.set("result", {
			challenge: false,
			imported_task_id: result.importedTaskId ?? null,
		});
		return { ok: true };
	})

	.post(
		"/git/webhook/:integrationId",
		async ({ params, headers, request, internal_logger }) => {
			internal_logger.set("flow", "integrations_git_webhook");
			const rawBody = await request.text();
			internal_logger.set("webhook", {
				provider: "git",
				integration_id: params.integrationId,
				payload_size_bytes: rawBody.length,
			});
			verifyGitWebhookSignature(rawBody, headers as Record<string, string>);

			let payload: Record<string, unknown>;
			try {
				payload = JSON.parse(rawBody) as Record<string, unknown>;
			} catch {
				throw new ValidationError({ body: ["Invalid JSON payload"] });
			}

			const eventName =
				headers["x-github-event"] ??
				headers["x-gitlab-event"] ??
				headers["x-event-key"];
			const result = await integrationService.handleGitWebhook(
				params.integrationId,
				payload,
				eventName,
				internal_logger,
			);
			internal_logger.set("result", {
				user_id: result.userId ?? null,
				task_count: result.taskIds?.length ?? 0,
				event_name: eventName ?? null,
			});
			if (result.userId && (result.taskIds?.length ?? 0) > 0) {
				publishRealtimeEvent(result.userId, "task.bulk_created", {
					taskIds: result.taskIds ?? [],
					source: "git",
					count: result.taskIds?.length ?? 0,
				});
			}
			return result;
		},
	)

	.use(authMiddleware)

	.get("/", async ({ userId, internal_logger }) => {
		internal_logger.set("flow", "integrations_list");
		const integrations = await integrationService.listIntegrations(
			userId,
			internal_logger,
		);
		internal_logger.set("result", { returned: integrations.length });
		return success(integrations);
	})

	.post("/slack/connect", async ({ userId, internal_logger }) => {
		internal_logger.set("flow", "integrations_slack_connect");
		const data = await integrationService.initiateSlackOAuth(
			userId,
			internal_logger,
		);
		internal_logger.set("result", { provider: "slack", initiated: true });
		return success(data);
	})

	.post("/gmail/connect", async ({ userId, internal_logger }) => {
		internal_logger.set("flow", "integrations_gmail_connect");
		const data = await integrationService.initiateGmailOAuth(
			userId,
			internal_logger,
		);
		internal_logger.set("result", { provider: "gmail", initiated: true });
		return success(data);
	})

	.post(
		"/linear/connect",
		async ({ userId, body, internal_logger }) => {
			internal_logger.set("flow", "integrations_linear_connect");

			const integration = await integrationService.connectLinear(
				userId,
				body,
				internal_logger,
			);
			internal_logger.set("result", {
				provider: "linear",
				integration_id: integration.id,
				connected: true,
			});
			publishRealtimeEvent(userId, "integration.updated", {
				provider: "linear",
				connected: true,
			});
			return success({
				connected: true,
				provider: "linear",
				integrationId: integration.id,
				name: integration.name,
			});
		},
		{ body: LinearConnectSchema },
	)

	.post(
		"/git/connect",
		async ({ userId, body, internal_logger, set }) => {
			internal_logger.set("flow", "integrations_git_connect");

			const connected = await integrationService.connectGitRepository(
				userId,
				body,
				internal_logger,
			);
			internal_logger.set("result", {
				provider: connected.provider,
				integration_id: connected.integration.id,
				repository_url: connected.repositoryUrl,
			});
			publishRealtimeEvent(userId, "integration.updated", {
				provider: "git",
				connected: true,
				repositoryUrl: connected.repositoryUrl,
			});
			set.status = 201;
			return created({
				id: connected.integration.id,
				provider: connected.provider,
				repositoryUrl: connected.repositoryUrl,
				webhookUrl: connected.webhookUrl,
				connected: true,
			});
		},
		{ body: GitConnectSchema },
	)

	.post(
		"/voice/connect",
		async ({ userId, body, internal_logger, set }) => {
			internal_logger.set("flow", "integrations_voice_connect");

			const integration = await integrationService.connectVoiceIntegration(
				userId,
				body,
				internal_logger,
			);
			internal_logger.set("result", {
				provider: "voice",
				integration_id: integration.id,
				connected: true,
			});
			publishRealtimeEvent(userId, "integration.updated", {
				provider: "voice",
				connected: true,
			});
			set.status = 201;
			return created({
				connected: true,
				provider: "voice",
				integrationId: integration.id,
				name: integration.name,
			});
		},
		{ body: VoiceConnectSchema },
	)

	.post("/:type/disconnect", async ({ userId, params, internal_logger }) => {
		internal_logger.set("flow", "integrations_disconnect");

		const parsed = IntegrationTypeSchema.safeParse(params.type);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		internal_logger.set("integration", {
			provider: parsed.data,
			user_id: userId,
		});

		await integrationService.disconnectIntegration(
			userId,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", { provider: parsed.data, connected: false });
		publishRealtimeEvent(userId, "integration.updated", {
			provider: parsed.data,
			connected: false,
		});
		return success({
			connected: false,
			provider: parsed.data,
		});
	})

	.post(
		"/slack/import-message",
		async ({ userId, body, internal_logger, set }) => {
			internal_logger.set("flow", "integrations_slack_import_message");

			const task = await integrationService.importSlackMessage(
				userId,
				body,
				internal_logger,
			);
			internal_logger.set("result", { task_id: task.id, source: task.source });
			internal_logger.set("auto_classification", {
				queued: queueAutoClassification(),
			});
			publishRealtimeEvent(userId, "task.created", {
				taskId: task.id,
				source: task.source,
			});
			set.status = 201;
			return created({
				taskId: task.id,
				title: task.title,
				source: task.source,
				state: task.state,
			});
		},
		{ body: SlackImportMessageSchema },
	)

	.post(
		"/gmail/process-email",
		async ({ userId, body, internal_logger, set }) => {
			internal_logger.set("flow", "integrations_gmail_process_email");

			const task = await integrationService.importGmailEmail(
				userId,
				body,
				internal_logger,
			);
			internal_logger.set("result", { task_id: task.id, source: task.source });
			internal_logger.set("auto_classification", {
				queued: queueAutoClassification(),
			});
			publishRealtimeEvent(userId, "task.created", {
				taskId: task.id,
				source: task.source,
			});
			set.status = 201;
			return created({
				taskId: task.id,
				title: task.title,
				source: task.source,
				state: task.state,
			});
		},
		{ body: GmailImportEmailSchema },
	)

	.post(
		"/linear/import-issue",
		async ({ userId, body, internal_logger, set }) => {
			internal_logger.set("flow", "integrations_linear_import_issue");

			const task = await integrationService.importLinearIssue(
				userId,
				body,
				internal_logger,
			);
			internal_logger.set("result", { task_id: task.id, source: task.source });
			internal_logger.set("auto_classification", {
				queued: queueAutoClassification(),
			});
			publishRealtimeEvent(userId, "task.created", {
				taskId: task.id,
				source: task.source,
			});
			set.status = 201;
			return created({
				taskId: task.id,
				title: task.title,
				source: task.source,
				state: task.state,
			});
		},
		{ body: LinearImportIssueSchema },
	)

	.post(
		"/git/import-commit",
		async ({ userId, body, internal_logger, set }) => {
			internal_logger.set("flow", "integrations_git_import_commit");

			const task = await integrationService.importGitCommit(
				userId,
				body,
				internal_logger,
			);
			internal_logger.set("result", { task_id: task.id, source: task.source });
			internal_logger.set("auto_classification", {
				queued: queueAutoClassification(),
			});
			publishRealtimeEvent(userId, "task.created", {
				taskId: task.id,
				source: task.source,
			});
			set.status = 201;
			return created({
				taskId: task.id,
				title: task.title,
				source: task.source,
				state: task.state,
			});
		},
		{ body: GitImportCommitSchema },
	)

	.post(
		"/voice/transcribe",
		async ({ userId, body, headers, request, internal_logger, set }) => {
			internal_logger.set("flow", "integrations_voice_transcribe_request");
			let input: {
				projectId?: string;
				language?: string;
				transcription?: string;
				title?: string;
				audioFilename?: string;
				externalId?: string;
			};

			const contentType = headers["content-type"] || "";
			if (contentType.includes("multipart/form-data")) {
				const form = await request.formData();
				const audio = form.get("audio");
				const title = form.get("title");
				const transcription = form.get("transcription");
				const projectId = form.get("projectId");
				const language = form.get("language");
				const externalId = form.get("externalId");

				input = {
					projectId: typeof projectId === "string" ? projectId : undefined,
					language: typeof language === "string" ? language : undefined,
					transcription:
						typeof transcription === "string" ? transcription : undefined,
					title:
						typeof title === "string"
							? title
							: audio instanceof File
								? `Voice note: ${audio.name}`
								: undefined,
					audioFilename: audio instanceof File ? audio.name : undefined,
					externalId: typeof externalId === "string" ? externalId : undefined,
				};
			} else {
				input = (body ?? {}) as typeof input;
			}

			internal_logger.set("voice_input", {
				user_id: userId,
				has_transcription: Boolean(body.transcription),
				has_audio_filename: Boolean(body.audioFilename),
				language: body.language ?? null,
			});

			const job = await integrationService.requestVoiceTranscription(
				userId,
				body,
				internal_logger,
			);
			internal_logger.set("result", { job_id: job.jobId, status: job.status });
			publishRealtimeEvent(userId, "integration.voice.transcribe_requested", {
				jobId: job.jobId,
			});
			set.status = 202;
			return success(job);
		},
		{ body: VoiceTranscribeSchema },
	)

	.get(
		"/voice/transcribe/:jobId",
		async ({ userId, params, internal_logger }) => {
			internal_logger.set("flow", "integrations_voice_transcribe_status");
			internal_logger.set("voice_job", {
				job_id: params.jobId,
				user_id: userId,
			});
			const job = await integrationService.getVoiceTranscriptionJob(
				userId,
				params.jobId,
				internal_logger,
			);
			internal_logger.set("result", {
				job_id: job.jobId,
				status: job.status,
				task_count: (job.tasks ?? []).length,
			});
			if (job.status === "completed") {
				publishRealtimeEvent(userId, "integration.voice.transcribe_completed", {
					jobId: job.jobId,
					taskIds: (job.tasks ?? []).map((task) => task.id),
				});
			}
			return success(job);
		},
	)

	// convenience endpoint for one-off mixed imports
	.post(
		"/linear/import-issues",
		async ({ userId, body, internal_logger, set }) => {
			internal_logger.set("flow", "integrations_linear_import_issues");
			internal_logger.set("linear_user", { user_id: userId });
			internal_logger.set("bulk_input", { requested: body.length });

			const createdTasks = [];

			for (const issue of body) {
				try {
					const task = await integrationService.importLinearIssue(
						userId,
						issue,
						internal_logger,
					);
					queueAutoClassification();
					createdTasks.push({
						taskId: task.id,
						title: task.title,
						source: task.source,
						state: task.state,
					});
				} catch (error) {
					if (error instanceof ConflictError) {
						// duplicate import, skip idempotently
						continue;
					}
					throw error;
				}
			}

			if (createdTasks.length > 0) {
				publishRealtimeEvent(userId, "task.bulk_created", {
					taskIds: createdTasks.map((task) => task.taskId),
					source: "linear",
					count: createdTasks.length,
				});
			}
			internal_logger.set("result", {
				imported: createdTasks.length,
			});

			set.status = 201;
			return created({ imported: createdTasks.length, tasks: createdTasks });
		},
		{ body: LinearImportIssueSchema.array().min(1).max(100) },
	);
