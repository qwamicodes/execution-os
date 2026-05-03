import { canQueueRequest, enqueueOfflineOperation } from "./offline-queue";
import type {
	AIRoutingStatusResponse,
	BatchApplyProjectTasksInput,
	BatchApplyProjectTasksResponse,
	ClassifyTaskInput,
	CompleteSessionInput,
	CreateIdeaInput,
	CreateProjectEpicInput,
	CreateProjectInput,
	CreateProjectMilestoneInput,
	CreateProjectPartInput,
	CreateTaskInput,
	DecomposeTaskInput,
	DecompositionPreview,
	ExtendSessionInput,
	GitConnectInput,
	GitImportCommitInput,
	Idea,
	IdeaFilters,
	IdeaListResponse,
	InboxBulkActionResponse,
	InboxFilters,
	InboxResponse,
	IntegrationRecord,
	PMAIAnalyzeImagesInput,
	PMAIAnalyzeVideoInput,
	PMAIApproveDocumentPlanInput,
	PMAIDecomposeTaskInput,
	PMAIIngestDocumentInput,
	PMAIPlanSprintInput,
	PMAIRebalanceSprintInput,
	PMAISuggestAssigneeInput,
	Project,
	ProjectEpic,
	ProjectFilters,
	ProjectMilestone,
	ProjectPart,
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
	UpdateIdeaInput,
	UpdateProjectEpicInput,
	UpdateProjectInput,
	UpdateProjectMilestoneInput,
	UpdateProjectPartInput,
	UpdateTaskInput,
	User,
	VoiceConnectInput,
	VoiceTranscribeInput,
} from "./types";

// ─── Base Request ─────────────────────────────────────────────────────────────

export const API_BASE_URL =
	import.meta.env.VITE_API_URL || "http://localhost:8901";

interface ApiError {
	error: {
		status_code?: string;
		code?: string;
		message: string;
		details?: string | Record<string, unknown>;
		suggestion?: string;
	};
}

export class ApiClientError extends Error {
	status: number;
	code?: string;
	details?: string;
	suggestion?: string;

	constructor(params: {
		message: string;
		status: number;
		code?: string;
		details?: string;
		suggestion?: string;
	}) {
		super(params.message);
		this.name = "ApiClientError";
		this.status = params.status;
		this.code = params.code;
		this.details = params.details;
		this.suggestion = params.suggestion;
	}
}

