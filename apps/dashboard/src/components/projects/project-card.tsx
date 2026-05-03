import { Badge } from "@repo/ui/components/ui/badge";
import type { BadgeVariant } from "@repo/ui/components/ui/badge";
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
	variant: BadgeVariant;
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
			variant: "caution",
			reason: "Project is archived and excluded from active execution.",
		};
	}

	if (params.totalTasks === 0) {
		return {
			label: "Setup",
			variant: "neutral",
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
			variant: "danger",
			reason: "Progress is stale and completion is low for this project.",
		};
	}

	if (staleDays >= 7 || completionRate < 20 || activePressure > 0.75) {
		return {
			label: "Watch",
			variant: "warning",
			reason: "Monitor scope and throughput. Project may need prioritization.",
		};
	}

	return {
		label: "On Track",
		variant: "success",
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
		totalTasks > 0
			? Math.min(100, Math.round((completedTasks / totalTasks) * 100))
			: 0;
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
			className={`group relative cursor-pointer overflow-hidden border-border bg-card shadow-none transition-[border-color,background-color] duration-200 hover:bg-accent/10 focus-within:ring-2 focus-within:ring-primary/30 ${isArchived ? "opacity-60" : ""}`}
			onClick={() => onSelect(project.id)}
			style={{
				animationName: "project-card-enter",
				animationDuration: "440ms",
				animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
				animationFillMode: "both",
				animationDelay: `${cardDelay}ms`,
			}}
		>
			{/* Top accent bar */}
			<div
				className="absolute inset-x-0 top-0 h-[3px]"
				style={{
					background: project.color
						? `linear-gradient(90deg, ${project.color}, transparent)`
						: "linear-gradient(90deg, hsl(234 56% 59% / 0.6), transparent)",
				}}
			/>
			<CardContent className={`space-y-3 ${isCompact ? "p-3.5 pt-4" : "p-4 pt-5"}`}>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1 space-y-1.5">
						<div className="flex flex-wrap items-center gap-1.5">
							<Badge variant={typeConfig.badge} className="text-[11px]">
								{typeConfig.label}
							</Badge>
							<Badge variant={health.variant} className="text-[11px]">
								<Activity className="mr-1 h-3 w-3" />
								{health.label}
							</Badge>
						</div>
						<div className="space-y-0.5">
							<h3 className={`truncate font-semibold text-foreground ${isCompact ? "text-sm" : "text-base"}`}>
								{project.name}
							</h3>
							<div className="flex items-center gap-1 text-[11px] text-muted-foreground">
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
								className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-[opacity,background-color] hover:bg-accent hover:text-foreground group-hover:opacity-100"
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
						<p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
							{project.description}
						</p>
					) : (
						<p className="text-sm italic text-muted-foreground/50">No description yet</p>
					)
				) : null}

				{/* Stats row */}
				<div className="grid grid-cols-3 gap-1.5">
					<StatChip icon={ListChecks} label="Tasks" value={totalTasks} />
					<StatChip icon={Clock3} label="Active" value={activeTasks} accent="primary" />
					<StatChip icon={CheckCircle2} label="Done" value={completedTasks} accent="success" />
				</div>

				{/* Progress */}
				<div className="space-y-1">
					<div className="flex items-center justify-between text-[11px] text-muted-foreground">
						<span>Completion</span>
						<span className="tabular-nums">{completionRate}%</span>
					</div>
					<div className="h-1.5 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-all duration-500"
							style={{ width: `${completionRate}%` }}
						/>
					</div>
					{!isCompact ? (
						<p className="text-[11px] text-muted-foreground/70">{health.reason}</p>
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
	accent,
}: {
	icon: typeof Clock3;
	label: string;
	value: number;
	accent?: "primary" | "success";
}) {
	const textColor =
		accent === "primary"
			? "text-primary"
			: accent === "success"
				? "text-emerald-500 dark:text-emerald-400"
				: "text-muted-foreground";

	return (
		<div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
			<div className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide opacity-70`}>
				<Icon className={`h-3 w-3 ${textColor}`} />
				<span className="text-muted-foreground">{label}</span>
			</div>
			<p className={`mt-0.5 text-sm font-semibold tabular-nums leading-none ${textColor}`}>
				{value}
			</p>
		</div>
	);
}
