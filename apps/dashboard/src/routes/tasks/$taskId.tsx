import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Separator } from "@repo/ui/components/ui/separator";
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
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { StartSessionDialog } from "@/components/sessions/start-session-dialog";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import { DecomposeTaskDialog } from "@/components/tasks/decompose-task-dialog";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { StateHistoryEntry } from "@/components/tasks/state-history-entry";
import { SubtaskRow } from "@/components/tasks/subtask-row";
import { TaskStateDropdown } from "@/components/tasks/task-state-dropdown";
import { useConvertTaskToIdea } from "@/hooks/use-ideas";
import {
	useDecomposeTask,
	useDeleteTask,
	useTask,
	useUpdateTask,
} from "@/hooks/use-tasks";
import {
	formatDate,
	isOverdue,
	TASK_SIZE_CONFIG,
	TASK_URGENCY_CONFIG,
} from "@/lib/constants";
import type { Task, TaskState } from "@/lib/types";

export const Route = createFileRoute("/tasks/$taskId")({
	component: TaskDetailPage,
});

function StaggerReveal({
	visible,
	delayMs = 0,
	className = "",
	children,
}: {
	visible: boolean;
	delayMs?: number;
	className?: string;
	children: ReactNode;
}) {
	const style: CSSProperties = { transitionDelay: `${delayMs}ms` };

	return (
		<div
			style={style}
			className={`transform-gpu transition-[opacity,transform] duration-700 ease-out will-change-transform ${visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"} ${className}`}
		>
			{children}
		</div>
	);
}

