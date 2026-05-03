import { Badge } from "@repo/ui/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";
import {
	Calendar,
	FolderKanban,
	Link2,
	MoreHorizontal,
	Pencil,
	Repeat,
	Sparkles,
	Trash2,
} from "lucide-react";
import {
	formatDate,
	isOverdue,
	TASK_SIZE_CONFIG,
	TASK_STATE_CONFIG,
	TASK_URGENCY_CONFIG,
	VALID_TRANSITIONS,
} from "@/lib/constants";
import type { Task, TaskState } from "@/lib/types";
import { TaskAISuggestionPanel } from "./ai-suggestion-panel";

// State dot — colored indicator aligned to each task state
const STATE_DOT: Record<string, string> = {
	Inbox: "bg-slate-400 dark:bg-slate-500",
	Ongoing: "bg-amber-400",
	Ready: "bg-blue-400",
	Active: "bg-green-500",
	Blocked: "bg-red-500",
	Paused: "bg-yellow-400",
	Done: "bg-emerald-500",
};

function readFeatureGate(task: Task) {
	const fallbackBlocked = task.featureBlocked === true;
	const fallbackReason = task.featureBlockReason ?? null;
	if (!task.sourceMetadata || typeof task.sourceMetadata !== "object") {
		return {
			blocked: fallbackBlocked,
			reason: fallbackReason,
			blockingTaskId: null as string | null,
		};
	}
	const metadata = task.sourceMetadata as Record<string, unknown>;
	const featureGate = metadata.featureGate;
	if (!featureGate || typeof featureGate !== "object") {
		return {
			blocked: fallbackBlocked,
			reason: fallbackReason,
			blockingTaskId: null as string | null,
		};
	}
	const gate = featureGate as Record<string, unknown>;
	return {
		blocked: gate.blocked === true || fallbackBlocked,
		reason:
			typeof gate.reason === "string" && gate.reason.trim().length > 0
				? gate.reason
				: fallbackReason,
		blockingTaskId:
			typeof gate.blockingTaskId === "string" ? gate.blockingTaskId : null,
	};
}

interface TaskCardProps {
	task: Task;
	onStateChange?: (taskId: string, newState: TaskState) => void;
	onSelect?: (taskId: string) => void;
	onEdit?: (task: Task) => void;
	onDelete?: (taskId: string) => void;
	onConvertToIdea?: (task: Task) => void;
	onAIClassify?: (taskId: string) => void;
	showProject?: boolean;
	compact?: boolean;
}

