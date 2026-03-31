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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Input } from "@repo/ui/components/ui/input";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	Archive,
	Calendar,
	CheckCircle2,
	ChevronRight,
	FolderOpen,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
	Undo2,
} from "lucide-react";
import { useState } from "react";
import { goeyToast as toast } from "goey-toast";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import { Pagination } from "@/components/shared/pagination";
import {
	RouteHeroBadge,
	RouteHeroHeader,
} from "@/components/shared/route-hero-header";
import { SkeletonList } from "@/components/shared/skeleton-list";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { TaskCard } from "@/components/tasks/task-card";
import {
	useDeleteProject,
	useDeleteProjectMilestone,
	useCreateProjectMilestone,
	useProject,
	useProjectMilestones,
	useUpdateProjectMilestone,
	useUpdateProject,
} from "@/hooks/use-projects";
import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { formatDate, isOverdue, PROJECT_TYPE_CONFIG } from "@/lib/constants";
import type { TaskState } from "@/lib/types";

export interface ProjectDetailSearch {
	state?: string;
	page?: number;
}

export const Route = createFileRoute("/projects/$projectId")({
	validateSearch: (search: Record<string, unknown>): ProjectDetailSearch => ({
		state: search.state as string | undefined,
		page: Number(search.page) || 1,
	}),
	component: ProjectDetailPage,
});

