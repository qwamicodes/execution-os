import type {
	AIRoutingStatusResponse,
	ClassifyTaskInput,
	CompleteSessionInput,
	CreateProjectInput,
	CreateProjectMilestoneInput,
	CreateTaskInput,
	GitConnectInput,
	GitImportCommitInput,
	InboxResponse,
	IntegrationRecord,
	PMAIAnalyzeImagesInput,
	PMAIAnalyzeVideoInput,
	PMAIDecomposeTaskInput,
	PMAIIngestDocumentInput,
	PMAIPlanSprintInput,
	PMAIRebalanceSprintInput,
	PMAISuggestAssigneeInput,
	Project,
	ProjectFilters,
	ProjectMilestone,
	SearchParams,
	SearchResponse,
	Session,
	SessionCompleteResponse,
	SessionHistoryFilters,
	SessionHistoryResponse,
	StartSessionInput,
	Task,
	TaskFilters,
	TaskListResponse,
	TaskPriorityExplanation,
	TaskPriorityOverrideInput,
	TaskPriorityOverrideResponse,
	TaskRecommendationResponse,
	UpdateProjectInput,
	UpdateProjectMilestoneInput,
	UpdateTaskInput,
	User,
	VoiceConnectInput,
	VoiceTranscribeInput,
} from "./types";
import {
	canQueueRequest,
	enqueueOfflineOperation,
} from "./offline-queue";

// ─── Base Request ─────────────────────────────────────────────────────────────

export const API_BASE_URL =
	import.meta.env.VITE_API_URL || "http://localhost:8901";

interface ApiError {
	error: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
	};
}

export class ApiClientError extends Error {
	status: number;
	code?: string;
	details?: Record<string, unknown>;

	constructor(params: {
		message: string;
		status: number;
		code?: string;
		details?: Record<string, unknown>;
	}) {
		super(params.message);
		this.name = "ApiClientError";
		this.status = params.status;
		this.code = params.code;
		this.details = params.details;
	}
}

async function parseResponseJson(response: Response): Promise<unknown> {
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) return null;
	try {
		return await response.json();
	} catch {
		return null;
	}
}

interface PaginatedApiResponse<T> {
	data: T[];
	meta: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
	};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const isFormData =
		typeof FormData !== "undefined" && options?.body instanceof FormData;
	const headers = new Headers(options?.headers);
	if (!isFormData && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	if (
		typeof navigator !== "undefined" &&
		!navigator.onLine &&
		canQueueRequest(options)
	) {
		const queued = enqueueOfflineOperation(path, {
			...options,
			headers,
		});
		if (queued && typeof window !== "undefined") {
			window.dispatchEvent(
				new CustomEvent("execution-os:offline-operation-queued", {
					detail: { id: queued.id, path, method: queued.method },
				}),
			);
		}
		return { queuedOffline: true } as T;
	}

	const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
		...options,
		credentials: "include",
		headers,
	});

	// Handle 204 No Content (e.g. DELETE, no active session)
	if (response.status === 204) {
		return null as T;
	}

	const json = await parseResponseJson(response);

	if (!response.ok) {
		const error = json as ApiError | null;
		throw new ApiClientError({
			message: error?.error?.message || "Something went wrong",
			status: response.status,
			code: error?.error?.code,
			details: error?.error?.details,
		});
	}

	const payload = json as { data?: T } | null;
	return (payload?.data ?? null) as T;
}

async function requestPaginated<T>(
	path: string,
	options?: RequestInit,
): Promise<PaginatedApiResponse<T>> {
	const isFormData =
		typeof FormData !== "undefined" && options?.body instanceof FormData;
	const headers = new Headers(options?.headers);
	if (!isFormData && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
		...options,
		credentials: "include",
		headers,
	});

	const json = await parseResponseJson(response);

	if (!response.ok) {
		const error = json as ApiError | null;
		throw new ApiClientError({
			message: error?.error?.message || "Something went wrong",
			status: response.status,
			code: error?.error?.code,
			details: error?.error?.details,
		});
	}

	return (json ?? {
		data: [],
		meta: {
			page: 1,
			limit: 50,
			total: 0,
			totalPages: 0,
			hasNext: false,
			hasPrev: false,
		},
	}) as PaginatedApiResponse<T>;
}

