import { randomUUID } from "node:crypto";
import type { IntegrationType, Prisma } from "@repo/database";
import { env } from "../../config";
import { prisma } from "../../shared/database";
import {
	ConflictError,
	NotFoundError,
	UnprocessableError,
} from "../../shared/errors";
import { logger } from "../../shared/logger";
import { redis } from "../../shared/redis";
import type { RequestLogger } from "../../shared/wide-event";
import type {
	GitConnectInput,
	GitImportCommitInput,
	GitProviderInput,
	GmailImportEmailInput,
	LinearConnectInput,
	LinearImportIssueInput,
	SlackImportMessageInput,
	VoiceConnectInput,
	VoiceTranscribeInput,
} from "./integration.schema";

const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const DEFAULT_SCOPES = {
	slack:
		"channels:read,channels:history,groups:read,groups:history,reactions:read,users:read,chat:write",
	gmail:
		"https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email",
};

type DirectIntegration = "slack" | "gmail" | "linear" | "voice";
type SupportedIntegration = DirectIntegration | "git";

type VoiceJobStatus = "processing" | "completed" | "failed";

interface VoiceJobRecord {
	jobId: string;
	userId: string;
	status: VoiceJobStatus;
	queuedAt: string;
	completedAt?: string;
	error?: string;
	transcription?: string;
	tasks?: Array<{
		id: string;
		title: string;
		state: string;
	}>;
	audioFilename?: string;
}

function toIntegrationType(type: DirectIntegration): IntegrationType {
	if (type === "slack") return "Slack";
	if (type === "gmail") return "Gmail";
	if (type === "linear") return "Linear";
	return "Voice";
}

function gitProviderToIntegrationType(
	provider: GitProviderInput,
): IntegrationType {
	if (provider === "github") return "GitHub";
	if (provider === "gitlab") return "GitLab";
	return "Bitbucket";
}

function integrationTypeToGitProvider(
	type: IntegrationType,
): GitProviderInput | null {
	if (type === "GitHub") return "github";
	if (type === "GitLab") return "gitlab";
	if (type === "Bitbucket") return "bitbucket";
	return null;
}

function oauthStateKey(provider: "slack" | "gmail", state: string): string {
	return `oauth:${provider}:state:${state}`;
}

function voiceJobKey(jobId: string): string {
	return `integration:voice:job:${jobId}`;
}

function buildDefaultTitleFromText(text: string): string {
	const firstLine = text.split("\n")[0]?.trim() ?? text.trim();
	return firstLine.slice(0, 500);
}

function uniqueTags(tags: string[]): string[] {
	return [
		...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
	]
		.slice(0, 10)
		.map((tag) => tag.slice(0, 50));
}

function isObject(value: Prisma.JsonValue | unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function repositoryNameFromUrl(repositoryUrl: string): string {
	try {
		const pathname = new URL(repositoryUrl).pathname;
		const parts = pathname.split("/").filter(Boolean);
		const rawName = parts[parts.length - 1] ?? "Repository";
		return rawName.replace(/\.git$/i, "") || "Repository";
	} catch {
		return "Repository";
	}
}

function buildBranchSlug(taskId: string, title: string) {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "")
		.slice(0, 60);
	return `task-${taskId.slice(0, 8)}/${slug || "work"}`;
}

async function saveVoiceJob(record: VoiceJobRecord) {
	await redis.setex(
		voiceJobKey(record.jobId),
		env.VOICE_TRANSCRIPTION_JOB_TTL_SECONDS,
		JSON.stringify(record),
	);
}

async function loadVoiceJob(jobId: string): Promise<VoiceJobRecord | null> {
	const raw = await redis.get(voiceJobKey(jobId));
	if (!raw) return null;

	try {
		return JSON.parse(raw) as VoiceJobRecord;
	} catch {
		return null;
	}
}