function normalizeErrorDetails(details: unknown): string | undefined {
	if (!details) return undefined;
	if (typeof details === "string") return details;
	try {
		return JSON.stringify(details);
	} catch {
		return String(details);
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
		const code = error?.error?.status_code ?? error?.error?.code;
		throw new ApiClientError({
			message: error?.error?.message || "Something went wrong",
			status: response.status,
			code,
			details: normalizeErrorDetails(error?.error?.details),
			suggestion: error?.error?.suggestion,
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
		const code = error?.error?.status_code ?? error?.error?.code;
		throw new ApiClientError({
			message: error?.error?.message || "Something went wrong",
			status: response.status,
			code,
			details: normalizeErrorDetails(error?.error?.details),
			suggestion: error?.error?.suggestion,
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

	decompose: (id: string, data?: DecomposeTaskInput) =>
		request<{
			message: string;
			taskId: string;
			subtasksCreated: number;
			reason: string | null;
			provider: string;
			model: string;
		}>(`/tasks/${id}/decompose`, {
			method: "POST",
			body: JSON.stringify(data ?? {}),
		}),

	previewDecomposition: (id: string, data?: DecomposeTaskInput) =>
		request<DecompositionPreview>(`/tasks/${id}/decompose/preview`, {
			method: "POST",
			body: JSON.stringify(data ?? {}),
		}),

	classifyAI: (id: string) =>
		request<Task>(`/tasks/${id}/classify/ai`, {
			method: "POST",
		}),

	applyAISuggestion: (id: string) =>
		request<Task>(`/tasks/${id}/ai-suggestion/apply`, {
			method: "POST",
		}),

	ignoreAISuggestion: (id: string) =>
		request<Task>(`/tasks/${id}/ai-suggestion/ignore`, {
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

	convertToIdea: (id: string) =>
		request<{
			idea: Idea;
			migration: { applied: string[]; reset: string[]; suggestion: string };
		}>(`/tasks/${id}/convert-to-idea`, { method: "POST" }),

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

export const ideas = {
	list: async (filters?: IdeaFilters): Promise<IdeaListResponse> => {
		const response = await requestPaginated<Idea>(
			`/ideas${buildQuery(filters || {})}`,
		);
		return {
			ideas: response.data,
			total: response.meta.total,
		};
	},
	get: (id: string) => request<Idea>(`/ideas/${id}`),
	create: (data: CreateIdeaInput) =>
		request<Idea>("/ideas", {
			method: "POST",
			body: JSON.stringify(data),
		}),
	update: (id: string, data: UpdateIdeaInput) =>
		request<Idea>(`/ideas/${id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),
	classifyAI: (id: string) =>
		request<Idea>(`/ideas/${id}/classify/ai`, { method: "POST" }),
	delete: (id: string) => request<null>(`/ideas/${id}`, { method: "DELETE" }),
	convertToTask: (id: string) =>
		request<{ task: Task }>(`/ideas/${id}/convert-to-task`, { method: "POST" }),
	convertToProject: (id: string) =>
		request<{
			project: Project;
			migration: { applied: string[]; suggestion: string };
		}>(`/ideas/${id}/convert-to-project`, { method: "POST" }),
	migrateLegacyIdeas: () =>
		request<{ scanned: number; migrated: number }>(
			"/tasks/migrations/legacy-ideas",
			{
				method: "POST",
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

	listParts: (projectId: string) =>
		request<ProjectPart[]>(`/projects/${projectId}/parts`),

	createPart: (projectId: string, data: CreateProjectPartInput) =>
		request<ProjectPart>(`/projects/${projectId}/parts`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	updatePart: (
		projectId: string,
		partId: string,
		data: UpdateProjectPartInput,
	) =>
		request<ProjectPart>(`/projects/${projectId}/parts/${partId}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	deletePart: (projectId: string, partId: string) =>
		request<null>(`/projects/${projectId}/parts/${partId}`, {
			method: "DELETE",
		}),

	listEpics: (projectId: string) =>
		request<ProjectEpic[]>(`/projects/${projectId}/epics`),

	createEpic: (projectId: string, data: CreateProjectEpicInput) =>
		request<ProjectEpic>(`/projects/${projectId}/epics`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	updateEpic: (
		projectId: string,
		epicId: string,
		data: UpdateProjectEpicInput,
	) =>
		request<ProjectEpic>(`/projects/${projectId}/epics/${epicId}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

	deleteEpic: (projectId: string, epicId: string) =>
		request<null>(`/projects/${projectId}/epics/${epicId}`, {
			method: "DELETE",
		}),

	batchApplyTasks: (projectId: string, data: BatchApplyProjectTasksInput) =>
		request<BatchApplyProjectTasksResponse>(
			`/projects/${projectId}/tasks/batch-apply`,
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		),
};

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = {
	getActive: () => request<Session | null>("/sessions/active"),
	getById: (id: string) => request<Session>(`/sessions/${id}`),

	start: (data: StartSessionInput) =>
		request<Session>("/sessions/start", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	pause: (id: string) =>
		request<Session>(`/sessions/${id}/pause`, { method: "PATCH" }),

	resume: (id: string) =>
		request<Session>(`/sessions/${id}/resume`, { method: "PATCH" }),

	extend: (id: string, data: ExtendSessionInput) =>
		request<Session>(`/sessions/${id}/extend`, {
			method: "PATCH",
			body: JSON.stringify(data),
		}),

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

	history: async (filters?: SessionHistoryFilters) => {
		const response = await requestPaginated<Session>(
			`/sessions/history${buildQuery(filters || {})}`,
		);
		return {
			data: response.data,
			meta: {
				total: response.meta.total,
				page: response.meta.page,
				limit: response.meta.limit,
				pages: response.meta.totalPages,
			},
		} as SessionHistoryResponse;
	},
};

// ─── Inbox ────────────────────────────────────────────────────────────────────

export const inbox = {
	list: (filters?: InboxFilters) =>
		request<InboxResponse>(`/inbox${buildQuery(filters || {})}`),

	classify: (id: string, data: ClassifyTaskInput) =>
		request<Task>(`/inbox/${id}/classify`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	autoClassify: (id: string) =>
		request<Task>(`/inbox/${id}/classify/auto`, {
			method: "POST",
		}),

	ignoreAISuggestion: (id: string) =>
		request<Task>(`/inbox/${id}/classify/ignore`, {
			method: "POST",
		}),

	ignoreAllAISuggestions: () =>
		request<InboxBulkActionResponse>("/inbox/classify/ignore-all", {
			method: "POST",
		}),

	applyAllAISuggestions: () =>
		request<InboxBulkActionResponse>("/inbox/classify/apply-all", {
			method: "POST",
		}),

	deleteAllAISuggestions: () =>
		request<InboxBulkActionResponse>("/inbox/classify/delete-all", {
			method: "DELETE",
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

	approveDocumentPlan: (data: PMAIApproveDocumentPlanInput) =>
		request<unknown>("/pm-ai/approve-document-plan", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	ingestDocumentUpload: (data: {
		file: File;
		documentType: "tsd" | "prd" | "contract" | "feature_spec";
		title?: string;
		feedbackInstructions?: string;
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
		if (data.feedbackInstructions) {
			form.set("feedbackInstructions", data.feedbackInstructions);
		}
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