function buildQuery(params: object): string {
	const entries = Object.entries(params).filter(
		([, v]) => v !== undefined && v !== null,
	);
	if (entries.length === 0) return "";
	const searchParams = new URLSearchParams();
	for (const [key, value] of entries) {
		searchParams.set(key, String(value));
	}
	return `?${searchParams.toString()}`;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
	getMe: () => request<User>("/auth/me"),

	logout: () =>
		request<{ message: string }>("/auth/logout", { method: "POST" }),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasks = {
	list: async (filters?: TaskFilters): Promise<TaskListResponse> => {
		const response = await requestPaginated<Task>(
			`/tasks${buildQuery(filters || {})}`,
		);
		return {
			tasks: response.data,
			total: response.meta.total,
		};
	},

	get: (id: string) => request<Task>(`/tasks/${id}`),

	create: (data: CreateTaskInput) =>
		request<Task>("/tasks", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdateTaskInput) =>
		request<Task>(`/tasks/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	delete: (id: string) => request<null>(`/tasks/${id}`, { method: "DELETE" }),

	restore: (id: string) =>
		request<Task>(`/tasks/${id}/restore`, { method: "POST" }),

	decompose: (id: string) =>
		request<{ message: string; taskId: string; jobId: string }>(
			`/tasks/${id}/decompose`,
			{ method: "POST" },
		),

	classifyAI: (id: string) =>
		request<Task>(`/tasks/${id}/classify/ai`, {
			method: "POST",
		}),

	subtasks: (id: string) => request<Task[]>(`/tasks/${id}/subtasks`),

	explainPriority: (id: string) =>
		request<TaskPriorityExplanation>(`/tasks/${id}/priority/explain`),

	overridePriority: (id: string, data: TaskPriorityOverrideInput) =>
		request<TaskPriorityOverrideResponse>(`/tasks/${id}/priority/override`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	clearPriorityOverride: (id: string) =>
		request<Task>(`/tasks/${id}/priority/override`, { method: "DELETE" }),

	createBranch: (
		id: string,
		data?: {
			baseBranch?: string;
			branchName?: string;
		},
	) =>
		request<{
			branchName: string;
			branchUrl: string;
			checkoutCommand: string;
			provider: "github" | "gitlab" | "bitbucket";
			baseBranch: string;
		}>(`/tasks/${id}/create-branch`, {
			method: "POST",
			body: JSON.stringify(data ?? {}),
		}),

	recalculatePriorities: () =>
		request<{ total: number; updated: number }>(
			`/tasks/priorities/recalculate`,
			{
				method: "POST",
				body: JSON.stringify({ userScope: "self" }),
			},
		),
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = {
	list: (filters?: ProjectFilters) =>
		request<Project[]>(`/projects${buildQuery(filters || {})}`),

	get: (id: string) => request<Project>(`/projects/${id}`),

	create: (data: CreateProjectInput) =>
		request<Project>("/projects", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: UpdateProjectInput) =>
		request<Project>(`/projects/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	delete: (id: string) =>
		request<null>(`/projects/${id}`, { method: "DELETE" }),

	listMilestones: (projectId: string) =>
		request<ProjectMilestone[]>(`/projects/${projectId}/milestones`),

	createMilestone: (projectId: string, data: CreateProjectMilestoneInput) =>
		request<ProjectMilestone>(`/projects/${projectId}/milestones`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	updateMilestone: (
		projectId: string,
		milestoneId: string,
		data: UpdateProjectMilestoneInput,
	) =>
		request<ProjectMilestone>(
			`/projects/${projectId}/milestones/${milestoneId}`,
			{
				method: "PATCH",
				body: JSON.stringify(data),
			},
		),

	deleteMilestone: (projectId: string, milestoneId: string) =>
		request<null>(`/projects/${projectId}/milestones/${milestoneId}`, {
			method: "DELETE",
		}),
};

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = {
	getActive: () => request<Session | null>("/sessions/active"),

	start: (data: StartSessionInput) =>
		request<Session>("/sessions/start", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	pause: (id: string) =>
		request<Session>(`/sessions/${id}/pause`, { method: "PATCH" }),

	resume: (id: string) =>
		request<Session>(`/sessions/${id}/resume`, { method: "PATCH" }),

	complete: (id: string, data: CompleteSessionInput) =>
		request<SessionCompleteResponse>(`/sessions/${id}/complete`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	updateScratchpad: (id: string, content: string) =>
		request<{ id: string; scratchpad: string; updatedAt: string }>(
			`/sessions/${id}/scratchpad`,
			{
				method: "PATCH",
				body: JSON.stringify({ content }),
			},
		),

	history: (filters?: SessionHistoryFilters) =>
		request<SessionHistoryResponse>(
			`/sessions/history${buildQuery(filters || {})}`,
		),
};

// ─── Inbox ────────────────────────────────────────────────────────────────────

export const inbox = {
	list: () => request<InboxResponse>("/inbox"),

	classify: (id: string, data: ClassifyTaskInput) =>
		request<Task>(`/inbox/${id}/classify`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	autoClassify: (id: string) =>
		request<Task>(`/inbox/${id}/classify/auto`, {
			method: "POST",
		}),
};

// ─── Integrations ─────────────────────────────────────────────────────────────

export const integrations = {
	list: () => request<IntegrationRecord[]>("/integrations"),

	connectSlack: () =>
		request<{ authUrl: string; state: string }>("/integrations/slack/connect", {
			method: "POST",
		}),

	connectGmail: () =>
		request<{ authUrl: string; state: string }>("/integrations/gmail/connect", {
			method: "POST",
		}),

	connectLinear: (data: {
		apiKey: string;
		workspaceId?: string;
		workspaceName?: string;
	}) =>
		request<{
			connected: boolean;
			provider: "linear";
			integrationId: string;
			name: string;
		}>("/integrations/linear/connect", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	connectGit: (data: GitConnectInput) =>
		request<{
			id: string;
			provider: "github" | "gitlab" | "bitbucket";
			repositoryUrl: string;
			webhookUrl: string;
			connected: boolean;
		}>("/integrations/git/connect", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	connectVoice: (data: VoiceConnectInput) =>
		request<{
			connected: boolean;
			provider: "voice";
			integrationId: string;
			name: string;
		}>("/integrations/voice/connect", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	disconnect: (type: "slack" | "gmail" | "linear" | "git" | "voice") =>
		request<{ connected: false; provider: string }>(
			`/integrations/${type}/disconnect`,
			{
				method: "POST",
			},
		),

	importSlackMessage: (data: {
		channelId: string;
		messageTs: string;
		text: string;
		channelName?: string;
		authorId?: string;
		authorName?: string;
		permalink?: string;
		projectId?: string;
	}) =>
		request<{ taskId: string; title: string; source: string; state: string }>(
			"/integrations/slack/import-message",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		),

	processGmailEmail: (data: {
		emailId: string;
		subject: string;
		from: string;
		bodySnippet: string;
		bodyText?: string;
		projectId?: string;
		attachments?: Array<{ filename: string; url: string }>;
	}) =>
		request<{ taskId: string; title: string; source: string; state: string }>(
			"/integrations/gmail/process-email",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		),

	importLinearIssue: (data: {
		issueId: string;
		title: string;
		description?: string;
		url?: string;
		projectId?: string;
		identifier?: string;
		state?: string;
		priority?: string | number;
		teamName?: string;
		assigneeName?: string;
		labels?: string[];
	}) =>
		request<{ taskId: string; title: string; source: string; state: string }>(
			"/integrations/linear/import-issue",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		),

	importGitCommit: (data: GitImportCommitInput) =>
		request<{ taskId: string; title: string; source: string; state: string }>(
			"/integrations/git/import-commit",
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		),

	transcribeVoice: (
		data:
			| (VoiceTranscribeInput & { audio?: undefined })
			| (VoiceTranscribeInput & { audio: File }),
	) => {
		if (data.audio) {
			const form = new FormData();
			form.set("audio", data.audio);
			if (data.projectId) form.set("projectId", data.projectId);
			if (data.language) form.set("language", data.language);
			if (data.transcription) form.set("transcription", data.transcription);
			if (data.title) form.set("title", data.title);
			if (data.externalId) form.set("externalId", data.externalId);

			return request<{
				jobId: string;
				status: "processing";
				estimatedTimeSeconds: number;
			}>("/integrations/voice/transcribe", {
				method: "POST",
				body: form,
			});
		}

		return request<{
			jobId: string;
			status: "processing";
			estimatedTimeSeconds: number;
		}>("/integrations/voice/transcribe", {
			method: "POST",
			body: JSON.stringify(data),
		});
	},

	getVoiceTranscriptionJob: (jobId: string) =>
		request<{
			jobId: string;
			status: "processing" | "completed" | "failed";
			transcription?: string;
			tasks: Array<{ id: string; title: string; state: string }>;
			error?: string;
			queuedAt?: string;
			completedAt?: string;
		}>(`/integrations/voice/transcribe/${jobId}`),
};

// ─── AI ───────────────────────────────────────────────────────────────────────

export const ai = {
	getProviders: () => request<AIRoutingStatusResponse>("/ai/providers"),

	getRecommendation: (forceRefresh?: boolean) =>
		request<TaskRecommendationResponse>(
			`/ai/recommendation${buildQuery({ forceRefresh })}`,
		),
};

// ─── PM AI ───────────────────────────────────────────────────────────────────

export const pmAi = {
	analyzeVideo: (data: PMAIAnalyzeVideoInput) =>
		request<unknown>("/pm-ai/analyze-video", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	analyzeImages: (data: PMAIAnalyzeImagesInput) =>
		request<unknown>("/pm-ai/analyze-images", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	decomposeTask: (data: PMAIDecomposeTaskInput) =>
		request<unknown>("/pm-ai/decompose-task", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	suggestAssignee: (data: PMAISuggestAssigneeInput) =>
		request<unknown>("/pm-ai/suggest-assignee", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	planSprint: (data: PMAIPlanSprintInput) =>
		request<unknown>("/pm-ai/plan-sprint", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	rebalanceSprint: (data: PMAIRebalanceSprintInput) =>
		request<unknown>("/pm-ai/rebalance-sprint", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	ingestDocument: (data: PMAIIngestDocumentInput) =>
		request<unknown>("/pm-ai/ingest-document", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	ingestDocumentUpload: (data: {
		file: File;
		documentType: "tsd" | "prd" | "contract" | "feature_spec";
		title?: string;
		projectId?: string;
		ideaTaskId?: string;
		usageMode?: "individual" | "team";
		teamMemberIds?: string[];
		createTasks?: boolean;
		createMilestones?: boolean;
		selectedMilestoneTitles?: string[];
		maxTasks?: number;
		maxMilestones?: number;
	}) => {
		const form = new FormData();
		form.set("file", data.file);
		form.set("documentType", data.documentType);
		if (data.title) form.set("title", data.title);
		if (data.projectId) form.set("projectId", data.projectId);
		if (data.ideaTaskId) form.set("ideaTaskId", data.ideaTaskId);
		if (data.usageMode) form.set("usageMode", data.usageMode);
		if (data.teamMemberIds && data.teamMemberIds.length > 0) {
			form.set("teamMemberIds", JSON.stringify(data.teamMemberIds));
		}
		if (typeof data.createTasks === "boolean") {
			form.set("createTasks", String(data.createTasks));
		}
		if (typeof data.createMilestones === "boolean") {
			form.set("createMilestones", String(data.createMilestones));
		}
		if (Array.isArray(data.selectedMilestoneTitles)) {
			form.set(
				"selectedMilestoneTitles",
				JSON.stringify(data.selectedMilestoneTitles),
			);
		}
		if (typeof data.maxTasks === "number") {
			form.set("maxTasks", String(data.maxTasks));
		}
		if (typeof data.maxMilestones === "number") {
			form.set("maxMilestones", String(data.maxMilestones));
		}

		return request<unknown>("/pm-ai/ingest-document/upload", {
			method: "POST",
			body: form,
		});
	},
};

// ─── Search ───────────────────────────────────────────────────────────────────

export const search = {
	query: (params: SearchParams) =>
		request<SearchResponse>(`/search${buildQuery(params)}`),
};