async function ensureProjectBelongsToUser(userId: string, projectId?: string) {
	if (!projectId) return;
	const project = await prisma.project.findFirst({
		where: { id: projectId, userId, deletedAt: null },
		select: { id: true },
	});
	if (!project) {
		throw new NotFoundError("Project");
	}
}

async function upsertIntegration(params: {
	userId: string;
	type: IntegrationType;
	name: string;
	accessToken?: string;
	refreshToken?: string;
	tokenExpiry?: Date;
	config?: Prisma.InputJsonValue;
}) {
	const existing = await prisma.integration.findFirst({
		where: { userId: params.userId, type: params.type },
		select: { id: true },
	});

	if (existing) {
		return prisma.integration.update({
			where: { id: existing.id },
			data: {
				name: params.name,
				accessToken: params.accessToken,
				refreshToken: params.refreshToken,
				tokenExpiry: params.tokenExpiry,
				config: params.config,
				enabled: true,
				lastSyncAt: new Date(),
			},
		});
	}

	return prisma.integration.create({
		data: {
			userId: params.userId,
			type: params.type,
			name: params.name,
			accessToken: params.accessToken,
			refreshToken: params.refreshToken,
			tokenExpiry: params.tokenExpiry,
			config: params.config,
			enabled: true,
			lastSyncAt: new Date(),
		},
	});
}

export async function listIntegrations(
	userId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "list_integrations",
		user_id: userId,
	});
	const integrations = await prisma.integration.findMany({
		where: { userId },
		orderBy: { createdAt: "asc" },
		select: {
			id: true,
			type: true,
			name: true,
			enabled: true,
			lastSyncAt: true,
			createdAt: true,
			updatedAt: true,
			config: true,
		},
	});

	return integrations.map((integration) => ({
		...integration,
		connected: integration.enabled,
	}));
}

export async function disconnectIntegration(
	userId: string,
	type: SupportedIntegration,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "disconnect_integration",
		user_id: userId,
		type,
	});
	if (type === "git") {
		const result = await prisma.integration.updateMany({
			where: {
				userId,
				type: { in: ["GitHub", "GitLab", "Bitbucket"] },
				enabled: true,
			},
			data: {
				enabled: false,
				accessToken: null,
				refreshToken: null,
				tokenExpiry: null,
			},
		});
		if (result.count === 0) {
			throw new NotFoundError("Git integration");
		}
		return;
	}

	const dbType = toIntegrationType(type);
	const integration = await prisma.integration.findFirst({
		where: { userId, type: dbType, enabled: true },
		select: { id: true },
	});

	if (!integration) {
		throw new NotFoundError(`${dbType} integration`);
	}

	await prisma.integration.update({
		where: { id: integration.id },
		data: {
			enabled: false,
			accessToken: null,
			refreshToken: null,
			tokenExpiry: null,
		},
	});
}

async function getEnabledIntegration(userId: string, type: DirectIntegration) {
	const dbType = toIntegrationType(type);
	const integration = await prisma.integration.findFirst({
		where: { userId, type: dbType, enabled: true },
	});
	if (!integration) {
		throw new ConflictError(`${dbType} integration is not connected`);
	}
	return integration;
}

async function getEnabledGitIntegration(
	userId: string,
	provider?: GitProviderInput,
) {
	const where: Prisma.IntegrationWhereInput = {
		userId,
		enabled: true,
		type: provider
			? gitProviderToIntegrationType(provider)
			: { in: ["GitHub", "GitLab", "Bitbucket"] },
	};

	const integration = await prisma.integration.findFirst({
		where,
		orderBy: { updatedAt: "desc" },
	});

	if (!integration) {
		throw new ConflictError("Git integration is not connected");
	}
	return integration;
}

