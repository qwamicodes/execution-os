import { Badge } from "@repo/ui/components/ui/badge";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
	Activity,
	Archive,
	CheckCircle2,
	Clock3,
	ListChecks,
	MoreHorizontal,
	Pencil,
	Trash2,
	Undo2,
} from "lucide-react";
import { formatRelativeTime, PROJECT_TYPE_CONFIG } from "@/lib/constants";
import type { Project } from "@/lib/types";

interface ProjectCardProps {
	project: Project;
	onSelect: (id: string) => void;
	onEdit?: (project: Project) => void;
	onArchive?: (id: string, archived: boolean) => void;
	onDelete?: (id: string) => void;
	density?: "compact" | "expanded";
	index?: number;
}

interface ProjectHealth {
	label: "On Track" | "Watch" | "At Risk" | "Setup" | "Archived";
	className: string;
	reason: string;
}

function getProjectHealth(params: {
	isArchived: boolean;
	totalTasks: number;
	activeTasks: number;
	completedTasks: number;
	updatedAt: string;
}): ProjectHealth {
	if (params.isArchived) {
		return {
			label: "Archived",
			className: "border-amber-200 bg-amber-50 text-amber-700",
			reason: "Project is archived and excluded from active execution.",
		};
	}

	if (params.totalTasks === 0) {
		return {
			label: "Setup",
			className: "border-slate-200 bg-slate-50 text-slate-700",
			reason: "No tasks yet. Add initial tasks to start execution tracking.",
		};
	}

	const completionRate = (params.completedTasks / params.totalTasks) * 100;
	const staleDays = Math.floor(
		(Date.now() - new Date(params.updatedAt).getTime()) / 86_400_000,
	);
	const activePressure = params.activeTasks / Math.max(params.totalTasks, 1);

	if (staleDays >= 14 && completionRate < 35) {
		return {
			label: "At Risk",
			className: "border-red-200 bg-red-50 text-red-700",
			reason: "Progress is stale and completion is low for this project.",
		};
	}

	if (staleDays >= 7 || completionRate < 20 || activePressure > 0.75) {
		return {
			label: "Watch",
			className: "border-amber-200 bg-amber-50 text-amber-700",
			reason: "Monitor scope and throughput. Project may need prioritization.",
		};
	}

	return {
		label: "On Track",
		className: "border-emerald-200 bg-emerald-50 text-emerald-700",
		reason: "Healthy execution velocity and recent activity.",
	};
}

