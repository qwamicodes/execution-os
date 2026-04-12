import { z } from "zod";

export const IntegrationTypeSchema = z.enum([
	"slack",
	"gmail",
	"linear",
	"git",
	"voice",
]);
export const GitProviderSchema = z.enum(["github", "gitlab", "bitbucket"]);

export const SlackOAuthCallbackQuerySchema = z.object({
	code: z.string().min(1),
	state: z.string().min(1),
});

export const GmailOAuthCallbackQuerySchema = z.object({
	code: z.string().min(1),
	state: z.string().min(1),
});

export const LinearConnectSchema = z.object({
	apiKey: z.string().min(10).max(500),
	workspaceId: z.string().max(100).optional(),
	workspaceName: z.string().max(150).optional(),
});

export const GitConnectSchema = z.object({
	provider: GitProviderSchema,
	repositoryUrl: z.string().url(),
	accessToken: z.string().min(10).max(500),
	defaultBranch: z.string().max(100).optional(),
	projectId: z.string().uuid().optional(),
});

export const VoiceConnectSchema = z.object({
	transcriptionProvider: z.enum(["openai_whisper", "manual"]).default("manual"),
	defaultLanguage: z.string().max(20).optional(),
	projectId: z.string().uuid().optional(),
});

export const SlackImportMessageSchema = z.object({
	externalId: z.string().max(150).optional(),
	channelId: z.string().min(1).max(100),
	channelName: z.string().max(150).optional(),
	messageTs: z.string().min(1).max(50),
	text: z.string().min(1).max(10000),
	authorId: z.string().max(100).optional(),
	authorName: z.string().max(200).optional(),
	threadTs: z.string().max(50).optional(),
	permalink: z.string().url().optional(),
	projectId: z.string().uuid().optional(),
});

export const GmailImportEmailSchema = z.object({
	externalId: z.string().max(150).optional(),
	emailId: z.string().min(1).max(150),
	threadId: z.string().max(150).optional(),
	subject: z.string().min(1).max(500),
	from: z.string().email(),
	bodySnippet: z.string().max(2000),
	bodyText: z.string().max(10000).optional(),
	attachments: z
		.array(
			z.object({
				filename: z.string().max(255),
				url: z.string().url(),
			}),
		)
		.max(20)
		.optional(),
	projectId: z.string().uuid().optional(),
});

export const LinearImportIssueSchema = z.object({
	externalId: z.string().max(150).optional(),
	issueId: z.string().min(1).max(150),
	identifier: z.string().max(50).optional(),
	title: z.string().min(1).max(500),
	description: z.string().max(10000).optional(),
	url: z.string().url().optional(),
	state: z.string().max(100).optional(),
	priority: z.union([z.string(), z.number().int().min(0).max(4)]).optional(),
	teamId: z.string().max(100).optional(),
	teamName: z.string().max(150).optional(),
	assigneeName: z.string().max(150).optional(),
	labels: z.array(z.string().max(80)).max(20).optional(),
	projectId: z.string().uuid().optional(),
});

export const GitImportCommitSchema = z.object({
	externalId: z.string().max(180).optional(),
	provider: GitProviderSchema,
	repositoryUrl: z.string().url(),
	branch: z.string().max(180).optional(),
	commitSha: z.string().min(6).max(120),
	message: z.string().min(1).max(2000),
	authorName: z.string().max(160).optional(),
	authorEmail: z.string().email().optional(),
	url: z.string().url().optional(),
	projectId: z.string().uuid().optional(),
});

export const VoiceTranscribeSchema = z
	.object({
		projectId: z.string().uuid().optional(),
		language: z.string().max(20).optional(),
		transcription: z.string().max(10000).optional(),
		title: z.string().max(500).optional(),
		audioFilename: z.string().max(300).optional(),
		externalId: z.string().max(180).optional(),
	})
	.refine(
		(value) =>
			Boolean((value.transcription && value.transcription.trim()) || value.title),
		{
			message: "transcription or title is required",
		},
	);

export type IntegrationTypeInput = z.infer<typeof IntegrationTypeSchema>;
export type GitProviderInput = z.infer<typeof GitProviderSchema>;
export type LinearConnectInput = z.infer<typeof LinearConnectSchema>;
export type GitConnectInput = z.infer<typeof GitConnectSchema>;
export type VoiceConnectInput = z.infer<typeof VoiceConnectSchema>;
export type SlackImportMessageInput = z.infer<typeof SlackImportMessageSchema>;
export type GmailImportEmailInput = z.infer<typeof GmailImportEmailSchema>;
export type LinearImportIssueInput = z.infer<typeof LinearImportIssueSchema>;
export type GitImportCommitInput = z.infer<typeof GitImportCommitSchema>;
export type VoiceTranscribeInput = z.infer<typeof VoiceTranscribeSchema>;