export async function initiateSlackOAuth(
	userId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "initiate_slack_oauth",
		user_id: userId,
	});
	if (
		!env.SLACK_CLIENT_ID ||
		!env.SLACK_CLIENT_SECRET ||
		!env.SLACK_REDIRECT_URI
	) {
		throw new UnprocessableError(
			"Slack OAuth is not configured (missing client id/secret/redirect)",
		);
	}

	const state = randomUUID();
	await redis.setex(
		oauthStateKey("slack", state),
		OAUTH_STATE_TTL_SECONDS,
		userId,
	);

	const url = new URL("https://slack.com/oauth/v2/authorize");
	url.searchParams.set("client_id", env.SLACK_CLIENT_ID);
	url.searchParams.set("scope", env.SLACK_SCOPES || DEFAULT_SCOPES.slack);
	url.searchParams.set("redirect_uri", env.SLACK_REDIRECT_URI);
	url.searchParams.set("state", state);

	return {
		authUrl: url.toString(),
		state,
	};
}

export async function completeSlackOAuth(
	code: string,
	state: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "complete_slack_oauth",
		code_length: code.length,
		state_length: state.length,
	});
	const userId = await redis.get(oauthStateKey("slack", state));
	if (!userId) {
		throw new ConflictError("Invalid or expired Slack OAuth state");
	}

	const response = await fetch("https://slack.com/api/oauth.v2.access", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: env.SLACK_CLIENT_ID ?? "",
			client_secret: env.SLACK_CLIENT_SECRET ?? "",
			code,
			redirect_uri: env.SLACK_REDIRECT_URI ?? "",
		}),
	});

	const payload = (await response.json()) as {
		ok?: boolean;
		error?: string;
		access_token?: string;
		team?: { id?: string; name?: string };
		authed_user?: { id?: string };
		bot_user_id?: string;
	};

	if (!response.ok || !payload.ok || !payload.access_token) {
		throw new UnprocessableError(
			`Slack OAuth exchange failed: ${payload.error ?? "unknown error"}`,
		);
	}

	const integration = await upsertIntegration({
		userId,
		type: "Slack",
		name: payload.team?.name || "Slack Workspace",
		accessToken: payload.access_token,
		config: {
			teamId: payload.team?.id,
			teamName: payload.team?.name,
			slackUserId: payload.authed_user?.id,
			botUserId: payload.bot_user_id,
		},
	});

	await redis.del(oauthStateKey("slack", state));
	return integration;
}

export async function initiateGmailOAuth(
	userId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "initiate_gmail_oauth",
		user_id: userId,
	});
	if (
		!env.GOOGLE_CLIENT_ID ||
		!env.GOOGLE_CLIENT_SECRET ||
		!env.GOOGLE_REDIRECT_URI
	) {
		throw new UnprocessableError(
			"Gmail OAuth is not configured (missing client id/secret/redirect)",
		);
	}

	const state = randomUUID();
	await redis.setex(
		oauthStateKey("gmail", state),
		OAUTH_STATE_TTL_SECONDS,
		userId,
	);

	const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
	url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
	url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("access_type", "offline");
	url.searchParams.set("prompt", "consent");
	url.searchParams.set("scope", env.GOOGLE_SCOPES || DEFAULT_SCOPES.gmail);
	url.searchParams.set("state", state);

	return {
		authUrl: url.toString(),
		state,
	};
}

export async function completeGmailOAuth(
	code: string,
	state: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "complete_gmail_oauth",
		code_length: code.length,
		state_length: state.length,
	});
	const userId = await redis.get(oauthStateKey("gmail", state));
	if (!userId) {
		throw new ConflictError("Invalid or expired Gmail OAuth state");
	}

	const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: env.GOOGLE_CLIENT_ID ?? "",
			client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
			code,
			redirect_uri: env.GOOGLE_REDIRECT_URI ?? "",
			grant_type: "authorization_code",
		}),
	});

	const tokenPayload = (await tokenResponse.json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
		scope?: string;
		error?: string;
	};

	if (!tokenResponse.ok || !tokenPayload.access_token) {
		throw new UnprocessableError(
			`Gmail OAuth exchange failed: ${tokenPayload.error ?? "unknown error"}`,
		);
	}

	const integration = await upsertIntegration({
		userId,
		type: "Gmail",
		name: "Gmail",
		accessToken: tokenPayload.access_token,
		refreshToken: tokenPayload.refresh_token,
		tokenExpiry: tokenPayload.expires_in
			? new Date(Date.now() + tokenPayload.expires_in * 1000)
			: undefined,
		config: {
			scope: tokenPayload.scope,
		},
	});

	await redis.del(oauthStateKey("gmail", state));
	return integration;
}