function ProjectDetailPage() {
	const { projectId } = Route.useParams();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/projects/$projectId" });
	const [editOpen, setEditOpen] = useState(false);
	const [createTaskOpen, setCreateTaskOpen] = useState(false);
	const [milestoneTitle, setMilestoneTitle] = useState("");
	const [milestoneDate, setMilestoneDate] = useState("");

	const { data: project, isLoading: projectLoading } = useProject(projectId);
	const updateProject = useUpdateProject();
	const deleteProject = useDeleteProject();
	const { data: milestones = [] } = useProjectMilestones(projectId);
	const createMilestone = useCreateProjectMilestone(projectId);
	const updateMilestone = useUpdateProjectMilestone(projectId);
	const deleteMilestone = useDeleteProjectMilestone(projectId);
	const updateTask = useUpdateTask();

	const { data: taskData, isLoading: tasksLoading } = useTasks({
		projectId,
		state: search.state as TaskState | undefined,
		page: search.page,
		limit: 20,
	});

	const tasks = taskData?.tasks || [];
	const totalTasks = taskData?.total || 0;
	const totalPages = Math.ceil(totalTasks / 20);

	if (projectLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Spinner size="lg" />
			</div>
		);
	}

	if (!project) {
		return (
			<div className="flex h-64 items-center justify-center">
				<p className="text-muted-foreground">Project not found</p>
			</div>
		);
	}

	const isArchived = !!project.archivedAt;
	const typeConfig = PROJECT_TYPE_CONFIG[project.type];

	function handleArchiveToggle() {
		if (!project) return;
		updateProject.mutate(
			{ id: project.id, data: { archived: !isArchived } },
			{
				onSuccess: () => {
					toast.success(isArchived ? "Project unarchived" : "Project archived");
				},
				onError: (error) => {
					toast.error(error.message);
				},
			},
		);
	}

	function handleDelete() {
		if (!project) return;
		deleteProject.mutate(project.id, {
			onSuccess: () => {
				toast.success("Project deleted");
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});
	}

	function handleTaskStateChange(taskId: string, newState: TaskState) {
		updateTask.mutate({ id: taskId, data: { state: newState } });
	}

	function handleTaskSelect(taskId: string) {
		navigate({ to: "/tasks/$taskId", params: { taskId } });
	}

	function updateSearch(updates: Partial<ProjectDetailSearch>) {
		navigate({
			search: (prev: ProjectDetailSearch) => ({
				...prev,
				...updates,
				page: updates.page ?? 1,
			}),
		});
	}

	function handleCreateMilestone() {
		if (!milestoneTitle.trim()) return;
		createMilestone.mutate(
			{
				title: milestoneTitle.trim(),
				targetDate: milestoneDate
					? new Date(`${milestoneDate}T23:59:59.000Z`).toISOString()
					: null,
			},
			{
				onSuccess: () => {
					setMilestoneTitle("");
					setMilestoneDate("");
					toast.success("Milestone created");
				},
				onError: (error) => toast.error(error.message),
			},
		);
	}

	function handleCompleteMilestone(milestoneId: string) {
		updateMilestone.mutate(
			{
				milestoneId,
				data: {
					status: "Completed",
					completedAt: new Date().toISOString(),
				},
			},
			{
				onSuccess: () => toast.success("Milestone marked complete"),
				onError: (error) => toast.error(error.message),
			},
		);
	}

	function handleDeleteMilestone(milestoneId: string) {
		deleteMilestone.mutate(milestoneId, {
			onSuccess: () => toast.success("Milestone deleted"),
			onError: (error) => toast.error(error.message),
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

	return (
		<div className="space-y-6">
			<nav className="flex items-center gap-1 text-sm text-slate-500">
				<Link to="/projects" className="hover:text-foreground">
					Projects
				</Link>
				<ChevronRight className="h-3 w-3" />
				<span className="max-w-xs truncate text-slate-900">{project.name}</span>
			</nav>

			<RouteHeroHeader
				eyebrow="Execution Flow"
				title={project.name}
				description={project.description || "Project execution overview."}
				help={{
					feature: "Project Detail",
					what: "Focused view of one project's task pipeline and delivery status.",
					use: "Use filters to review state-specific tasks and create new work inside this scope.",
					works:
						"Queries project metadata and task list together so updates stay contextual.",
				}}
				badges={
					<>
						<RouteHeroBadge className="border-0 bg-slate-900 text-white">
							{project.taskCount ?? 0} tasks
						</RouteHeroBadge>
						<RouteHeroBadge className="rounded-full bg-sky-100 text-sky-700">
							{typeConfig.emoji} {typeConfig.label}
						</RouteHeroBadge>
						{isArchived && (
							<RouteHeroBadge variant="outline">Archived</RouteHeroBadge>
						)}
					</>
				}
				action={
					<div className="flex shrink-0 items-center gap-2">
						<div className="flex items-center gap-1.5">
							<Button
								onClick={() => setCreateTaskOpen(true)}
								className="h-10 gap-2 bg-slate-950 px-4 text-white hover:bg-slate-800"
							>
								<Plus className="h-4 w-4" />
								Add task
							</Button>
							<HelpTooltip
								feature="Add Task to Project"
								what="Creates a task already linked to this project."
								use="Use this when new work belongs directly to the current project scope."
								works="Pre-fills project context on task creation to keep reporting accurate."
							/>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => setEditOpen(true)}>
									<Pencil className="mr-2 h-4 w-4" />
									Edit
								</DropdownMenuItem>
								<DropdownMenuItem onClick={handleArchiveToggle}>
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
								<DropdownMenuItem
									onClick={handleDelete}
									className="text-destructive"
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				}
			/>

			<div className="grid gap-3 sm:grid-cols-3">
				<StatCard label="Total Tasks" value={project.taskCount ?? 0} />
				<StatCard label="Active" value={project.activeTasks ?? 0} />
				<StatCard label="Completed" value={project.completedTasks ?? 0} />
			</div>

			<Card className="border-slate-200 bg-white/90">
				<CardHeader className="flex-row items-center justify-between space-y-0">
					<CardTitle className="inline-flex items-center gap-2 text-base">
						<Calendar className="h-4 w-4" />
						Milestones
					</CardTitle>
					<Badge variant="secondary">{milestones.length}</Badge>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
						<Input
							value={milestoneTitle}
							onChange={(event) => setMilestoneTitle(event.target.value)}
							placeholder="Milestone title"
						/>
						<Input
							type="date"
							value={milestoneDate}
							onChange={(event) => setMilestoneDate(event.target.value)}
						/>
						<Button onClick={handleCreateMilestone} disabled={!milestoneTitle.trim()}>
							Add milestone
						</Button>
					</div>
					{project.targetCompletionDate && (
						<div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
							Target completion:{" "}
							<span className="font-medium">
								{formatDate(project.targetCompletionDate)}
							</span>
						</div>
					)}
					{milestones.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No milestones yet. Add one to track project checkpoints.
						</p>
					) : (
						<div className="space-y-2">
							{milestones.map((milestone) => (
								<div
									key={milestone.id}
									className="flex items-center justify-between rounded-md border border-slate-200 p-3"
								>
									<div>
										<p className="text-sm font-medium">{milestone.title}</p>
										<p className="text-xs text-slate-500">
											{milestone.targetDate
												? `${formatDate(milestone.targetDate)}${isOverdue(milestone.targetDate) && milestone.status !== "Completed" ? " (overdue)" : ""}`
												: "No target date"}
										</p>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant="outline">{milestone.status}</Badge>
										{milestone.status !== "Completed" && (
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleCompleteMilestone(milestone.id)}
											>
												<CheckCircle2 className="mr-1 h-3.5 w-3.5" />
												Complete
											</Button>
										)}
										<Button
											variant="ghost"
											size="sm"
											className="text-destructive"
											onClick={() => handleDeleteMilestone(milestone.id)}
										>
											Delete
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<Card className="border-slate-200 bg-white/90">
				<CardHeader className="flex-row items-center justify-between space-y-0">
					<CardTitle className="inline-flex items-center gap-2 text-base">
						Tasks
						<HelpTooltip
							feature="Project Tasks"
							what="Task list scoped to this project."
							use="Filter by state to review backlog, active execution, and completed output."
							works="Fetches paginated tasks with optional state filters for this project id."
						/>
					</CardTitle>
					<Select
						value={search.state || "all"}
						onValueChange={(v) =>
							updateSearch({
								state: v === "all" ? undefined : v,
							})
						}
					>
						<SelectTrigger className="w-[140px] border-slate-300 bg-white">
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
				</CardHeader>
				<CardContent>
					{tasksLoading && <SkeletonList count={3} />}

					{!tasksLoading && tasks.length === 0 && (
						<EmptyState
							icon={FolderOpen}
							title="No tasks"
							description={
								search.state
									? "No tasks match this filter."
									: "Add a task to this project."
							}
						/>
					)}

					{!tasksLoading && tasks.length > 0 && (
						<div className="space-y-2">
							{tasks.map((task) => (
								<TaskCard
									key={task.id}
									task={task}
									onStateChange={handleTaskStateChange}
									onSelect={handleTaskSelect}
								/>
							))}
						</div>
					)}

					{totalPages > 1 && (
						<div className="mt-4">
							<Pagination
								currentPage={search.page || 1}
								totalPages={totalPages}
								onPageChange={(page) => updateSearch({ page })}
							/>
						</div>
					)}
				</CardContent>
			</Card>

			{editOpen && (
				<EditProjectDialog
					project={project}
					open={editOpen}
					onOpenChange={setEditOpen}
				/>
			)}

			<CreateTaskDialog
				open={createTaskOpen}
				onOpenChange={setCreateTaskOpen}
				defaultProjectId={projectId}
			/>
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: number }) {
	return (
		<Card className="border-slate-200 bg-white/85">
			<CardContent className="p-4">
				<p className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase">
					{label}
				</p>
				<p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
			</CardContent>
		</Card>
	);
}
