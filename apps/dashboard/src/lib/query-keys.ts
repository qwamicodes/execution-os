import type {
	IdeaFilters,
	InboxFilters,
	ProjectFilters,
	SessionHistoryFilters,
	TaskFilters,
} from "./types";

export const queryKeys = {
	user: ["user"] as const,

	projects: {
		all: ["projects"] as const,
		list: (filters?: ProjectFilters) => ["projects", "list", filters] as const,
		detail: (id: string) => ["projects", "detail", id] as const,
		milestones: (projectId: string) =>
			["projects", "milestones", projectId] as const,
		parts: (projectId: string) => ["projects", "parts", projectId] as const,
		epics: (projectId: string) => ["projects", "epics", projectId] as const,
	},

	tasks: {
		all: ["tasks"] as const,
		list: (filters?: TaskFilters) => ["tasks", "list", filters] as const,
		detail: (id: string) => ["tasks", "detail", id] as const,
		subtasks: (id: string) => ["tasks", "subtasks", id] as const,
	},
	ideas: {
		all: ["ideas"] as const,
		list: (filters?: IdeaFilters) => ["ideas", "list", filters] as const,
		detail: (id: string) => ["ideas", "detail", id] as const,
	},

	sessions: {
		active: ["sessions", "active"] as const,
		detail: (id: string) => ["sessions", "detail", id] as const,
		history: (filters?: SessionHistoryFilters) =>
			["sessions", "history", filters] as const,
	},

	inbox: ["inbox"] as const,
	inboxList: (filters?: InboxFilters) => ["inbox", "list", filters] as const,

	integrations: ["integrations"] as const,

	ai: {
		providers: ["ai", "providers"] as const,
		recommendation: (forceRefresh?: boolean) =>
			["ai", "recommendation", forceRefresh ?? false] as const,
	},

	pmAi: {
		all: ["pm-ai"] as const,
	},

	search: (q: string) => ["search", q] as const,
};