export async function connectLinear(
	userId: string,
	input: LinearConnectInput,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "connect_linear",
		user_id: userId,
	});
	const integration = await upsertIntegration({
		userId,
		type: "Linear",
		name: input.workspaceName || "Linear Workspace",
		accessToken: input.apiKey,
		config: {
			workspaceId: input.workspaceId,
			workspaceName: input.workspaceName,
		},
	});

	return integration;
}

export async function connectGitRepository(
	userId: string,
	input: GitConnectInput,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "connect_git_repository",
		user_id: userId,
		provider: input.provider,
	});
	await ensureProjectBelongsToUser(userId, input.projectId);

	const type = gitProviderToIntegrationType(input.provider);
	const repositoryName = repositoryNameFromUrl(input.repositoryUrl);

	const integration = await upsertIntegration({
		userId,
		type,
		name: `${input.provider.toUpperCase()} ${repositoryName}`,
		accessToken: input.accessToken,
		config: {
			provider: input.provider,
			repositoryUrl: input.repositoryUrl,
			defaultBranch: input.defaultBranch || "main",
			projectId: input.projectId,
			webhookSecret: randomUUID(),
		},
	});

	return {
		integration,
		provider: input.provider,
		repositoryUrl: input.repositoryUrl,
		webhookUrl: `/api/v1/integrations/git/webhook/${integration.id}`,
	};
}

export async function connectVoiceIntegration(
	userId: string,
	input: VoiceConnectInput,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "connect_voice",
		user_id: userId,
	});
	await ensureProjectBelongsToUser(userId, input.projectId);

	const integration = await upsertIntegration({
		userId,
		type: "Voice",
		name: "Voice Capture",
		config: {
			transcriptionProvider: input.transcriptionProvider,
			defaultLanguage: input.defaultLanguage,
			projectId: input.projectId,
		},
	});

	return integration;
}

async function guardDuplicateImport(
	userId: string,
	type: SupportedIntegration,
	externalId: string,
) {
	const key = `integration:import:${type}:${userId}:${externalId}`;
	const result = await redis.set(
		key,
		"1",
		"EX",
		env.INTEGRATION_IMPORT_DEDUP_TTL_SECONDS,
		"NX",
	);
	if (result !== "OK") {
		throw new ConflictError("Item already imported");
	}
}

async function createImportedInboxTask(params: {
	userId: string;
	type: SupportedIntegration;
	source: string;
	title: string;
	description?: string;
	projectId?: string;
	externalId: string;
	sourceMetadata?: Record<string, unknown>;
	tags?: string[];
}) {
	await ensureProjectBelongsToUser(params.userId, params.projectId);
	await guardDuplicateImport(params.userId, params.type, params.externalId);

	const task = await prisma.task.create({
		data: {
			userId: params.userId,
			projectId: params.projectId,
			title: params.title.slice(0, 500),
			description: params.description?.slice(0, 10000),
			state: "Inbox",
			source: params.source,
			tags: uniqueTags(params.tags ?? []),
			sourceMetadata: {
				integrationType: params.type,
				externalId: params.externalId,
				...params.sourceMetadata,
			},
		},
		include: {
			project: {
				select: { id: true, name: true, type: true },
			},
		},
	});

	return task;
}

