import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowDownAZ,
	ArrowUpAZ,
	CheckSquare,
	CircleCheckBig,
	CircleSlash,
	Clock3,
	Filter,
	type LucideIcon,
	Plus,
	Sparkles,
	X,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import { Pagination } from "@/components/shared/pagination";
import { SkeletonList } from "@/components/shared/skeleton-list";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { TaskCard } from "@/components/tasks/task-card";
import { useConvertTaskToIdea } from "@/hooks/use-ideas";
import { useProjects } from "@/hooks/use-projects";
import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { isTaskBlocked } from "@/lib/feature-gate";
import type { TaskFilters, TaskSize, TaskState } from "@/lib/types";
import { goeyToast as toast } from "goey-toast";

export interface TasksSearch {
	state?: string;
	projectId?: string;
	size?: string;
	tag?: string;
	searchQuery?: string;
	sortBy?: string;
	sortOrder?: string;
	page?: number;
}

export const Route = createFileRoute("/tasks/")({
	validateSearch: (search: Record<string, unknown>): TasksSearch => ({
		state: search.state as string | undefined,
		projectId: search.projectId as string | undefined,
		size: search.size as string | undefined,
		tag: search.tag as string | undefined,
		searchQuery: search.searchQuery as string | undefined,
		sortBy: (search.sortBy as string) || "createdAt",
		sortOrder: (search.sortOrder as string) || "desc",
		page: Number(search.page) || 1,
	}),
	component: TasksPage,
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

function MetricCard({
	label,
	value,
	icon: Icon,
	tone = "neutral",
}: {
	label: string;
	value: number;
	icon: LucideIcon;
	tone?: "neutral" | "ready" | "blocked" | "done";
}) {
	const toneClass =
		tone === "ready"
			? "text-info border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-950/30 dark:text-blue-400"
			: tone === "blocked"
				? "text-warning border-amber-200 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-400"
				: tone === "done"
					? "text-success border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-400"
					: "text-muted-foreground bg-muted/40 border-border";

	return (
		<Card className="border-border bg-card shadow-none transition-transform duration-300 hover:-translate-y-0.5">
			<CardContent className="flex items-center justify-between p-4">
				<div>
					<p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
						{label}
					</p>
					<p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
				</div>
				<div className={`rounded-xl border p-2.5 ${toneClass}`}>
					<Icon className="h-4 w-4" />
				</div>
			</CardContent>
		</Card>
	);
}

function TasksPage() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/tasks/" });
	const [createOpen, setCreateOpen] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);
	const updateTask = useUpdateTask();
	const convertTaskToIdea = useConvertTaskToIdea();
	const { data: projectList } = useProjects();

	const filters: TaskFilters = {
		state: search.state as TaskState | undefined,
		projectId: search.projectId,
		size: search.size as TaskSize | undefined,
		tag: search.tag,
		searchQuery: search.searchQuery,
		sortBy: search.sortBy as TaskFilters["sortBy"],
		sortOrder: search.sortOrder as TaskFilters["sortOrder"],
		page: search.page,
		limit: 20,
	};

	const { data, isLoading } = useTasks(filters);
	const tasks = data?.tasks || [];
	const total = data?.total || 0;
	const totalPages = Math.ceil(total / 20);
	const readyCount = tasks.filter((task) => task.state === "Ready").length;
	const blockedCount = tasks.filter((task) => isTaskBlocked(task)).length;
	const doneCount = tasks.filter((task) => task.state === "Done").length;

	const hasActiveFilters = Boolean(
		search.state ||
			search.projectId ||
			search.size ||
			search.tag ||
			search.searchQuery,
	);

	useEffect(() => {
		const frame = requestAnimationFrame(() => setIsLoaded(true));
		return () => cancelAnimationFrame(frame);
	}, []);

	function updateSearch(updates: Partial<TasksSearch>) {
		navigate({
			search: (prev: TasksSearch) => ({
				...prev,
				...updates,
				page: updates.page ?? 1,
			}),
		});
	}

	function clearFilters() {
		navigate({
			search: {
				sortBy: "createdAt",
				sortOrder: "desc",
				page: 1,
			},
		});
	}

	function handleStateChange(taskId: string, newState: TaskState) {
		updateTask.mutate({ id: taskId, data: { state: newState } });
	}

	function handleSelect(taskId: string) {
		navigate({ to: "/tasks/$taskId", params: { taskId } });
	}

	function handleConvertToIdea(task: (typeof tasks)[number]) {
		convertTaskToIdea.mutate(task.id, {
			onSuccess: (result) => {
				toast.success("Task converted to idea", {
					description: result.migration.suggestion,
				});
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});
	}

	const states: TaskState[] = [
		"Inbox",
		"Ongoing",
		"Ready",
		"Active",
		"Blocked",
		"Paused",
		"Done",
	];
	const sizes: TaskSize[] = ["Small", "Medium", "Large", "Huge"];

	return (
		<div className="space-y-6">
			<StaggerReveal visible={isLoaded} delayMs={20}>
				<Card className="overflow-hidden border-border bg-card shadow-none">
					<CardContent className="flex flex-wrap items-start justify-between gap-4 p-6 sm:p-7">
						<div>
							<p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
								Execution Flow
							</p>
							<h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
								<span className="inline-flex items-center gap-2">
									Tasks
									<HelpTooltip
										feature="Tasks"
										what="Primary queue for execution work across all projects."
										use="Filter, sort, and move tasks between states as work progresses."
										works="Combines task metadata, state transitions, and pagination in one surface."
									/>
								</span>
							</h1>
							<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
								Manage execution across projects with a single queue and fast
								state transitions.
							</p>
							<div className="mt-4 flex flex-wrap items-center gap-2">
								<Badge variant="default">{total} total</Badge>
								{hasActiveFilters ? (
									<Badge
										variant="secondary"
										className="rounded-full bg-sky-100 text-sky-700"
									>
										<Sparkles className="mr-1 h-3 w-3" />
										Filtered view
									</Badge>
								) : (
									<Badge
										variant="secondary"
										className="rounded-full bg-muted/60 text-muted-foreground"
									>
										All tasks
									</Badge>
								)}
							</div>
						</div>
						<div className="flex items-center gap-1.5">
							<Button
								onClick={() => setCreateOpen(true)}
								className="h-10 gap-2 bg-primary px-4 text-primary-foreground hover:bg-primary/90"
							>
								<Plus className="h-4 w-4" />
								Add task
							</Button>
							<HelpTooltip
								feature="Add Task"
								what="Creates a new task in your execution system."
								use="Click to capture new work and assign project/state metadata."
								works="Opens task creation modal and persists task into queue."
							/>
						</div>
					</CardContent>
				</Card>
			</StaggerReveal>

			<StaggerReveal visible={isLoaded} delayMs={110}>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<MetricCard
						label="In View"
						value={tasks.length}
						icon={CheckSquare}
						tone="neutral"
					/>
					<MetricCard
						label="Ready"
						value={readyCount}
						icon={Clock3}
						tone="ready"
					/>
					<MetricCard
						label="Blocked"
						value={blockedCount}
						icon={CircleSlash}
						tone="blocked"
					/>
					<MetricCard
						label="Done"
						value={doneCount}
						icon={CircleCheckBig}
						tone="done"
					/>
				</div>
			</StaggerReveal>

			<StaggerReveal visible={isLoaded} delayMs={180}>
				<Card className="border-white/80 bg-card shadow-sm">
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center justify-between text-base font-semibold text-foreground">
							<span className="inline-flex items-center gap-2">
								<Filter className="h-4 w-4 text-muted-foreground" />
								Filters
								<HelpTooltip
									feature="Task Filters"
									what="Controls list scope and ordering."
									use="Set state, project, size, and sorting to focus the queue."
									works="Updates URL search params and refetches task list."
								/>
							</span>
							{hasActiveFilters && (
								<Button
									variant="ghost"
									size="sm"
									onClick={clearFilters}
									className="h-8 text-muted-foreground hover:text-foreground"
								>
									<X className="mr-1 h-3.5 w-3.5" />
									Clear
								</Button>
							)}
						</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[200px_140px_170px_130px_170px_44px]">
						<Input
							placeholder="Search tasks..."
							value={search.searchQuery || ""}
							onChange={(event) =>
								updateSearch({
									searchQuery: event.target.value || undefined,
								})
							}
							className="w-full bg-card"
						/>
						<Select
							value={search.state || "all"}
							onValueChange={(v) =>
								updateSearch({
									state: v === "all" ? undefined : v,
								})
							}
						>
							<SelectTrigger className="w-full bg-card">
								<SelectValue placeholder="All states" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All states</SelectItem>
								{states.map((state) => (
									<SelectItem key={state} value={state}>
										{state}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							value={search.projectId || "all"}
							onValueChange={(v) =>
								updateSearch({
									projectId: v === "all" ? undefined : v,
								})
							}
						>
							<SelectTrigger className="w-full bg-card">
								<SelectValue placeholder="All projects" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All projects</SelectItem>
								{Array.isArray(projectList) &&
									projectList.map((project) => (
										<SelectItem key={project.id} value={project.id}>
											{project.name}
										</SelectItem>
									))}
							</SelectContent>
						</Select>

						<Select
							value={search.size || "all"}
							onValueChange={(v) =>
								updateSearch({
									size: v === "all" ? undefined : v,
								})
							}
						>
							<SelectTrigger className="w-full bg-card">
								<SelectValue placeholder="All sizes" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All sizes</SelectItem>
								{sizes.map((size) => (
									<SelectItem key={size} value={size}>
										{size}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							value={search.sortBy || "createdAt"}
							onValueChange={(v) => updateSearch({ sortBy: v })}
						>
							<SelectTrigger className="w-full bg-card">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="createdAt">Created</SelectItem>
								<SelectItem value="updatedAt">Updated</SelectItem>
								<SelectItem value="deadline">Deadline</SelectItem>
								<SelectItem value="priority">Priority</SelectItem>
								<SelectItem value="title">Title</SelectItem>
							</SelectContent>
						</Select>

						<Button
							variant="outline"
							size="icon"
							onClick={() =>
								updateSearch({
									sortOrder: search.sortOrder === "asc" ? "desc" : "asc",
								})
							}
							className="w-full bg-card"
						>
							{search.sortOrder === "asc" ? (
								<ArrowUpAZ className="h-4 w-4" />
							) : (
								<ArrowDownAZ className="h-4 w-4" />
							)}
						</Button>
					</CardContent>
				</Card>
			</StaggerReveal>

			<StaggerReveal visible={isLoaded} delayMs={250}>
				<Card className="border-border bg-card shadow-sm">
					<CardContent className="p-4 sm:p-5">
						{isLoading && <SkeletonList count={5} />}

						{!isLoading && tasks.length === 0 && (
							<EmptyState
								icon={CheckSquare}
								title="No tasks found"
								description={
									hasActiveFilters
										? "Try adjusting your filters."
										: "Create your first task to get started."
								}
							>
								{!hasActiveFilters && (
									<Button variant="outline" onClick={() => setCreateOpen(true)}>
										<Plus className="mr-1 h-4 w-4" />
										Create a task
									</Button>
								)}
							</EmptyState>
						)}

						{!isLoading && tasks.length > 0 && (
							<div className="space-y-2">
								{tasks.map((task) => (
									<TaskCard
										key={task.id}
										task={task}
										showProject
										onStateChange={handleStateChange}
										onSelect={handleSelect}
										onConvertToIdea={handleConvertToIdea}
									/>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</StaggerReveal>

			<StaggerReveal visible={isLoaded} delayMs={300}>
				<Pagination
					currentPage={search.page || 1}
					totalPages={totalPages}
					onPageChange={(page) => updateSearch({ page })}
				/>
			</StaggerReveal>

			<CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
		</div>
	);
}