function readFeatureGate(task: Task | undefined) {
	if (!task) {
		return {
			blocked: false,
			reason: null as string | null,
			blockingTaskIds: [] as string[],
			blocksTaskIds: [] as string[],
		};
	}
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
	const [isLoaded, setIsLoaded] = useState(false);
	const updateTask = useUpdateTask();
	const convertTaskToIdea = useConvertTaskToIdea();
	const deleteTask = useDeleteTask();
	const decomposeTask = useDecomposeTask();
	const [editOpen, setEditOpen] = useState(false);
	const [sessionOpen, setSessionOpen] = useState(false);
	const [decomposeOpen, setDecomposeOpen] = useState(false);

	useEffect(() => {
		const frame = requestAnimationFrame(() => setIsLoaded(true));
		return () => cancelAnimationFrame(frame);
	}, []);

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

	function handleDecompose(feedback?: string) {
		if (!task) return;
		decomposeTask.mutate(
			{ id: task.id, data: { feedback } },
			{
				onSuccess: () => {
					toast.success("Decomposition requested", {
						action: {
							label: "View subtasks",
							successLabel: "Opened",
							onClick: () => {
								document
									.getElementById("subtasks-section")
									?.scrollIntoView({ behavior: "smooth", block: "start" });
							},
						},
					});
					setDecomposeOpen(false);
				},
				onError: (error) => {
					toast.error(error.message);
				},
			},
		);
	}

	function handleConvertToIdea() {
		if (!task) return;
		convertTaskToIdea.mutate(
			task.id,
			{
				onSuccess: (result) => {
					toast.success("Task converted to idea", {
						description: result.migration.suggestion,
					});
					navigate({ to: "/ideas/$ideaId", params: { ideaId: result.idea.id } });
				},
				onError: (error) => {
					toast.error(error.message);
				},
			},
		);
	}

	return (
		<div className="relative space-y-6 overflow-hidden">
			<div aria-hidden className="pointer-events-none absolute inset-0">
				<div className="absolute -top-20 left-1/3 h-56 w-56 rounded-full bg-sky-200/30 blur-3xl" />
				<div className="absolute right-0 top-24 h-52 w-52 rounded-full bg-cyan-100/45 blur-3xl" />
			</div>

			<div className="relative space-y-6">
				<StaggerReveal visible={isLoaded} delayMs={20}>
					<nav className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-xs text-slate-600 shadow-sm backdrop-blur">
						<Link to="/tasks" className="font-medium hover:text-slate-900">
							Tasks
						</Link>
						<ChevronRight className="h-3 w-3" />
						<span className="max-w-60 truncate text-slate-900">
							{task.title}
						</span>
					</nav>
				</StaggerReveal>

				<StaggerReveal visible={isLoaded} delayMs={90}>
					<Card className="overflow-hidden border-sky-100 bg-linear-to-br from-white via-slate-50/70 to-sky-50/80 shadow-lg shadow-slate-200/60">
						<CardContent className="space-y-4 p-6 sm:p-7">
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="mb-2 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-medium text-sky-700">
										<Sparkles className="h-3 w-3" />
										Task Detail
									</div>
									<h1 className="text-3xl font-semibold tracking-tight wrap-break-word text-slate-950 sm:text-4xl">
										<span className="inline-flex items-center gap-2">
											{task.title}
											<HelpTooltip
												feature="Task Detail"
												what="Full execution context for one task."
												use="Review metadata, update state, and drive execution actions from here."
												works="Combines task data, subtasks, state history, and actions in one view."
											/>
										</span>
									</h1>
									<div className="mt-3 flex flex-wrap items-center gap-2">
										<TaskStateDropdown
											currentState={task.state}
											onStateChange={handleStateChange}
											disabled={task.state === "Active"}
										/>
										{task.project && (
											<Badge
												variant="secondary"
												className="bg-slate-100 text-slate-700"
											>
												<FolderKanban className="mr-1 h-3 w-3" />
												{task.project.name}
											</Badge>
										)}
										{task.size && (
											<Badge
												variant="outline"
												className="border-slate-200 bg-white text-slate-700"
											>
												<Layers3 className="mr-1 h-3 w-3" />
												{TASK_SIZE_CONFIG[task.size].label}
											</Badge>
										)}
										{task.urgency && (
											<Badge
												variant="outline"
												className={`border-0 ${TASK_URGENCY_CONFIG[task.urgency].color}`}
											>
												{TASK_URGENCY_CONFIG[task.urgency].label}
											</Badge>
										)}
										{task.protected && (
											<Badge
												variant="outline"
												className="border-red-200 bg-red-50 text-red-700"
											>
												<Shield className="mr-1 h-3 w-3" />
												Protected
											</Badge>
										)}
										{featureGate.blocked && (
											<Badge
												variant="outline"
												className="border-amber-200 bg-amber-50 text-amber-700"
											>
												Feature blocked
											</Badge>
										)}
										{task.deadline && (
											<span
												className={`inline-flex items-center text-sm ${isOverdue(task.deadline) ? "text-red-600" : "text-slate-600"}`}
											>
												<Calendar className="mr-1 h-3.5 w-3.5" />
												{formatDate(task.deadline)}
											</span>
										)}
									</div>
								</div>

								<div className="flex shrink-0 items-center gap-2">
									{(task.state === "Ready" || task.state === "Active") && (
										<div className="flex items-center gap-1.5">
											<Button
												size="sm"
												onClick={() => setSessionOpen(true)}
												className="bg-slate-950 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
											>
												<Play className="mr-1 h-4 w-4" />
												Start Session
											</Button>
											<HelpTooltip
												feature="Start Session"
												what="Begins a focus session on this task."
												use="Use when the task is ready and you are committing focused time."
												works="Creates an active timer session linked to this task id."
											/>
										</div>
									)}
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="outline"
												size="icon"
												className="border-slate-200 bg-white"
											>
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
						</CardContent>
					</Card>
				</StaggerReveal>

				<div className="grid gap-6 lg:grid-cols-3">
					<div className="space-y-6 lg:col-span-2">
						<StaggerReveal visible={isLoaded} delayMs={160}>
							<Card className="border-white/80 bg-white/95 shadow-sm">
								<CardHeader>
									<CardTitle className="inline-flex items-center gap-2 text-base">
										Description
										<HelpTooltip
											feature="Task Description"
											what="Defines scope, context, and delivery criteria."
											use="Keep this section updated with the latest implementation details."
											works="Stored as task description field and reused by AI planning features."
										/>
									</CardTitle>
								</CardHeader>
								<CardContent>
									{task.description ? (
										<p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
											{task.description}
										</p>
									) : (
										<p className="text-sm text-slate-500">No description</p>
									)}
								</CardContent>
							</Card>
						</StaggerReveal>

						<StaggerReveal visible={isLoaded} delayMs={220}>
							{featureGate.blocked && (
								<Card className="border-amber-200/80 bg-amber-50/40 shadow-sm">
									<CardHeader>
										<CardTitle className="text-base text-amber-900">
											Feature Blocking
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-3">
										<div>
											<p className="text-sm font-medium text-amber-900">
												This task is blocked by feature readiness.
											</p>
											{featureGate.reason && (
												<p className="mt-1 text-sm text-amber-800">
													{featureGate.reason}
												</p>
											)}
										</div>
										{featureGate.blockingTaskIds.length > 0 && (
											<div className="rounded-md border border-amber-200 bg-white/80 p-3">
												<p className="text-xs uppercase tracking-wide text-amber-700">
													Blocking tasks
												</p>
												<div className="mt-1 flex flex-wrap items-center gap-2">
													{featureGate.blockingTaskIds.map((blockingTaskId) => (
														<Link
															key={blockingTaskId}
															to="/tasks/$taskId"
															params={{ taskId: blockingTaskId }}
															className="inline-flex items-center gap-1 text-sm font-medium text-amber-900 underline underline-offset-2"
														>
															<Link2 className="h-3.5 w-3.5" />
															{blockingTaskId}
														</Link>
													))}
												</div>
											</div>
										)}
										{featureGate.blocksTaskIds.length > 0 && (
											<div className="rounded-md border border-amber-200 bg-white/80 p-3">
												<p className="text-xs uppercase tracking-wide text-amber-700">
													Tasks being blocked
												</p>
												<div className="mt-1 flex flex-wrap items-center gap-2">
													{featureGate.blocksTaskIds.map((blockedTaskId) => (
														<Link
															key={blockedTaskId}
															to="/tasks/$taskId"
															params={{ taskId: blockedTaskId }}
															className="inline-flex items-center gap-1 text-sm font-medium text-amber-900 underline underline-offset-2"
														>
															<Link2 className="h-3.5 w-3.5" />
															{blockedTaskId}
														</Link>
													))}
												</div>
											</div>
										)}
									</CardContent>
								</Card>
							)}
						</StaggerReveal>

						<StaggerReveal visible={isLoaded} delayMs={240}>
							<Card
								id="subtasks-section"
								className="border-white/80 bg-white/95 shadow-sm"
							>
								<CardHeader className="flex-row items-center justify-between space-y-0">
									<CardTitle className="inline-flex items-center gap-2 text-base">
										Subtasks ({task.subtasks?.length || 0})
										<HelpTooltip
											feature="Subtasks"
											what="Breakdown of the parent task into smaller executable parts."
											use="Track progress by moving each subtask through its own state."
											works="Can be manually managed or generated through decomposition."
										/>
									</CardTitle>
									{!task.subtasks?.length && task.size !== "Small" && (
										<Button
											size="sm"
											variant="outline"
											onClick={() => setDecomposeOpen(true)}
											disabled={decomposeTask.isPending}
											className="border-slate-300 bg-white"
										>
											{decomposeTask.isPending ? "Decomposing..." : "Decompose"}
										</Button>
									)}
								</CardHeader>
								<CardContent>
									{task.subtasks && task.subtasks.length > 0 ? (
										<div className="space-y-1.5">
											{task.subtasks.map((subtask) => (
												<SubtaskRow
													key={subtask.id}
													task={subtask}
													onStateChange={(id, state) =>
														updateTask.mutate({
															id,
															data: { state },
														})
													}
													onSelect={(id) =>
														navigate({
															to: "/tasks/$taskId",
															params: { taskId: id },
														})
													}
												/>
											))}
										</div>
									) : (
										<p className="text-sm text-slate-500">
											No subtasks yet. Use &quot;Decompose&quot; to break this
											task down.
										</p>
									)}
								</CardContent>
							</Card>
						</StaggerReveal>
					</div>

					<div className="space-y-6">
						<StaggerReveal visible={isLoaded} delayMs={190}>
							<Card className="border-white/80 bg-white/95 shadow-sm">
								<CardHeader>
									<CardTitle className="inline-flex items-center gap-2 text-base">
										Snapshot
										<HelpTooltip
											feature="Snapshot"
											what="At-a-glance metadata summary for this task."
											use="Use this panel to confirm priority, size, urgency, and tracking fields."
											works="Reads normalized task fields and derived labels from constants."
										/>
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<MetadataRow
										label="Project"
										value={task.project?.name || "None"}
										icon={FolderKanban}
									/>
									<Separator />
									<MetadataRow
										label="Project part"
										value={task.part?.name || "None"}
										icon={Layers3}
									/>
									<Separator />
									<MetadataRow
										label="Size"
										value={
											task.size ? TASK_SIZE_CONFIG[task.size].label : "Not set"
										}
										icon={Layers3}
									/>
									<Separator />
									<MetadataRow
										label="Urgency"
										value={
											task.urgency
												? TASK_URGENCY_CONFIG[task.urgency].label
												: "Not set"
										}
										icon={Sparkles}
									/>
									<Separator />
									<MetadataRow
										label="Sessions"
										value={`${task.completedSessions} completed`}
										icon={Clock3}
									/>
									<Separator />
									<MetadataRow
										label="Protected"
										value={task.protected ? "Yes" : "No"}
										icon={Shield}
									/>
									<Separator />
									<MetadataRow
										label="Tags"
										value={task.tags.length ? task.tags.join(", ") : "None"}
										icon={Tag}
									/>
									<Separator />
									<MetadataRow label="Source" value={task.source} />
									<Separator />
									<MetadataRow
										label="Created"
										value={formatDate(task.createdAt)}
									/>
								</CardContent>
							</Card>
						</StaggerReveal>

						<StaggerReveal visible={isLoaded} delayMs={250}>
							<Card className="border-white/80 bg-white/95 shadow-sm">
								<CardHeader>
									<CardTitle className="inline-flex items-center gap-2 text-base">
										History
										<HelpTooltip
											feature="State History"
											what="Chronological log of task state transitions."
											use="Review this when diagnosing workflow delays or regressions."
											works="Persists state transition events and renders them in timeline order."
										/>
									</CardTitle>
								</CardHeader>
								<CardContent>
									{task.stateHistory && task.stateHistory.length > 0 ? (
										<ScrollArea className="h-52 pr-2">
											{task.stateHistory.map((entry) => (
												<StateHistoryEntry key={entry.id} entry={entry} />
											))}
										</ScrollArea>
									) : (
										<p className="text-sm text-slate-500">No history yet</p>
									)}
								</CardContent>
							</Card>
						</StaggerReveal>
					</div>
				</div>
			</div>

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
					taskTitle={task.title}
					onSubmit={({ feedback }) => handleDecompose(feedback)}
				/>
			)}
		</div>
	);
}

function MetadataRow({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: string;
	icon?: ComponentType<{ className?: string }>;
}) {
	return (
		<div className="flex items-center justify-between">
			<span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
				{Icon ? <Icon className="h-3.5 w-3.5" /> : null}
				{label}
			</span>
			<span className="max-w-[60%] truncate text-right text-sm font-medium text-slate-900">
				{value}
			</span>
		</div>
	);
}