export async function importSlackMessage(
	userId: string,
	input: SlackImportMessageInput,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "import_slack_message",
		user_id: userId,
	});
	await getEnabledIntegration(userId, "slack");

	const externalId =
		input.externalId ?? `${input.channelId}:${input.messageTs}`;
	const title = buildDefaultTitleFromText(input.text);
	const description = [
		input.text,
		input.permalink ? `\n\nSlack Link: ${input.permalink}` : "",
	].join("");

	return createImportedInboxTask({
		userId,
		type: "slack",
		source: "slack",
		title,
		description,
		projectId: input.projectId,
		externalId,
		sourceMetadata: {
			channelId: input.channelId,
			channelName: input.channelName,
			messageTs: input.messageTs,
			threadTs: input.threadTs,
			permalink: input.permalink,
			authorId: input.authorId,
			authorName: input.authorName,
		},
	});
}

export async function importGmailEmail(
	userId: string,
	input: GmailImportEmailInput,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "import_gmail_email",
		user_id: userId,
	});
	await getEnabledIntegration(userId, "gmail");

	const externalId = input.externalId ?? input.emailId;
	const attachmentLines = (input.attachments ?? [])
		.map((attachment) => `- ${attachment.filename}: ${attachment.url}`)
		.join("\n");
	const description = [
		`From: ${input.from}`,
		input.bodyText || input.bodySnippet,
		attachmentLines ? `\nAttachments:\n${attachmentLines}` : "",
	].join("\n\n");

	return createImportedInboxTask({
		userId,
		type: "gmail",
		source: "email",
		title: input.subject,
		description,
		projectId: input.projectId,
		externalId,
		sourceMetadata: {
			emailId: input.emailId,
			threadId: input.threadId,
			from: input.from,
			attachments: input.attachments ?? [],
		},
	});
}

export async function importLinearIssue(
	userId: string,
	input: LinearImportIssueInput,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "import_linear_issue",
		user_id: userId,
	});
	await getEnabledIntegration(userId, "linear");

	const externalId = input.externalId ?? input.issueId;
	const title = input.identifier
		? `${input.identifier}: ${input.title}`
		: input.title;

	const description = [
		input.description ?? "",
		input.url ? `\nLinear URL: ${input.url}` : "",
		input.state ? `\nState: ${input.state}` : "",
		input.assigneeName ? `\nAssignee: ${input.assigneeName}` : "",
	]
		.join("")
		.trim();

	const tags = [
		...(input.labels ?? []),
		input.teamName ? `team:${input.teamName}` : "",
	].filter(Boolean);

	return createImportedInboxTask({
		userId,
		type: "linear",
		source: "linear",
		title,
		description: description || undefined,
		projectId: input.projectId,
		externalId,
		tags,
		sourceMetadata: {
			issueId: input.issueId,
			identifier: input.identifier,
			url: input.url,
			state: input.state,
			priority: input.priority,
			teamId: input.teamId,
			teamName: input.teamName,
			assigneeName: input.assigneeName,
			labels: input.labels ?? [],
		},
	});
}

export async function importGitCommit(
	userId: string,
	input: GitImportCommitInput,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "import_git_commit",
		user_id: userId,
		provider: input.provider,
	});
	await getEnabledGitIntegration(userId, input.provider);

	const externalId =
		input.externalId ?? `${input.provider}:${input.commitSha}:${input.repositoryUrl}`;
	const shortSha = input.commitSha.slice(0, 8);
	const title = buildDefaultTitleFromText(`[${shortSha}] ${input.message}`);
	const description = [
		`Provider: ${input.provider}`,
		`Repository: ${input.repositoryUrl}`,
		input.branch ? `Branch: ${input.branch}` : "",
		input.authorName
			? `Author: ${input.authorName}${input.authorEmail ? ` <${input.authorEmail}>` : ""}`
			: "",
		"",
		input.message,
		input.url ? `\nCommit URL: ${input.url}` : "",
	].filter(Boolean).join("\n");

	return createImportedInboxTask({
		userId,
		type: "git",
		source: "git",
		title,
		description,
		projectId: input.projectId,
		externalId,
		tags: ["git", `provider:${input.provider}`],
		sourceMetadata: {
			provider: input.provider,
			repositoryUrl: input.repositoryUrl,
			branch: input.branch,
			commitSha: input.commitSha,
			url: input.url,
			authorName: input.authorName,
			authorEmail: input.authorEmail,
		},
	});
}

