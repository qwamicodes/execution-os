import { Badge } from "@repo/ui/components/ui/badge";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Link } from "@tanstack/react-router";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
	Calendar,
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
	return (
		<Card
			className={`group border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900 shadow-sm transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-800 hover:shadow-md dark:hover:shadow-slate-900 hover:shadow-slate-200/70 ${onSelect ? "cursor-pointer" : ""}`}
			onClick={() => onSelect?.(task.id)}
		>
			<CardContent className={compact ? "p-3" : "p-4"}>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<h3
							className={`font-medium tracking-tight text-slate-900 ${compact ? "text-sm" : ""} ${task.state === "Done" ? "line-through text-slate-500" : ""}`}
						>
							{task.title}
						</h3>

						{!compact && task.description && (
							<p className="mt-1 line-clamp-2 text-sm text-slate-600">
								{task.description}
							</p>
						)}

						<div className="mt-2 flex flex-wrap items-center gap-1.5">
							<Badge
								variant="outline"
								className={`border-0 text-xs shadow-sm ${stateConfig.color}`}
							>
								<stateConfig.icon className="mr-1 h-3 w-3" />
								{stateConfig.label}
							</Badge>

							{task.size && (
								<Badge
									variant="outline"
									className="border-slate-200 bg-white text-xs text-slate-600"
								>
									{TASK_SIZE_CONFIG[task.size].shortLabel}
								</Badge>
							)}

							{task.urgency && (
								<Badge
									variant="outline"
									className={`border-0 text-xs shadow-sm ${TASK_URGENCY_CONFIG[task.urgency].color}`}
								>
									{TASK_URGENCY_CONFIG[task.urgency].label}
								</Badge>
							)}

							{task.protected && (
								<Badge
									variant="outline"
									className="border-red-200 bg-red-50 text-xs text-red-700"
								>
									Protected
								</Badge>
							)}
							{featureGate.blocked && (
								<Badge
									variant="outline"
									className="border-amber-200 bg-amber-50 text-xs text-amber-700"
								>
									Feature blocked
								</Badge>
							)}

							{showProject && task.project && (
								<Badge
									variant="secondary"
									className="bg-slate-100 text-xs text-slate-700"
								>
									{task.project.name}
								</Badge>
							)}
							{task.part && (
								<Badge
									variant="outline"
									className="border-sky-200 bg-sky-50 text-xs text-sky-700"
								>
									{task.part.name}
								</Badge>
							)}

							{task.deadline && (
								<span
									className={`inline-flex items-center text-xs ${isOverdue(task.deadline) ? "text-red-600" : "text-slate-500"}`}
								>
									<Calendar className="mr-1 h-3 w-3" />
									{formatDate(task.deadline)}
								</span>
							)}

							{task.tags.length > 0 &&
								task.tags.slice(0, 3).map((tag) => (
									<Badge
										key={tag}
										variant="outline"
										className="border-slate-200 bg-slate-50 text-xs text-slate-600"
									>
										{tag}
									</Badge>
								))}
						</div>

						{featureGate.blocked && !compact && (
							<div className="mt-2 rounded-md border border-amber-200/80 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-200 p-2 text-xs text-amber-800 dark:text-slate-800">
								<p className="font-medium">Blocked by feature dependency</p>
								{featureGate.reason && (
									<p className="mt-0.5 line-clamp-2">{featureGate.reason}</p>
								)}
								{featureGate.blockingTaskId && (
									<Link
										to="/tasks/$taskId"
										params={{ taskId: featureGate.blockingTaskId }}
										className="mt-1 inline-flex items-center gap-1 font-medium text-amber-900 underline underline-offset-2"
										onClick={(event) => event.stopPropagation()}
									>
										<Link2 className="h-3 w-3" />
										View blocking task
									</Link>
								)}
							</div>
						)}
					</div>

					{(onStateChange ||
						onEdit ||
						onDelete ||
						onConvertToIdea ||
						onAIClassify) && (
						<DropdownMenu>
							<DropdownMenuTrigger
								onClick={(e) => e.stopPropagation()}
								className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 group-hover:opacity-100 md:opacity-0"
							>
								<MoreHorizontal className="h-4 w-4" />
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

								{(onStateChange &&
									validTransitions.length > 0 &&
									(onEdit || onDelete)) ||
								(onConvertToIdea && (onEdit || onDelete)) ||
								(onAIClassify && (onEdit || onDelete)) ? (
									<DropdownMenuSeparator />
								) : null}

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
			</CardContent>
		</Card>
	);
}
