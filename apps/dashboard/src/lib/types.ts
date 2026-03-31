// ─── Enums ────────────────────────────────────────────────────────────────────

export type TaskState =
	| "Inbox"
	| "Ongoing"
	| "Ready"
	| "Active"
	| "Blocked"
	| "Paused"
	| "Done";

export type TaskSize = "Small" | "Medium" | "Large" | "Huge";

export type TaskUrgency = "Urgent" | "High" | "Medium" | "Low";

export type SessionState = "Active" | "Paused" | "Completed" | "Abandoned";

export type SessionOutcome = "Done" | "Continue" | "Blocked" | "TooBig";

export type ProjectType = "Clients" | "Core" | "SideQuest" | "Office";
export type IntegrationProvider =
	| "slack"
	| "gmail"
	| "linear"
	| "git"
	| "voice";
export type GitProvider = "github" | "gitlab" | "bitbucket";

// ─── Models ───────────────────────────────────────────────────────────────────

export interface User {
	id: string;
	email: string;
	name: string;
	timezone: string;
	preferences: Record<string, unknown>;
	createdAt: string;
}

export interface Project {
	id: string;
	name: string;
	description: string | null;
	type: ProjectType;
	color: string | null;
	targetCompletionDate?: string | null;
	userId: string;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
	// Computed fields from API
	taskCount?: number;
	activeTasks?: number;
	completedTasks?: number;
}

export type MilestoneStatus = "Pending" | "Completed" | "AtRisk";