async function findSlackIntegrationByTeam(teamId: string) {
	const integrations = await prisma.integration.findMany({
		where: { type: "Slack", enabled: true },
		select: {
			id: true,
			userId: true,
			config: true,
		},
	});

	return (
		integrations.find((integration) => {
			if (!isObject(integration.config)) return false;
			return integration.config.teamId === teamId;
		}) ?? null
	);
}

export async function handleSlackWebhook(
	payload: Record<string, unknown>,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "handle_slack_webhook",
		payload_type: typeof payload.type === "string" ? payload.type : "unknown",
	});
	logger.info({
		event: "slack_webhook_received",
		type: typeof payload.type === "string" ? payload.type : "unknown",
	});

	if (
		payload.type === "url_verification" &&
		typeof payload.challenge === "string"
	) {
		return { challenge: payload.challenge };
	}

	if (payload.type !== "event_callback" || !isObject(payload.event)) {
		return { ok: true, handled: false };
	}

	const teamId =
		typeof payload.team_id === "string"
			? payload.team_id
			: typeof payload.teamId === "string"
				? payload.teamId
				: null;
	if (!teamId) {
		return { ok: true, handled: false };
	}

	const integration = await findSlackIntegrationByTeam(teamId);
	if (!integration) {
		return { ok: true, handled: false };
	}

	const event = payload.event;
	const eventType = typeof event.type === "string" ? event.type : "unknown";

		try {
			if (
				eventType === "message" &&
			typeof event.text === "string" &&
			typeof event.channel === "string" &&
			typeof event.ts === "string" &&
			typeof event.subtype !== "string"
		) {
			const task = await createImportedInboxTask({
				userId: integration.userId,
				type: "slack",
				source: "slack",
				title: buildDefaultTitleFromText(event.text),
				description: event.text,
				externalId: `${event.channel}:${event.ts}`,
				sourceMetadata: {
					channelId: event.channel,
					messageTs: event.ts,
					authorId: typeof event.user === "string" ? event.user : undefined,
					teamId,
					eventType,
				},
			});
			return {
				ok: true,
				handled: true,
				importedTaskId: task.id,
				userId: integration.userId,
			};
		}

		if (
			eventType === "reaction_added" &&
			typeof event.reaction === "string" &&
			(event.reaction === "pushpin" || event.reaction === "round_pushpin") &&
			isObject(event.item) &&
			typeof event.item.channel === "string" &&
			typeof event.item.ts === "string"
		) {
			const task = await createImportedInboxTask({
				userId: integration.userId,
				type: "slack",
				source: "slack",
				title: `Pinned Slack message (${event.item.channel})`,
				description: "Imported from Slack pin reaction",
				externalId: `${event.item.channel}:${event.item.ts}:${event.reaction}`,
				sourceMetadata: {
					channelId: event.item.channel,
					messageTs: event.item.ts,
					reaction: event.reaction,
					teamId,
					eventType,
				},
			});
			return {
				ok: true,
				handled: true,
				importedTaskId: task.id,
				userId: integration.userId,
			};
		}
	} catch (error) {
		if (error instanceof ConflictError) {
			return { ok: true, handled: true, duplicate: true };
		}
		throw error;
	}

	return { ok: true, handled: false };
}