export function TaskCard({
	task,
	onStateChange,
	onSelect,
	onEdit,
	onDelete,
	onConvertToIdea,
	onAIClassify,
	showProject = true,
	compact = false,
}: TaskCardProps) {
	const stateConfig = TASK_STATE_CONFIG[task.state];
	const validTransitions = VALID_TRANSITIONS[task.state];
	const featureGate = readFeatureGate(task);
	const showParts = task.project?.structureType === "Monorepo";
	const hasMenu =
		onStateChange || onEdit || onDelete || onConvertToIdea || onAIClassify;
	const isDone = task.state === "Done";

	return (
		<div
			className={`group relative rounded-md border border-border bg-card transition-colors duration-150 ${onSelect ? "cursor-pointer hover:bg-accent/20" : ""}`}
			onClick={() => onSelect?.(task.id)}
		>
			<div className={compact ? "px-3 py-2.5" : "px-4 py-3"}>
				<div className="flex items-start gap-3">
					{/* State dot */}
					<span
						className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${STATE_DOT[task.state] ?? "bg-slate-400"} ${isDone ? "opacity-40" : ""}`}
						title={stateConfig.label}
					/>

					<div className="min-w-0 flex-1">
						{/* Title row */}
						<div className="flex items-start justify-between gap-2">
							<h3
								className={`text-sm font-medium leading-snug text-foreground ${isDone ? "text-muted-foreground line-through" : ""} ${compact ? "" : ""}`}
							>
								{task.title}
							</h3>

							<div className="flex shrink-0 items-center gap-1.5">
								<Badge
									variant={stateConfig.badge}
									className="hidden sm:inline-flex"
								>
									{stateConfig.label}
								</Badge>
								{hasMenu && (
									<DropdownMenu>
										<DropdownMenuTrigger
											onClick={(e) => e.stopPropagation()}
											className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground opacity-0 group-hover:opacity-100"
										>
											<MoreHorizontal className="h-3.5 w-3.5" />
										</DropdownMenuTrigger>
										<DropdownMenuContent
											align="end"
											onClick={(e) => e.stopPropagation()}
										>
											{onStateChange &&
												validTransitions.map((state) => {
													const config = TASK_STATE_CONFIG[state];
													return (
														<DropdownMenuItem
															key={state}
															onClick={() => onStateChange(task.id, state)}
														>
															<config.icon
																className={`mr-2 h-4 w-4 ${config.color.split(" ")[0]}`}
															/>
															Move to {config.label}
														</DropdownMenuItem>
													);
												})}
											{onConvertToIdea && (
												<DropdownMenuItem onClick={() => onConvertToIdea(task)}>
													<Repeat className="mr-2 h-4 w-4" />
													Convert to idea
												</DropdownMenuItem>
											)}
											{onAIClassify && (
												<DropdownMenuItem onClick={() => onAIClassify(task.id)}>
													<Sparkles className="mr-2 h-4 w-4" />
													AI classify
												</DropdownMenuItem>
											)}
											{(validTransitions.length > 0 ||
												onConvertToIdea ||
												onAIClassify) &&
												(onEdit || onDelete) && <DropdownMenuSeparator />}
											{onEdit && (
												<DropdownMenuItem onClick={() => onEdit(task)}>
													<Pencil className="mr-2 h-4 w-4" />
													Edit
												</DropdownMenuItem>
											)}
											{onDelete && task.state !== "Active" && (
												<DropdownMenuItem
													onClick={() => onDelete(task.id)}
													className="text-destructive"
												>
													<Trash2 className="mr-2 h-4 w-4" />
													Delete
												</DropdownMenuItem>
											)}
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</div>
						</div>

						{/* Description */}
						{!compact && task.description && (
							<p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
								{task.description}
							</p>
						)}

						{/* Meta row */}
						<div className="mt-1.5 flex flex-wrap items-center gap-1">
							{showProject && task.project && (
								<span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
									<FolderKanban className="h-3 w-3" />
									{task.project.name}
								</span>
							)}

							{task.size && (
								<Badge
									variant={TASK_SIZE_CONFIG[task.size].badge}
									className="px-1.5 py-0 text-[11px]"
								>
									{TASK_SIZE_CONFIG[task.size].shortLabel}
								</Badge>
							)}

							{task.urgency && (
								<Badge
									variant={TASK_URGENCY_CONFIG[task.urgency].badge}
									className="px-1.5 py-0 text-[11px]"
								>
									{TASK_URGENCY_CONFIG[task.urgency].label}
								</Badge>
							)}

							{task.protected && (
								<Badge variant="danger" className="px-1.5 py-0 text-[11px]">
									Protected
								</Badge>
							)}
							{featureGate.blocked && (
								<Badge variant="warning" className="px-1.5 py-0 text-[11px]">
									Blocked
								</Badge>
							)}

							{showParts &&
								(
									task.parts
										?.map((e) => e.part)
										.filter((p): p is NonNullable<typeof p> => Boolean(p)) ??
									(task.part ? [task.part] : [])
								).map((part) => (
									<Badge
										key={part.id}
										variant="sky"
										className="px-1.5 py-0 text-[11px]"
									>
										{part.name}
									</Badge>
								))}

							{(task.epics || [])
								.map((e) => e.epic)
								.filter((ep): ep is NonNullable<typeof ep> => Boolean(ep))
								.map((epic) => (
									<Badge
										key={epic.id}
										variant="purple"
										className="px-1.5 py-0 text-[11px]"
									>
										{epic.key ? `${epic.key} ` : ""}
										{epic.name}
									</Badge>
								))}

							{task.tags.slice(0, 2).map((tag) => (
								<Badge
									key={tag}
									variant="neutral"
									className="px-1.5 py-0 text-[11px]"
								>
									{tag}
								</Badge>
							))}

							{task.deadline && (
								<span
									className={`ml-auto inline-flex items-center gap-1 text-[11px] ${isOverdue(task.deadline) ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}`}
								>
									<Calendar className="h-3 w-3" />
									{formatDate(task.deadline)}
								</span>
							)}
						</div>
					</div>
				</div>

				{/* Feature gate block */}
				{featureGate.blocked && !compact && (
					<div className="mt-2 ml-5 rounded-md border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-800 dark:text-amber-400">
						<p className="font-medium">Blocked by feature dependency</p>
						{featureGate.reason && (
							<p className="mt-0.5 line-clamp-2 opacity-80">
								{featureGate.reason}
							</p>
						)}
						{featureGate.blockingTaskId && (
							<Link
								to="/tasks/$taskId"
								params={{ taskId: featureGate.blockingTaskId }}
								className="mt-1 inline-flex items-center gap-1 font-medium underline underline-offset-2"
								onClick={(e) => e.stopPropagation()}
							>
								<Link2 className="h-3 w-3" />
								View blocking task
							</Link>
						)}
					</div>
				)}

				{/* AI suggestion panel */}
				<TaskAISuggestionPanel task={task} />
			</div>
		</div>
	);
}
