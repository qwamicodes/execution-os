import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Progress } from "@repo/ui/components/ui/progress";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { goeyToast as toast } from "goey-toast";
import {
	Calendar,
	ChevronRight,
	Clock3,
	FolderKanban,
	Layers3,
	Link2,
	MoreHorizontal,
	Pencil,
	Play,
	Shield,
	Sparkles,
	Tag,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { StartSessionDialog } from "@/components/sessions/start-session-dialog";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import { TaskAISuggestionPanel } from "@/components/tasks/ai-suggestion-panel";
import { DecomposeTaskDialog } from "@/components/tasks/decompose-task-dialog";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { StateHistoryEntry } from "@/components/tasks/state-history-entry";
import { SubtaskRow } from "@/components/tasks/subtask-row";
import { TaskStateDropdown } from "@/components/tasks/task-state-dropdown";
import { useConvertTaskToIdea } from "@/hooks/use-ideas";
import {
	useAIClassifyTask,
	useDecomposeTask,
	useDeleteTask,
	usePreviewTaskDecomposition,
	useTask,
	useUpdateTask,
} from "@/hooks/use-tasks";
import {
	formatDate,
	isOverdue,
	TASK_SIZE_CONFIG,
	TASK_URGENCY_CONFIG,
} from "@/lib/constants";
import type { DecompositionPreview, Task, TaskState } from "@/lib/types";

export const Route = createFileRoute("/tasks/$taskId")({
	component: TaskDetailPage,
});

function readFeatureGate(task: Task | undefined) {
	if (!task)
		return {
			blocked: false,
			reason: null as string | null,
			blockingTaskIds: [] as string[],
			blocksTaskIds: [] as string[],
		};
	const fallbackBlocked = task.featureBlocked === true;
	const fallbackReason = task.featureBlockReason ?? null;
	if (!task.sourceMetadata || typeof task.sourceMetadata !== "object") {
		return {
			blocked: fallbackBlocked,
			reason: fallbackReason,
			blockingTaskIds: [] as string[],
			blocksTaskIds: [] as string[],
		};
	}
	const metadata = task.sourceMetadata as Record<string, unknown>;
	const featureGate = metadata.featureGate;
	if (!featureGate || typeof featureGate !== "object") {
		return {
			blocked: fallbackBlocked,
			reason: fallbackReason,
			blockingTaskIds: [] as string[],
			blocksTaskIds: [] as string[],
		};
	}
	const gate = featureGate as Record<string, unknown>;
	const blockingTaskIds = Array.isArray(gate.blockingTaskIds)
		? gate.blockingTaskIds.filter((id): id is string => typeof id === "string")
		: typeof gate.blockingTaskId === "string"
			? [gate.blockingTaskId]
			: [];
	const blocksTaskIds = Array.isArray(gate.blocksTaskIds)
		? gate.blocksTaskIds.filter((id): id is string => typeof id === "string")
		: typeof gate.blocksTaskId === "string"
			? [gate.blocksTaskId]
			: [];
	return {
		blocked: gate.blocked === true || fallbackBlocked,
		reason:
			typeof gate.reason === "string" && gate.reason.trim().length > 0
				? gate.reason
				: fallbackReason,
		blockingTaskIds: Array.from(new Set(blockingTaskIds)),
		blocksTaskIds: Array.from(new Set(blocksTaskIds)),
	};
}

function TaskDetailPage() {
	const { taskId } = Route.useParams();
	const navigate = useNavigate();
	const { data: task, isLoading } = useTask(taskId);
	const featureGate = readFeatureGate(task);
	const [visible, setVisible] = useState(false);
	const updateTask = useUpdateTask();
	const aiClassifyTask = useAIClassifyTask();
	const convertTaskToIdea = useConvertTaskToIdea();
	const deleteTask = useDeleteTask();
	const decomposeTask = useDecomposeTask();
	const previewDecomposition = usePreviewTaskDecomposition();
	const [editOpen, setEditOpen] = useState(false);
	const [sessionOpen, setSessionOpen] = useState(false);
	const [decomposeOpen, setDecomposeOpen] = useState(false);
	const [decompositionPreview, setDecompositionPreview] =
		useState<DecompositionPreview | null>(null);

	useEffect(() => {
		const frame = requestAnimationFrame(() => setVisible(true));
		return () => cancelAnimationFrame(frame);
	}, []);

	useEffect(() => {
		if (!decomposeOpen) setDecompositionPreview(null);
	}, [decomposeOpen]);

	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Spinner size="lg" />
			</div>
		);
	}

	if (!task) {
		return (
			<div className="flex h-64 items-center justify-center">
				<p className="text-muted-foreground">Task not found</p>
			</div>
		);
	}

	function handleStateChange(newState: TaskState) {
		if (!task) return;
		updateTask.mutate({ id: task.id, data: { state: newState } });
	}

	function handleDelete() {
		if (!task) return;
		deleteTask.mutate(task.id, {
			onSuccess: () => {
				toast.success("Task deleted");
				navigate({ to: "/tasks" });
			},
		});
	}

	function handlePreviewDecomposition(feedback?: string) {
		if (!task) return;
		previewDecomposition.mutate(
			{ id: task.id, data: { feedback } },
			{
				onSuccess: (preview) => setDecompositionPreview(preview),
				onError: (error) => toast.error(error.message),
			},
		);
	}

	function handleApplyDecomposition(input: {
		feedback?: string;
		replaceExisting?: boolean;
		subtasks: DecompositionPreview["subtasks"];
	}) {
		if (!task) return;
		decomposeTask.mutate(
			{
				id: task.id,
				data: {
					feedback: input.feedback,
					replaceExisting: input.replaceExisting,
					subtasks: input.subtasks.map((s) => ({
						title: s.title,
						description: s.description,
						estimatedSessions: s.estimatedSessions,
					})),
				},
			},
			{
				onSuccess: (result) => {
					toast.success(
						`${result.subtasksCreated} subtask${result.subtasksCreated === 1 ? "" : "s"} created`,
						{
							action: {
								label: "View subtasks",
								successLabel: "Opened",
								onClick: () =>
									document
										.getElementById("subtasks-section")
										?.scrollIntoView({ behavior: "smooth", block: "start" }),
							},
						},
					);
					setDecompositionPreview(null);
					setDecomposeOpen(false);
				},
				onError: (error) => toast.error(error.message),
			},
		);
	}

	function handleConvertToIdea() {
		if (!task) return;
		convertTaskToIdea.mutate(task.id, {
			onSuccess: (result) => {
				toast.success("Task converted to idea", {
					description: result.migration.suggestion,
				});
				navigate({ to: "/ideas/$ideaId", params: { ideaId: result.idea.id } });
			},
			onError: (error) => toast.error(error.message),
		});
	}

	function handleAISuggestion() {
		if (!task) return;
		aiClassifyTask.mutate(task.id, {
			onSuccess: () => toast.success("AI suggestion ready"),
			onError: (error) => toast.error(error.message),
		});
	}

	const canStartSession = task.state === "Ready" || task.state === "Active";
	const epicDeadlines = (task.epics || [])
		.map((entry) => entry.epic)
		.filter(
			(
				epic,
			): epic is NonNullable<NonNullable<Task["epics"]>[number]["epic"]> & {
				targetDate?: string | null;
			} => Boolean(epic?.targetDate),
		);
	const hasDeadlineContext =
		Boolean(task.deadline) ||
		Boolean(task.milestone?.targetDate) ||
		epicDeadlines.length > 0;

	return (
		<div
			className={`space-y-6 transition-[opacity,transform] duration-500 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
		>
			{/* ── Breadcrumb ── */}
			<nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
				<Link to="/tasks" className="hover:text-foreground transition-colors">
					Tasks
				</Link>
				<ChevronRight className="h-3 w-3" />
				<span className="max-w-72 truncate text-foreground">{task.title}</span>
			</nav>

			{/* ── Title block ── */}
			<div className="space-y-4 rounded-lg border border-border bg-card p-5 sm:p-6">
				{/* Row 1: title + actions */}
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
							{task.title}
						</h1>
					</div>

					{/* Actions */}
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						<Button
							size="sm"
							variant="info"
							onClick={handleAISuggestion}
							disabled={aiClassifyTask.isPending}
							className="h-8 gap-1.5"
						>
							<Sparkles className="h-3.5 w-3.5" />
							{aiClassifyTask.isPending ? "Thinking…" : "AI"}
						</Button>
						{canStartSession && (
							<Button
								size="sm"
								onClick={() => setSessionOpen(true)}
								className="h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
							>
								<Play className="h-3.5 w-3.5" />
								Start session
							</Button>
						)}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon" className="h-8 w-8">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={handleConvertToIdea}>
									Convert to idea
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setEditOpen(true)}>
									<Pencil className="mr-2 h-4 w-4" />
									Edit
								</DropdownMenuItem>
								{task.state !== "Active" && (
									<DropdownMenuItem
										onClick={handleDelete}
										className="text-destructive"
									>
										<Trash2 className="mr-2 h-4 w-4" />
										Delete
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Row 2: state + meta badges */}
				<div className="flex flex-wrap items-center gap-2">
					<TaskStateDropdown
						currentState={task.state}
						onStateChange={handleStateChange}
						disabled={task.state === "Active"}
					/>
					{task.project && (
						<Badge variant="lavender">
							<FolderKanban className="mr-1 h-3 w-3" />
							{task.project.name}
						</Badge>
					)}
					{task.size && (
						<Badge variant={TASK_SIZE_CONFIG[task.size].badge}>
							<Layers3 className="mr-1 h-3 w-3" />
							{TASK_SIZE_CONFIG[task.size].label}
						</Badge>
					)}
					{task.urgency && (
						<Badge variant={TASK_URGENCY_CONFIG[task.urgency].badge}>
							{TASK_URGENCY_CONFIG[task.urgency].label}
						</Badge>
					)}
					{task.protected && (
						<Badge variant="danger">
							<Shield className="mr-1 h-3 w-3" />
							Protected
						</Badge>
					)}
					{featureGate.blocked && (
						<Badge variant="warning">Feature blocked</Badge>
					)}
					{task.deadline && (
						<span
							className={`inline-flex items-center gap-1 text-sm ${isOverdue(task.deadline) ? "text-destructive" : "text-muted-foreground"}`}
						>
							<Calendar className="h-3.5 w-3.5" />
							{formatDate(task.deadline)}
						</span>
					)}
					{!task.deadline && task.milestone?.targetDate && (
						<span
							className={`inline-flex items-center gap-1 text-sm ${isOverdue(task.milestone.targetDate) ? "text-destructive" : "text-muted-foreground"}`}
						>
							<Calendar className="h-3.5 w-3.5" />
							Inherits {formatDate(task.milestone.targetDate)}
						</span>
					)}
				</div>

				{/* AI suggestion inline */}
				<TaskAISuggestionPanel task={task} />
			</div>

			{/* ── Two column grid ── */}
			<div className="grid gap-6 lg:grid-cols-3">
				{/* ── Left column ── */}
				<div className="space-y-5 lg:col-span-2">
					{/* Description */}
					<Section
						title="Description"
						help={{
							feature: "Task Description",
							what: "Defines scope, context, and delivery criteria.",
							use: "Keep this updated with the latest implementation details.",
							works:
								"Stored as task description and reused by AI planning features.",
						}}
					>
						{task.description ? (
							<p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
								{task.description}
							</p>
						) : (
							<p className="text-sm text-muted-foreground italic">
								No description added yet.
							</p>
						)}
					</Section>

					{/* Feature blocking */}
					{featureGate.blocked && (
						<div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
							<div className="flex items-center gap-2">
								<Link2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
								<h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
									Feature Blocking
								</h3>
							</div>
							{featureGate.reason && (
								<p className="text-sm text-amber-700 dark:text-amber-400">
									{featureGate.reason}
								</p>
							)}
							{featureGate.blockingTaskIds.length > 0 && (
								<div className="space-y-1">
									<p className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-500">
										Blocking tasks
									</p>
									<div className="flex flex-wrap gap-2">
										{featureGate.blockingTaskIds.map((id) => (
											<Link
												key={id}
												to="/tasks/$taskId"
												params={{ taskId: id }}
												className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300 underline underline-offset-2"
											>
												<Link2 className="h-3 w-3" />
												{id.slice(0, 8)}
											</Link>
										))}
									</div>
								</div>
							)}
							{featureGate.blocksTaskIds.length > 0 && (
								<div className="space-y-1">
									<p className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-500">
										Blocking downstream
									</p>
									<div className="flex flex-wrap gap-2">
										{featureGate.blocksTaskIds.map((id) => (
											<Link
												key={id}
												to="/tasks/$taskId"
												params={{ taskId: id }}
												className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300 underline underline-offset-2"
											>
												<Link2 className="h-3 w-3" />
												{id.slice(0, 8)}
											</Link>
										))}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Subtasks */}
					<Section
						id="subtasks-section"
						title={`Subtasks${task.subtasks?.length ? ` · ${task.subtasks.length}` : ""}`}
						help={{
							feature: "Subtasks",
							what: "Breakdown of the parent task into smaller executable parts.",
							use: "Track progress by moving each subtask through its own state.",
							works:
								"Can be manually managed or generated through decomposition.",
						}}
						action={
							task.size !== "Small" ? (
								<Button
									size="sm"
									variant="outline"
									onClick={() => setDecomposeOpen(true)}
									disabled={
										decomposeTask.isPending || previewDecomposition.isPending
									}
									className="h-7 text-xs"
								>
									<Sparkles className="mr-1 h-3 w-3" />
									{decomposeTask.isPending
										? "Applying…"
										: previewDecomposition.isPending
											? "Generating…"
											: task.subtasks?.length
												? "Regenerate"
												: "Decompose"}
								</Button>
							) : null
						}
					>
						{task.subtaskProgress && task.subtaskProgress.total > 0 && (
							<div className="mb-3 space-y-1.5">
								<div className="flex items-center justify-between text-xs text-muted-foreground">
									<span>Progress</span>
									<span className="tabular-nums">
										{task.subtaskProgress.completed} /{" "}
										{task.subtaskProgress.total}
									</span>
								</div>
								<Progress
									value={task.subtaskProgress.percent}
									className="h-1.5"
								/>
							</div>
						)}
						{task.subtasks && task.subtasks.length > 0 ? (
							<div className="space-y-1">
								{task.subtasks.map((subtask) => (
									<SubtaskRow
										key={subtask.id}
										task={subtask}
										onStateChange={(id, state) =>
											updateTask.mutate({ id, data: { state } })
										}
										onSelect={(id) =>
											navigate({ to: "/tasks/$taskId", params: { taskId: id } })
										}
									/>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								No subtasks yet. Use Decompose to break this down.
							</p>
						)}
					</Section>
				</div>

				{/* ── Right sidebar ── */}
				<div className="space-y-5">
					{/* Deadline context */}
					{hasDeadlineContext && (
						<Section
							title="Deadline Context"
							help={{
								feature: "Inherited Deadlines",
								what: "Shows direct task deadline plus deadline pressure inherited from linked milestone and epics.",
								use: "Use this to understand why a task may score higher in recommendations even without its own deadline.",
								works:
									"Recommendation scoring uses the strongest deadline pressure from task, milestone, and epic dates.",
							}}
						>
							<div className="space-y-2">
								<DeadlineContextRow
									label="Task"
									name={task.title}
									date={task.deadline}
									empty="No direct deadline"
								/>
								<DeadlineContextRow
									label="Milestone"
									name={task.milestone?.title ?? "No milestone"}
									date={task.milestone?.targetDate ?? null}
									empty={
										task.milestone ? "No milestone deadline" : "No milestone"
									}
								/>
								{epicDeadlines.length > 0 ? (
									epicDeadlines.map((epic) => (
										<DeadlineContextRow
											key={epic.id}
											label="Epic"
											name={`${epic.key ? `${epic.key} ` : ""}${epic.name}`}
											date={epic.targetDate ?? null}
											empty="No epic deadline"
										/>
									))
								) : (
									<DeadlineContextRow
										label="Epic"
										name="No epic deadline"
										date={null}
										empty="No epic deadline"
									/>
								)}
							</div>
						</Section>
					)}

					{/* Snapshot */}
					<Section
						title="Snapshot"
						help={{
							feature: "Snapshot",
							what: "At-a-glance metadata summary for this task.",
							use: "Confirm priority, size, urgency, and tracking fields.",
							works:
								"Reads normalized task fields and derived labels from constants.",
						}}
					>
						<dl className="space-y-0 divide-y divide-border/60">
							<MetaRow
								icon={FolderKanban}
								label="Project"
								value={task.project?.name || "—"}
							/>
							<MetaRow
								icon={Layers3}
								label="Parts"
								value={
									(
										task.parts?.map((e) => e.part?.name).filter(Boolean) ?? []
									).join(", ") ||
									task.part?.name ||
									"—"
								}
							/>
							<MetaRow
								label="Epics"
								value={
									(task.epics || [])
										.map((e) =>
											e.epic
												? `${e.epic.key ? `${e.epic.key} ` : ""}${e.epic.name}`
												: null,
										)
										.filter(Boolean)
										.join(", ") || "—"
								}
							/>
							<MetaRow
								label="Priority"
								value={task.priority == null ? "Auto" : `${task.priority}/100`}
							/>
							<MetaRow
								icon={Layers3}
								label="Size"
								value={task.size ? TASK_SIZE_CONFIG[task.size].label : "—"}
							/>
							<MetaRow
								icon={Sparkles}
								label="Urgency"
								value={
									task.urgency ? TASK_URGENCY_CONFIG[task.urgency].label : "—"
								}
							/>
							<MetaRow
								icon={Clock3}
								label="Sessions"
								value={`${task.completedSessions} completed`}
							/>
							<MetaRow
								icon={Shield}
								label="Protected"
								value={task.protected ? "Yes" : "No"}
							/>
							<MetaRow
								icon={Tag}
								label="Tags"
								value={task.tags.length ? task.tags.join(", ") : "—"}
							/>
							<MetaRow label="Source" value={task.source} />
							<MetaRow label="Created" value={formatDate(task.createdAt)} />
						</dl>
					</Section>

					{/* History */}
					<Section
						title="History"
						help={{
							feature: "State History",
							what: "Chronological log of task state transitions.",
							use: "Review when diagnosing workflow delays.",
							works: "Persists state transition events in timeline order.",
						}}
					>
						{task.stateHistory && task.stateHistory.length > 0 ? (
							<ScrollArea className="h-48 pr-1">
								<div className="space-y-0">
									{task.stateHistory.map((entry) => (
										<StateHistoryEntry key={entry.id} entry={entry} />
									))}
								</div>
							</ScrollArea>
						) : (
							<p className="text-sm text-muted-foreground">No history yet.</p>
						)}
					</Section>
				</div>
			</div>

			{/* Dialogs */}
			{editOpen && (
				<EditTaskDialog
					task={task}
					open={editOpen}
					onOpenChange={setEditOpen}
				/>
			)}
			{sessionOpen && (
				<StartSessionDialog
					task={task}
					open={sessionOpen}
					onOpenChange={setSessionOpen}
				/>
			)}
			{decomposeOpen && (
				<DecomposeTaskDialog
					open={decomposeOpen}
					onOpenChange={setDecomposeOpen}
					isSubmitting={decomposeTask.isPending}
					isPreviewing={previewDecomposition.isPending}
					taskTitle={task.title}
					existingSubtaskCount={task.subtasks?.length ?? 0}
					preview={decompositionPreview}
					onPreview={({ feedback }) => handlePreviewDecomposition(feedback)}
					onRegenerate={({ feedback }) => handlePreviewDecomposition(feedback)}
					onApply={(input) => handleApplyDecomposition(input)}
				/>
			)}
		</div>
	);
}

// ── Shared section wrapper ────────────────────────────────────────────────────

function Section({
	id,
	title,
	help,
	action,
	children,
}: {
	id?: string;
	title: string;
	help?: { feature: string; what: string; use: string; works: string };
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div id={id} className="rounded-lg border border-border bg-card">
			<div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
				<h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
					{title}
					{help && <HelpTooltip {...help} className="h-4 w-4" />}
				</h2>
				{action}
			</div>
			<div className="p-4">{children}</div>
		</div>
	);
}

// ── Deadline context row ─────────────────────────────────────────────────────

function DeadlineContextRow({
	label,
	name,
	date,
	empty,
}: {
	label: string;
	name: string;
	date: string | null | undefined;
	empty: string;
}) {
	const overdue = Boolean(date && isOverdue(date));

	return (
		<div className="rounded-md border border-border bg-muted/20 px-3 py-2">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
						{label}
					</p>
					<p className="mt-0.5 truncate text-xs font-medium text-foreground">
						{name}
					</p>
				</div>
				<div
					className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${overdue ? "text-destructive" : date ? "text-foreground" : "text-muted-foreground"}`}
				>
					<Calendar className="h-3.5 w-3.5" />
					{date ? formatDate(date) : empty}
				</div>
			</div>
		</div>
	);
}

// ── Metadata row ─────────────────────────────────────────────────────────────

function MetaRow({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: string;
	icon?: React.ComponentType<{ className?: string }>;
}) {
	return (
		<div className="flex items-center justify-between gap-3 py-2">
			<dt className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
				{Icon && <Icon className="h-3.5 w-3.5" />}
				{label}
			</dt>
			<dd className="max-w-[55%] truncate text-right text-xs font-medium text-foreground">
				{value}
			</dd>
		</div>
	);
}