export async function handleGitWebhook(
	integrationId: string,
	payload: Record<string, unknown>,
	eventName?: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "handle_git_webhook",
		integration_id: integrationId,
		event_name: eventName ?? null,
	});
	const integration = await prisma.integration.findFirst({
		where: {
			id: integrationId,
			enabled: true,
			type: { in: ["GitHub", "GitLab", "Bitbucket"] },
		},
	});
	if (!integration) {
		return { received: true, imported: 0 };
	}

	const provider = integrationTypeToGitProvider(integration.type) ?? "github";
	const config = isObject(integration.config) ? integration.config : {};
	let repositoryUrl = "";
	if (typeof config.repositoryUrl === "string") {
		repositoryUrl = config.repositoryUrl;
	} else if (isObject(payload.repository)) {
		if (typeof payload.repository.html_url === "string") {
			repositoryUrl = payload.repository.html_url;
		} else if (typeof payload.repository.web_url === "string") {
			repositoryUrl = payload.repository.web_url;
		}
	}

	const ref = typeof payload.ref === "string" ? payload.ref : undefined;
	const branch = ref?.replace("refs/heads/", "") || undefined;
	const commits = Array.isArray(payload.commits)
		? payload.commits.filter(
				(commit): commit is Record<string, unknown> =>
					Boolean(commit && typeof commit === "object"),
			)
		: [];

	const importedTasks: string[] = [];

	for (const commit of commits.slice(0, 20)) {
		const sha =
			typeof commit.id === "string"
				? commit.id
				: typeof commit.hash === "string"
					? commit.hash
					: null;
		const message =
			typeof commit.message === "string"
				? commit.message
				: typeof commit.title === "string"
					? commit.title
					: null;

		if (!sha || !message || !repositoryUrl) continue;

		try {
			const task = await importGitCommit(integration.userId, {
				provider,
				repositoryUrl,
				branch,
				commitSha: sha,
				message,
				authorName: isObject(commit.author)
					? (commit.author.name as string | undefined)
					: undefined,
				authorEmail: isObject(commit.author)
					? (commit.author.email as string | undefined)
					: undefined,
				url: typeof commit.url === "string" ? commit.url : undefined,
				externalId: `${provider}:${sha}`,
				projectId:
					typeof config.projectId === "string" ? config.projectId : undefined,
			});
			importedTasks.push(task.id);
		} catch (error) {
			if (error instanceof ConflictError) continue;
			throw error;
		}
	}

	if (isObject(payload.pull_request) && repositoryUrl) {
		const pr = payload.pull_request;
		const prId =
			typeof pr.id === "number"
				? String(pr.id)
				: typeof pr.number === "number"
					? String(pr.number)
					: null;
		const prTitle = typeof pr.title === "string" ? pr.title : null;
		if (prId && prTitle) {
			try {
				const task = await createImportedInboxTask({
					userId: integration.userId,
					type: "git",
					source: "git",
					title: `PR ${prId}: ${prTitle}`,
					description: typeof pr.body === "string" ? pr.body : undefined,
					externalId: `${provider}:pr:${prId}`,
					projectId:
						typeof config.projectId === "string" ? config.projectId : undefined,
					tags: ["git", "pull-request", `provider:${provider}`],
					sourceMetadata: {
						provider,
						repositoryUrl,
						url: typeof pr.html_url === "string" ? pr.html_url : undefined,
						eventName,
					},
				});
				importedTasks.push(task.id);
			} catch (error) {
				if (!(error instanceof ConflictError)) throw error;
			}
		}
	}

	logger.info({
		event: "git_webhook_processed",
		integration_id: integrationId,
		provider,
		event_name: eventName,
		imported: importedTasks.length,
	});

	return {
		received: true,
		imported: importedTasks.length,
		taskIds: importedTasks,
		userId: integration.userId,
	};
}