export interface ProjectMilestone {
	id: string;
	projectId: string;
	userId: string;
	title: string;
	description: string | null;
	targetDate: string | null;
	status: MilestoneStatus;
	order: number | null;
	completedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Task {
	id: string;
	title: string;
	description: string | null;
	state: TaskState;
	size: TaskSize | null;
	urgency: TaskUrgency | null;
	protected: boolean;
	protectionReason: string | null;
	tags: string[];
	priority: number | null;
	estimatedSessions: number | null;
	completedSessions: number;
	deadline: string | null;
	parentId: string | null;
	order: number | null;
	source: string;
	sourceMetadata: Record<string, unknown> | null;
	userId: string;
	projectId: string | null;
	createdAt: string;
	updatedAt: string;
	stateChangedAt: string | null;
	deletedAt: string | null;
	// Relations (optional, included on detail endpoints)
	project?: { id: string; name: string; type: ProjectType } | null;
	subtasks?: Task[];
	stateHistory?: StateHistory[];
}

export interface Session {
	id: string;
	state: SessionState;
	outcome: SessionOutcome | null;
	duration: number;
	actualDuration: number | null;
	startedAt: string;
	pausedAt: string | null;
	resumedAt: string | null;
	completedAt: string | null;
	expiresAt: string;
	scratchpad: string | null;
	notes: string | null;
	blockerNote: string | null;
	taskId: string;
	userId: string;
	createdAt: string;
	updatedAt: string;
	// Relations
	task?: Task;
	// Computed fields
	elapsedSeconds?: number;
	remainingSeconds?: number;
}

export interface StateHistory {
	id: string;
	fromState: TaskState;
	toState: TaskState;
	reason: string | null;
	taskId: string;
	userId: string;
	createdAt: string;
}

export interface IntegrationRecord {
	id: string;
	type: string;
	name: string;
	enabled: boolean;
	connected: boolean;
	lastSyncAt: string | null;
	createdAt: string;
	updatedAt: string;
	config: Record<string, unknown> | null;
}

export interface GitConnectInput {
	provider: GitProvider;
	repositoryUrl: string;
	accessToken: string;
	defaultBranch?: string;
	projectId?: string;
}

export interface VoiceConnectInput {
	transcriptionProvider?: "openai_whisper" | "manual";
	defaultLanguage?: string;
	projectId?: string;
}

export interface GitImportCommitInput {
	provider: GitProvider;
	repositoryUrl: string;
	commitSha: string;
	message: string;
	branch?: string;
	url?: string;
	projectId?: string;
	authorName?: string;
	authorEmail?: string;
	externalId?: string;
}

export interface VoiceTranscribeInput {
	projectId?: string;
	language?: string;
	transcription?: string;
	title?: string;
	audioFilename?: string;
	externalId?: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiMeta {
	total: number;
	page: number;
	limit: number;
	pages: number;
}

export interface PaginatedResponse<T> {
	data: T[];
	meta: ApiMeta;
}

// ─── Request Types ────────────────────────────────────────────────────────────

export interface CreateTaskInput {
	title: string;
	description?: string;
	projectId?: string;
	deadline?: string;
	tags?: string[];
	source?: string;
}

export interface UpdateTaskInput {
	title?: string;
	description?: string;
	projectId?: string | null;
	deadline?: string | null;
	tags?: string[];
	state?: TaskState;
}

export interface CreateProjectInput {
	name: string;
	description?: string;
	type?: ProjectType;
	targetCompletionDate?: string;
	color?: string;
}

export interface UpdateProjectInput {
	name?: string;
	description?: string;
	targetCompletionDate?: string | null;
	color?: string;
	archived?: boolean;
}

export interface CreateProjectMilestoneInput {
	title: string;
	description?: string;
	targetDate?: string | null;
	status?: MilestoneStatus;
	order?: number;
}

export interface UpdateProjectMilestoneInput {
	title?: string;
	description?: string | null;
	targetDate?: string | null;
	status?: MilestoneStatus;
	order?: number;
	completedAt?: string | null;
}

export interface StartSessionInput {
	taskId: string;
	duration?: number;
}

export interface CompleteSessionInput {
	outcome: SessionOutcome;
	notes?: string;
	blockerNote?: string;
}

export interface ClassifyTaskInput {
	title?: string;
	description?: string | null;
	projectId?: string;
	size?: TaskSize;
	urgency?: TaskUrgency;
	protected?: boolean;
	protectionReason?: "contract" | "sla" | "client" | "investor";
	deadline?: string;
	tags?: string[];
}

export interface TaskFilters {
	page?: number;
	limit?: number;
	sortBy?: "createdAt" | "updatedAt" | "deadline" | "priority" | "title";
	sortOrder?: "asc" | "desc";
	kind?: "execution" | "idea";
	state?: TaskState;
	projectId?: string;
	size?: TaskSize;
	protected?: boolean;
	hasDeadline?: boolean;
	search?: string;
	tag?: string;
}

export interface ProjectFilters {
	type?: ProjectType;
	includeArchived?: boolean;
}

export interface SessionHistoryFilters {
	page?: number;
	limit?: number;
	taskId?: string;
	outcome?: SessionOutcome;
	startDate?: string;
	endDate?: string;
}

export interface SearchParams {
	q: string;
	scope?: "tasks" | "projects" | "all";
	limit?: number;
}

// ─── API Response Specific Types ──────────────────────────────────────────────

export interface TaskListResponse {
	tasks: Task[];
	total: number;
}

export interface InboxResponse {
	tasks: Task[];
	meta: {
		total: number;
		pendingClassification: number;
		needsReview?: number;
	};
}

export type SessionHistoryResponse = PaginatedResponse<Session>;

export interface SearchResponse {
	tasks: Task[];
	projects: Project[];
	meta: {
		query: string;
		totalResults: number;
		searchTimeMs: number;
	};
}

export interface SessionCompleteResponse {
	session: Session;
	task: Task;
	nextTask?: Task;
}

export interface TaskRecommendationEntry {
	task: {
		id: string;
		title: string;
		state: "Ready";
		size: TaskSize | null;
		urgency: TaskUrgency | null;
		protected: boolean;
		protectionReason: string | null;
		priority: number | null;
		deadline: string | null;
		project: {
			id: string;
			name: string;
			type: ProjectType;
		} | null;
	};
	score: number;
	layer: "Now" | "Next" | "ThisWeek" | "Hidden";
	reason: string;
	factors: {
		deadline: number;
		protected: number;
		projectHealth: number;
		capacity: number;
		age: number;
	};
}

export interface TaskRecommendationResponse {
	generatedAt: string;
	strategy: "ai" | "rules";
	provider: "anthropic" | "openai" | "ollama" | null;
	model: string | null;
	confidence: number | null;
	recommendedTask: TaskRecommendationEntry | null;
	nextTasks: TaskRecommendationEntry[];
	weekTasks: TaskRecommendationEntry[];
	hiddenCount: number;
}

export interface AIRoutingStatusResponse {
	routingMode: "round_robin" | "random" | "fixed";
	fixedProvider: "anthropic" | "openai" | "ollama" | null;
	providerOrder: Array<"anthropic" | "openai" | "ollama">;
	enabledProviders: Array<"anthropic" | "openai" | "ollama">;
	models: {
		anthropic: string;
		openai: string;
		ollama: string;
	};
}

export interface TaskPriorityExplanation {
	taskId: string;
	score: number;
	layer: "Now" | "Next" | "ThisWeek" | "Hidden";
	factors: {
		deadline: number;
		protected: number;
		projectHealth: number;
		capacity: number;
		age: number;
	};
	overrideActive: boolean;
	overrideExpiresAt: string | null;
	overrideReason: string | null;
	reason: string;
}

export interface TaskPriorityOverrideInput {
	mode: "promote" | "demote" | "set";
	score?: number;
	reason?: string;
}

export interface TaskPriorityOverrideResponse {
	task: Task;
	warning: string | null;
}

export interface PMAIIngestDocumentInput {
	documentType: "tsd" | "prd" | "contract" | "feature_spec";
	title?: string;
	documentText?: string;
	documentBase64?: string;
	projectId?: string;
	ideaTaskId?: string;
	usageMode?: "individual" | "team";
	teamMemberIds?: string[];
	createTasks?: boolean;
	createMilestones?: boolean;
	selectedMilestoneTitles?: string[];
	maxTasks?: number;
	maxMilestones?: number;
}

export interface PMAIAnalyzeVideoInput {
	videoSource: "jam.dev" | "loom" | "upload" | "youtube";
	videoUrl?: string | null;
	videoFile?: string | null;
	additionalContext?: string;
}

export interface PMAIAnalyzeImagesInput {
	images: Array<{
		source: "upload" | "figma" | "url" | "clipboard";
		url?: string | null;
		base64?: string | null;
	}>;
	context?: string;
	requestType?: "feature" | "bug";
}

export interface PMAIDecomposeTaskInput {
	taskId: string;
	decompositionStrategy?: "auto" | "architectural" | "feature" | "sequential";
}

export interface PMAISuggestAssigneeInput {
	taskId?: string;
	requiredSkills: string[];
	currentSprint?: string | null;
	teamMemberIds?: string[];
}

export interface PMAIPlanSprintInput {
	sprintId: string;
	durationWeeks: number;
	teamMemberIds: string[];
	backlogTaskIds: string[];
	goalType: "max_completion" | "balanced" | "specific_tasks";
}

export interface PMAIRebalanceSprintInput {
	sprintId: string;
	currentDay: number;
	progressData: Array<{
		userId: string;
		completedSessions: number;
		expectedSessions: number;
		remainingTasks: string[];
	}>;
}