export function ProjectCard({
	project,
	onSelect,
	onEdit,
	onArchive,
	onDelete,
	density = "expanded",
	index = 0,
}: ProjectCardProps) {
	const typeConfig = PROJECT_TYPE_CONFIG[project.type];
	const isArchived = Boolean(project.archivedAt);
	const totalTasks = project.taskCount ?? 0;
	const activeTasks = project.activeTasks ?? 0;
	const completedTasks = project.completedTasks ?? 0;
	const completionRate =
		totalTasks > 0 ? Math.min(100, Math.round((completedTasks / totalTasks) * 100)) : 0;
	const updatedLabel = formatRelativeTime(project.updatedAt);
	const health = getProjectHealth({
		isArchived,
		totalTasks,
		activeTasks,
		completedTasks,
		updatedAt: project.updatedAt,
	});
	const cardDelay = Math.min(index * 55, 330);
	const isCompact = density === "compact";

	return (
		<Card
			className={`group relative cursor-pointer overflow-hidden border-slate-200 bg-white shadow-sm transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl focus-within:ring-2 focus-within:ring-sky-300/70 ${isArchived ? "opacity-70" : ""}`}
			onClick={() => onSelect(project.id)}
			style={{
				animationName: "project-card-enter",
				animationDuration: "440ms",
				animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
				animationFillMode: "both",
				animationDelay: `${cardDelay}ms`,
			}}
		>
			<div
				className="absolute inset-x-0 top-0 h-1"
				style={{
					background: project.color
						? `linear-gradient(90deg, ${project.color}, rgba(15, 23, 42, 0.4))`
						: "linear-gradient(90deg, rgba(56,189,248,0.9), rgba(15,23,42,0.55))",
				}}
			/>
			<CardContent className={`space-y-3.5 ${isCompact ? "p-3.5 pt-4.5" : "p-4 pt-5"}`}>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1 space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<Badge
								variant="secondary"
								className="border border-slate-200 bg-slate-50 text-[11px] text-slate-700"
							>
								{typeConfig.emoji} {typeConfig.label}
							</Badge>
							<Badge variant="outline" className={`text-[11px] ${health.className}`}>
								<Activity className="mr-1 h-3 w-3" />
								{health.label}
							</Badge>
						</div>
						<div className="space-y-1">
							<h3
								className={`truncate font-semibold text-slate-900 ${isCompact ? "text-sm" : "text-base"}`}
							>
								{project.name}
							</h3>
							<div className="flex items-center gap-1.5 text-xs text-slate-500">
								<Clock3 className="h-3 w-3" />
								Updated {updatedLabel}
							</div>
						</div>
					</div>

					{onEdit || onArchive || onDelete ? (
						<DropdownMenu>
							<DropdownMenuTrigger
								type="button"
								onClick={(event) => event.stopPropagation()}
								className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
							>
								<MoreHorizontal className="h-4 w-4" />
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								onClick={(event) => event.stopPropagation()}
							>
								{onEdit ? (
									<DropdownMenuItem onClick={() => onEdit(project)}>
										<Pencil className="mr-2 h-4 w-4" />
										Edit
									</DropdownMenuItem>
								) : null}
								{onArchive ? (
									<DropdownMenuItem
										onClick={() => onArchive(project.id, !isArchived)}
									>
										{isArchived ? (
											<>
												<Undo2 className="mr-2 h-4 w-4" />
												Unarchive
											</>
										) : (
											<>
												<Archive className="mr-2 h-4 w-4" />
												Archive
											</>
										)}
									</DropdownMenuItem>
								) : null}
								{onDelete ? (
									<DropdownMenuItem
										onClick={() => onDelete(project.id)}
										className="text-destructive"
									>
										<Trash2 className="mr-2 h-4 w-4" />
										Delete
									</DropdownMenuItem>
								) : null}
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</div>

				{!isCompact ? (
					project.description ? (
						<p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
							{project.description}
						</p>
					) : (
						<p className="text-sm italic text-slate-400">No description yet</p>
					)
				) : null}

				<div className={`grid grid-cols-3 gap-2 ${isCompact ? "text-[11px]" : ""}`}>
					<StatChip
						icon={ListChecks}
						label="Tasks"
						value={totalTasks}
						className="bg-slate-50 text-slate-700"
					/>
					<StatChip
						icon={Clock3}
						label="Active"
						value={activeTasks}
						className="bg-sky-50 text-sky-700"
					/>
					<StatChip
						icon={CheckCircle2}
						label="Done"
						value={completedTasks}
						className="bg-emerald-50 text-emerald-700"
					/>
				</div>

				<div className="space-y-1.5">
					<div className="flex items-center justify-between text-xs text-slate-600">
						<span>Completion</span>
						<span>{completionRate}%</span>
					</div>
					<div className="h-2 rounded-full bg-slate-100">
						<div
							className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
							style={{ width: `${completionRate}%` }}
						/>
					</div>
					{!isCompact ? (
						<p className="text-[11px] text-slate-500">{health.reason}</p>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}

function StatChip({
	icon: Icon,
	label,
	value,
	className,
}: {
	icon: typeof Clock3;
	label: string;
	value: number;
	className: string;
}) {
	return (
		<div className={`rounded-lg border border-slate-200 px-2.5 py-2 ${className}`}>
			<div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide opacity-80">
				<Icon className="h-3 w-3" />
				{label}
			</div>
			<p className="mt-1 text-base font-semibold leading-none">{value}</p>
		</div>
	);
}