export async function requestVoiceTranscription(
	userId: string,
	input: VoiceTranscribeInput,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "request_voice_transcription",
		user_id: userId,
	});
	const integration = await getEnabledIntegration(userId, "voice");
	const config = isObject(integration.config) ? integration.config : {};
	const projectId = input.projectId ?? (config.projectId as string | undefined);

	const jobId = `transcribe_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
	await saveVoiceJob({
		jobId,
		userId,
		status: "processing",
		queuedAt: new Date().toISOString(),
		audioFilename: input.audioFilename,
	});

	queueMicrotask(async () => {
		try {
			const transcription =
				input.transcription?.trim() ||
				input.title?.trim() ||
				(input.audioFilename
					? `Voice note from ${input.audioFilename}`
					: "Voice note captured");
			const title =
				input.title?.trim() ||
				buildDefaultTitleFromText(transcription || "Voice note captured");
			const externalId = input.externalId ?? `voice:${jobId}`;

			const task = await createImportedInboxTask({
				userId,
				type: "voice",
				source: "voice",
				title,
				description: transcription,
				projectId,
				externalId,
				tags: ["voice", input.language ? `lang:${input.language}` : ""].filter(
					Boolean,
				),
				sourceMetadata: {
					language: input.language,
					audioFilename: input.audioFilename,
					transcriptionProvider:
						typeof config.transcriptionProvider === "string"
							? config.transcriptionProvider
							: "manual",
				},
			});

			await saveVoiceJob({
				jobId,
				userId,
				status: "completed",
				queuedAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
				transcription,
				tasks: [{ id: task.id, title: task.title, state: task.state }],
				audioFilename: input.audioFilename,
			});
		} catch (error) {
			await saveVoiceJob({
				jobId,
				userId,
				status: "failed",
				queuedAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
				error: error instanceof Error ? error.message : "Unknown error",
				audioFilename: input.audioFilename,
			});
		}
	});

	return {
		jobId,
		status: "processing" as const,
		estimatedTimeSeconds: 10,
	};
}

export async function getVoiceTranscriptionJob(
	userId: string,
	jobId: string,
	requestLogger?: RequestLogger,
) {
	requestLogger?.set("integration_service", {
		operation: "get_voice_transcription_job",
		user_id: userId,
		job_id: jobId,
	});
	const record = await loadVoiceJob(jobId);
	if (!record || record.userId !== userId) {
		throw new NotFoundError("Voice transcription job");
	}

	return {
		jobId: record.jobId,
		status: record.status,
		transcription: record.transcription,
		tasks: record.tasks ?? [],
		error: record.error,
		audioFilename: record.audioFilename,
		queuedAt: record.queuedAt,
		completedAt: record.completedAt,
	};
}

export async function createBranchForTask(params: {
	userId: string;
	taskId: string;
	baseBranch?: string;
	branchName?: string;
	requestLogger?: RequestLogger;
}) {
	params.requestLogger?.set("integration_service", {
		operation: "create_branch_for_task",
		user_id: params.userId,
		task_id: params.taskId,
	});
	const task = await prisma.task.findFirst({
		where: { id: params.taskId, userId: params.userId, deletedAt: null },
		select: {
			id: true,
			title: true,
			sourceMetadata: true,
		},
	});
	if (!task) {
		throw new NotFoundError("Task");
	}

	const integration = await getEnabledGitIntegration(params.userId);
	const provider = integrationTypeToGitProvider(integration.type) ?? "github";
	const config = isObject(integration.config) ? integration.config : {};
	const repositoryUrl =
		typeof config.repositoryUrl === "string" ? config.repositoryUrl : "";

	if (!repositoryUrl) {
		throw new UnprocessableError(
			"Git integration repository URL is missing. Reconnect Git integration.",
		);
	}

	const branchName =
		params.branchName?.trim() || buildBranchSlug(task.id, task.title);
	const branchUrl = `${repositoryUrl.replace(/\.git$/i, "")}/tree/${encodeURIComponent(branchName)}`;
	const baseBranch = params.baseBranch || "main";

	const metadata = isObject(task.sourceMetadata) ? task.sourceMetadata : {};
	await prisma.task.update({
		where: { id: task.id },
		data: {
			sourceMetadata: {
				...metadata,
				gitBranch: {
					provider,
					integrationId: integration.id,
					repositoryUrl,
					baseBranch,
					branchName,
					branchUrl,
					createdAt: new Date().toISOString(),
				},
			} as Prisma.InputJsonValue,
		},
	});

	return {
		branchName,
		branchUrl,
		checkoutCommand: `git checkout ${branchName}`,
		provider,
		baseBranch,
	};
}
