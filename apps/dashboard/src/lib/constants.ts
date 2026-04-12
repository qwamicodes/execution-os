import {
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	Circle,
	Clock,
	Inbox,
	Loader2,
	Pause,
	XCircle,
	Zap,
} from "lucide-react";
import moment from "moment";
import type {
	ProjectType,
	SessionOutcome,
	TaskSize,
	TaskState,
	TaskUrgency,
} from "./types";

// ─── Task State ──────────────────────────────────────────────────────────────

export const TASK_STATE_CONFIG: Record<
	TaskState,
	{ label: string; color: string; icon: typeof Circle }
> = {
	Inbox: { label: "Inbox", color: "text-gray-600 bg-gray-100", icon: Inbox },
	Ongoing: {
		label: "Ongoing",
		color: "text-amber-600 bg-amber-100",
		icon: Loader2,
	},
	Ready: { label: "Ready", color: "text-blue-600 bg-blue-100", icon: Zap },
	Active: {
		label: "Active",
		color: "text-green-600 bg-green-100",
		icon: ArrowRight,
	},
	Blocked: {
		label: "Blocked",
		color: "text-red-600 bg-red-100",
		icon: XCircle,
	},
	Paused: {
		label: "Paused",
		color: "text-yellow-600 bg-yellow-100",
		icon: Pause,
	},
	Done: {
		label: "Done",
		color: "text-emerald-600 bg-emerald-100",
		icon: CheckCircle2,
	},
};

// ─── Task Size ───────────────────────────────────────────────────────────────

export const TASK_SIZE_CONFIG: Record<
	TaskSize,
	{ label: string; shortLabel: string; color: string }
> = {
	Small: { label: "Small", shortLabel: "S", color: "text-green-600" },
	Medium: { label: "Medium", shortLabel: "M", color: "text-blue-600" },
	Large: { label: "Large", shortLabel: "L", color: "text-orange-600" },
	Huge: { label: "Huge", shortLabel: "XL", color: "text-red-600" },
};

// ─── Task Urgency ────────────────────────────────────────────────────────────

export const TASK_URGENCY_CONFIG: Record<
	TaskUrgency,
	{ label: string; color: string }
> = {
	Urgent: { label: "Urgent", color: "text-red-600 bg-red-100" },
	High: { label: "High", color: "text-orange-600 bg-orange-100" },
	Medium: { label: "Medium", color: "text-yellow-600 bg-yellow-100" },
	Low: { label: "Low", color: "text-gray-600 bg-gray-100" },
};

// ─── Project Type ────────────────────────────────────────────────────────────

export const PROJECT_TYPE_CONFIG: Record<
	ProjectType,
	{ label: string; emoji: string }
> = {
	Clients: { label: "Clients", emoji: "👥" },
	Core: { label: "Core", emoji: "🎯" },
	InHouse: { label: "InHouse", emoji: "🧪" },
	Office: { label: "Office", emoji: "🏢" },
};

// ─── Session Outcome ─────────────────────────────────────────────────────────

export const SESSION_OUTCOME_CONFIG: Record<
	SessionOutcome,
	{ label: string; description: string; color: string; icon: typeof Circle }
> = {
	Done: {
		label: "Done",
		description: "Task is complete",
		color: "text-emerald-600 bg-emerald-100",
		icon: CheckCircle2,
	},
	Continue: {
		label: "Continue",
		description: "Made progress, more to do",
		color: "text-blue-600 bg-blue-100",
		icon: ArrowRight,
	},
	Blocked: {
		label: "Blocked",
		description: "Got stuck on something",
		color: "text-red-600 bg-red-100",
		icon: XCircle,
	},
	TooBig: {
		label: "Too Big",
		description: "Task needs to be broken down",
		color: "text-orange-600 bg-orange-100",
		icon: AlertTriangle,
	},
};

// ─── Colors ──────────────────────────────────────────────────────────────────

export const PROJECT_COLORS = [
	"#6366f1", // indigo
	"#8b5cf6", // violet
	"#ec4899", // pink
	"#f43f5e", // rose
	"#f97316", // orange
	"#eab308", // yellow
	"#22c55e", // green
	"#06b6d4", // cyan
	"#3b82f6", // blue
	"#64748b", // slate
];

// ─── Valid Transitions ───────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
	Inbox: ["Ongoing", "Ready"],
	Ongoing: ["Ready", "Done"],
	Ready: ["Active", "Ongoing", "Blocked", "Paused", "Done"],
	Active: ["Ready", "Blocked", "Paused", "Done"],
	Blocked: ["Ready", "Ongoing"],
	Paused: ["Ready", "Ongoing"],
	Done: ["Ready"],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatRelativeTime(dateString: string): string {
	const m = moment(dateString);
	if (!m.isValid()) return "Invalid date";
	return m.fromNow();
}

export function formatDate(dateString: string): string {
	const m = moment(dateString);
	if (!m.isValid()) return "Invalid date";
	return m.format("MMM D, YYYY");
}

export function isOverdue(deadline: string): boolean {
	const due = moment(deadline);
	if (!due.isValid()) return false;
	return due.isBefore(moment());
}

export function formatSessionTime(seconds: number): string {
	const safeSeconds = Math.max(0, Math.floor(seconds));
	const mins = Math.floor(safeSeconds / 60);
	const secs = safeSeconds % 60;
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatLoggedDuration(minutes: number): string {
	const safeMinutes = Math.max(0, Math.floor(minutes));
	if (safeMinutes < 60) return `${safeMinutes}m`;

	const totalHours = Math.floor(safeMinutes / 60);
	const remMinutes = safeMinutes % 60;
	if (totalHours < 24) {
		return remMinutes > 0 ? `${totalHours}h ${remMinutes}m` : `${totalHours}h`;
	}

	const days = Math.floor(totalHours / 24);
	const remHours = totalHours % 24;
	if (remHours > 0) return `${days}d ${remHours}h`;
	return `${days}d`;
}

const PROJECT_TYPE_BRANCH_PREFIX: Record<string, string> = {
	Clients: "client",
	Core: "feat",
	InHouse: "inhouse",
	Office: "office",
};

export function generateBranchName(task: {
	title: string;
	project?: { type: string } | null;
}): string {
	const prefix = task.project?.type
		? (PROJECT_TYPE_BRANCH_PREFIX[task.project.type] ?? "task")
		: "task";

	const slug = task.title
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-")
		.slice(0, 50)
		.replace(/-$/, "");

	return `${prefix}/${slug}`;
}
