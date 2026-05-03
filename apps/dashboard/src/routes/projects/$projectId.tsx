import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { DatePicker } from "@repo/ui/components/ui/date-picker";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { goeyToast as toast } from "goey-toast";
import {
	Archive,
	ArrowDownAZ,
	ArrowUpAZ,
	Calendar,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	FolderOpen,
	GitBranchPlus,
	LayoutList,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
	Undo2,
	X,
} from "lucide-react";
import moment from "moment";
import { useState } from "react";
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
	useBatchApplyProjectTasks,
	useCreateProjectEpic,
	useCreateProjectMilestone,
	useCreateProjectPart,
	useDeleteProject,
	useDeleteProjectEpic,
	useDeleteProjectMilestone,
	useDeleteProjectPart,
	useProject,
	useProjectEpics,
	useProjectMilestones,
	useProjectParts,
	useUpdateProject,
	useUpdateProjectEpic,
	useUpdateProjectMilestone,
	useUpdateProjectPart,
} from "@/hooks/use-projects";
import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { formatDate, isOverdue, PROJECT_TYPE_CONFIG } from "@/lib/constants";
import type { TaskFilters, TaskSize, TaskState } from "@/lib/types";

export interface ProjectDetailSearch {
	state?: string;
	partId?: string;
	epicId?: string;
	milestoneId?: string;
	size?: string;
	searchQuery?: string;
	sortBy?: string;
	sortOrder?: string;
	page?: number;
}

export const Route = createFileRoute("/projects/$projectId")({
	validateSearch: (search: Record<string, unknown>): ProjectDetailSearch => ({
		state: search.state as string | undefined,
		partId: search.partId as string | undefined,
		epicId: search.epicId as string | undefined,
		milestoneId: search.milestoneId as string | undefined,
		size: search.size as string | undefined,
		searchQuery: search.searchQuery as string | undefined,
		sortBy: (search.sortBy as string) || "updatedAt",
		sortOrder: (search.sortOrder as string) || "desc",
		page: Number(search.page) || 1,
	}),
	component: ProjectDetailPage,
});

// ─── Section helper ────────────────────────────────────────────────────────
function Section({
	icon: Icon,
	title,
	count,
	collapsed,
	onToggle,
	action,
	children,
}: {
	icon: React.ElementType;
	title: React.ReactNode;
	count?: number;
	collapsed: boolean;
	onToggle: () => void;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="overflow-hidden rounded-lg border border-border bg-card">
			<button
				type="button"
				className="flex w-full cursor-pointer select-none items-center justify-between px-4 py-3 text-left"
				onClick={onToggle}
			>
				<div className="flex items-center gap-2 text-sm font-medium text-foreground">
					<Icon className="h-4 w-4 text-muted-foreground" />
					{title}
					{count !== undefined && (
						<span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
							{count}
						</span>
					)}
				</div>
				<ChevronDown
					className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
				/>
			</button>
			{!collapsed && (
				<div className="border-t border-border px-4 py-4">{children}</div>
			)}
		</div>
	);
}

function ProjectDetailPage() {
	const { projectId } = Route.useParams();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/projects/$projectId" });
	const [editOpen, setEditOpen] = useState(false);
	const [createTaskOpen, setCreateTaskOpen] = useState(false);
	const [milestoneTitle, setMilestoneTitle] = useState("");
	const [milestoneDate, setMilestoneDate] = useState("");
	const [partName, setPartName] = useState("");
	const [epicName, setEpicName] = useState("");
	const [epicKey, setEpicKey] = useState("");
	const [epicTargetDate, setEpicTargetDate] = useState("");
	const [epicDescription, setEpicDescription] = useState("");
	const [epicOrder, setEpicOrder] = useState("");
	const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(
		null,
	);
	const [editingMilestoneTitle, setEditingMilestoneTitle] = useState("");
	const [editingMilestoneDate, setEditingMilestoneDate] = useState("");
	const [editingPartId, setEditingPartId] = useState<string | null>(null);
	const [editingPartName, setEditingPartName] = useState("");
	const [editingPartDescription, setEditingPartDescription] = useState("");
	const [editingPartOrder, setEditingPartOrder] = useState("");
	const [editingEpicId, setEditingEpicId] = useState<string | null>(null);
	const [editingEpicName, setEditingEpicName] = useState("");
	const [editingEpicKey, setEditingEpicKey] = useState("");
	const [editingEpicTargetDate, setEditingEpicTargetDate] = useState("");
	const [editingEpicDescription, setEditingEpicDescription] = useState("");
	const [editingEpicOrder, setEditingEpicOrder] = useState("");
	const [milestonesCollapsed, setMilestonesCollapsed] = useState(true);
	const [partsCollapsed, setPartsCollapsed] = useState(true);
	const [epicsCollapsed, setEpicsCollapsed] = useState(true);
	const [tasksCollapsed, setTasksCollapsed] = useState(false);
	const [batchState, setBatchState] = useState("no-change");
	const [batchScope, setBatchScope] = useState("current-filters");
	const [batchScopeMilestoneId, setBatchScopeMilestoneId] = useState("");
	const [batchScopeEpicId, setBatchScopeEpicId] = useState("");
	const [batchMilestoneId, setBatchMilestoneId] = useState("no-change");
	const [batchEpicId, setBatchEpicId] = useState("no-change");
	const [batchPartId, setBatchPartId] = useState("no-change");
	const [batchPriority, setBatchPriority] = useState("");

	const { data: project, isLoading: projectLoading } = useProject(projectId);
	const updateProject = useUpdateProject();
	const deleteProject = useDeleteProject();
	const { data: milestones = [] } = useProjectMilestones(projectId);
	const { data: parts = [] } = useProjectParts(projectId);
	const { data: epics = [] } = useProjectEpics(projectId);
	const createMilestone = useCreateProjectMilestone(projectId);
	const updateMilestone = useUpdateProjectMilestone(projectId);
	const deleteMilestone = useDeleteProjectMilestone(projectId);
	const createPart = useCreateProjectPart(projectId);
	const updatePart = useUpdateProjectPart(projectId);
	const deletePart = useDeleteProjectPart(projectId);
	const createEpic = useCreateProjectEpic(projectId);
	const updateEpic = useUpdateProjectEpic(projectId);
	const deleteEpic = useDeleteProjectEpic(projectId);
	const batchApplyTasks = useBatchApplyProjectTasks(projectId);
	const updateTask = useUpdateTask();
	const isMonorepo = project?.structureType === "Monorepo";

	const taskFilters: TaskFilters = {
		projectId,
		state: search.state as TaskState | undefined,
		partId: isMonorepo ? search.partId : undefined,
		epicId: search.epicId,
		milestoneId: search.milestoneId,
		size: search.size as TaskSize | undefined,
		searchQuery: search.searchQuery,
		sortBy: search.sortBy as TaskFilters["sortBy"],
		sortOrder: search.sortOrder as TaskFilters["sortOrder"],
		page: search.page,
		limit: 20,
	};

	const { data: taskData, isLoading: tasksLoading } = useTasks(taskFilters);

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

	function handleBatchApplyTasks() {
		const filters = {
			state: search.state as TaskState | undefined,
			partId: isMonorepo ? search.partId : undefined,
			epicId: search.epicId,
			milestoneId: search.milestoneId,
			size: search.size as TaskSize | undefined,
			searchQuery: search.searchQuery,
		};
		const apply: {
			state?: Exclude<TaskState, "Inbox" | "Active">;
			milestoneId?: string | null;
			epicIds?: string[] | null;
			partIds?: string[] | null;
			priority?: number | null;
		} = {};

		if (batchScope === "milestone") {
			if (!batchScopeMilestoneId) {
				toast.error("Choose a milestone scope");
				return;
			}
			filters.milestoneId = batchScopeMilestoneId;
			filters.epicId = undefined;
		}
		if (batchScope === "epic") {
			if (!batchScopeEpicId) {
				toast.error("Choose an epic scope");
				return;
			}
			filters.epicId = batchScopeEpicId;
			filters.milestoneId = undefined;
		}

		if (batchState !== "no-change") {
			apply.state = batchState as Exclude<TaskState, "Inbox" | "Active">;
		}
		if (batchMilestoneId !== "no-change") {
			apply.milestoneId =
				batchMilestoneId === "clear" ? null : batchMilestoneId;
		}
		if (batchEpicId !== "no-change") {
			apply.epicIds = batchEpicId === "clear" ? null : [batchEpicId];
		}
		if (isMonorepo && batchPartId !== "no-change") {
			apply.partIds = batchPartId === "clear" ? null : [batchPartId];
		}
		if (batchPriority.trim()) {
			const parsedPriority = Number(batchPriority);
			if (
				Number.isNaN(parsedPriority) ||
				!Number.isInteger(parsedPriority) ||
				parsedPriority < 0 ||
				parsedPriority > 100
			) {
				toast.error("Priority must be a whole number between 0 and 100");
				return;
			}
			apply.priority = parsedPriority;
		}

		if (Object.keys(apply).length === 0) {
			toast.error("Choose at least one field to apply");
			return;
		}

		if (
			!window.confirm(
				`Apply these changes to all ${totalTasks} task${totalTasks === 1 ? "" : "s"} matching the current filters?`,
			)
		) {
			return;
		}

		batchApplyTasks.mutate(
			{
				filters: {
					...filters,
				},
				apply,
			},
			{
				onSuccess: (result) => {
					toast.success("Batch apply complete", {
						description: `${result.updated} of ${result.matched} task${result.matched === 1 ? "" : "s"} updated${result.failed ? `, ${result.failed} skipped` : ""}.`,
					});
				},
				onError: (error) => toast.error(error.message),
			},
		);
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

	function clearTaskFilters() {
		navigate({
			search: {
				sortBy: "updatedAt",
				sortOrder: "desc",
				page: 1,
			},
		});
	}

	function handleCreateMilestone() {
		if (!milestoneTitle.trim()) return;
		createMilestone.mutate(
			{
				title: milestoneTitle.trim(),
				targetDate: milestoneDate || null,
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
					completedAt: moment().toISOString(),
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

	function handleStartMilestoneEdit(milestone: {
		id: string;
		title: string;
		targetDate: string | null;
	}) {
		setEditingMilestoneId(milestone.id);
		setEditingMilestoneTitle(milestone.title);
		setEditingMilestoneDate(milestone.targetDate ?? "");
	}

	function handleCancelMilestoneEdit() {
		setEditingMilestoneId(null);
		setEditingMilestoneTitle("");
		setEditingMilestoneDate("");
	}

	function handleSaveMilestoneEdit(milestoneId: string) {
		if (!editingMilestoneTitle.trim()) {
			toast.error("Milestone title is required");
			return;
		}
		updateMilestone.mutate(
			{
				milestoneId,
				data: {
					title: editingMilestoneTitle.trim(),
					targetDate: editingMilestoneDate || null,
				},
			},
			{
				onSuccess: () => {
					toast.success("Milestone updated");
					handleCancelMilestoneEdit();
				},
				onError: (error) => toast.error(error.message),
			},
		);
	}

	function handleCreatePart() {
		if (!partName.trim()) return;
		createPart.mutate(
			{
				name: partName.trim(),
			},
			{
				onSuccess: () => {
					setPartName("");
					toast.success("Project part created");
				},
				onError: (error) => toast.error(error.message),
			},
		);
	}

	function handleDeletePart(partId: string) {
		deletePart.mutate(partId, {
			onSuccess: () => toast.success("Project part deleted"),
			onError: (error) => toast.error(error.message),
		});
	}

	function handleStartPartEdit(part: {
		id: string;
		name: string;
		description: string | null;
		order: number | null;
	}) {
		setEditingPartId(part.id);
		setEditingPartName(part.name);
		setEditingPartDescription(part.description ?? "");
		setEditingPartOrder(part.order == null ? "" : String(part.order));
	}

	function handleCancelPartEdit() {
		setEditingPartId(null);
		setEditingPartName("");
		setEditingPartDescription("");
		setEditingPartOrder("");
	}

	function handleSavePartEdit(partId: string) {
		if (!editingPartName.trim()) {
			toast.error("Part name is required");
			return;
		}
		const parsedOrder =
			editingPartOrder.trim() === "" ? null : Number(editingPartOrder);
		if (
			parsedOrder !== null &&
			(Number.isNaN(parsedOrder) || !Number.isInteger(parsedOrder))
		) {
			toast.error("Order must be a whole number");
			return;
		}
		updatePart.mutate(
			{
				partId,
				data: {
					name: editingPartName.trim(),
					description: editingPartDescription.trim() || null,
					order: parsedOrder ?? undefined,
				},
			},
			{
				onSuccess: () => {
					toast.success("Project part updated");
					handleCancelPartEdit();
				},
				onError: (error) => toast.error(error.message),
			},
		);
	}

	function handleCreateEpic() {
		if (!epicName.trim()) return;
		createEpic.mutate(
			{
				key: epicKey.trim() || undefined,
				name: epicName.trim(),
				description: epicDescription.trim() || undefined,
				targetDate: epicTargetDate || null,
				order: epicOrder.trim() ? Number(epicOrder) : undefined,
			},
			{
				onSuccess: () => {
					setEpicName("");
					setEpicKey("");
					setEpicTargetDate("");
					setEpicDescription("");
					setEpicOrder("");
					toast.success("Epic created");
				},
				onError: (error) => toast.error(error.message),
			},
		);
	}

	function handleDeleteEpic(epicId: string) {
		deleteEpic.mutate(epicId, {
			onSuccess: () => toast.success("Epic deleted"),
			onError: (error) => toast.error(error.message),
		});
	}

	function handleStartEpicEdit(epic: {
		id: string;
		key: string | null;
		name: string;
		description: string | null;
		targetDate: string | null;
		order: number | null;
	}) {
		setEditingEpicId(epic.id);
		setEditingEpicKey(epic.key ?? "");
		setEditingEpicName(epic.name);
		setEditingEpicDescription(epic.description ?? "");
		setEditingEpicTargetDate(epic.targetDate ?? "");
		setEditingEpicOrder(epic.order == null ? "" : String(epic.order));
	}

	function handleCancelEpicEdit() {
		setEditingEpicId(null);
		setEditingEpicKey("");
		setEditingEpicName("");
		setEditingEpicTargetDate("");
		setEditingEpicDescription("");
		setEditingEpicOrder("");
	}

	function handleSaveEpicEdit(epicId: string) {
		if (!editingEpicName.trim()) {
			toast.error("Epic name is required");
			return;
		}
		updateEpic.mutate(
			{
				epicId,
				data: {
					key: editingEpicKey.trim() || null,
					name: editingEpicName.trim(),
					description: editingEpicDescription.trim() || null,
					targetDate: editingEpicTargetDate || null,
					order: editingEpicOrder.trim() ? Number(editingEpicOrder) : undefined,
				},
			},
			{
				onSuccess: () => {
					toast.success("Epic updated");
					handleCancelEpicEdit();
				},
				onError: (error) => toast.error(error.message),
			},
		);
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
	const batchStates: Array<Exclude<TaskState, "Inbox" | "Active">> = [
		"Ongoing",
		"Ready",
		"Blocked",
		"Paused",
		"Done",
	];
	const sizes: TaskSize[] = ["Small", "Medium", "Large", "Huge"];
	const hasActiveTaskFilters = Boolean(
		search.state ||
			(isMonorepo && search.partId) ||
			search.epicId ||
			search.milestoneId ||
			search.size ||
			search.searchQuery,
	);

	return (
		<div className="space-y-5">
			{/* Breadcrumb */}
			<nav className="flex items-center gap-1 text-xs text-muted-foreground">
				<Link
					to="/projects"
					className="hover:text-foreground transition-colors"
				>
					Projects
				</Link>
				<ChevronRight className="h-3 w-3" />
				<span className="max-w-xs truncate text-foreground">
					{project.name}
				</span>
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
						<RouteHeroBadge variant="neutral">
							{project.taskCount ?? 0} tasks
						</RouteHeroBadge>
						<RouteHeroBadge variant={typeConfig.badge}>
							{typeConfig.label}
						</RouteHeroBadge>
						<RouteHeroBadge variant="neutral">
							{isMonorepo ? "Monorepo" : "Single repo"}
						</RouteHeroBadge>
						{isArchived && (
							<RouteHeroBadge variant="caution">Archived</RouteHeroBadge>
						)}
					</>
				}
				action={
					<div className="flex shrink-0 items-center gap-2">
						<Button
							onClick={() => setCreateTaskOpen(true)}
							className="h-8 gap-1.5 bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90"
						>
							<Plus className="h-3.5 w-3.5" />
							Add task
						</Button>
						<HelpTooltip
							feature="Add Task to Project"
							what="Creates a task already linked to this project."
							use="Use this when new work belongs directly to the current project scope."
							works="Pre-fills project context on task creation to keep reporting accurate."
						/>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon" className="h-8 w-8">
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

			{/* Stats strip */}
			<div className="overflow-hidden rounded-lg border border-border bg-card">
				<div className="grid grid-cols-3 divide-x divide-border">
					<StatCell label="Total" value={project.taskCount ?? 0} />
					<StatCell label="Active" value={project.activeTasks ?? 0} accent />
					<StatCell label="Completed" value={project.completedTasks ?? 0} />
				</div>
			</div>

			{/* Milestones */}
			<Section
				icon={Calendar}
				title="Milestones"
				count={milestones.length}
				collapsed={milestonesCollapsed}
				onToggle={() => setMilestonesCollapsed((v) => !v)}
			>
				<div className="space-y-3">
					<div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
						<Input
							value={milestoneTitle}
							onChange={(event) => setMilestoneTitle(event.target.value)}
							placeholder="Milestone title"
						/>
						<DatePicker
							value={milestoneDate}
							onChange={(next) => setMilestoneDate(next ?? "")}
							boundary="end"
						/>
						<Button
							onClick={handleCreateMilestone}
							disabled={!milestoneTitle.trim()}
						>
							Add milestone
						</Button>
					</div>
					{project.targetCompletionDate && (
						<div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
							Target completion:{" "}
							<span className="font-medium text-foreground">
								{formatDate(project.targetCompletionDate)}
							</span>
						</div>
					)}
					{milestones.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No milestones yet. Add one to track project checkpoints.
						</p>
					) : (
						<div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border">
							{milestones.map((milestone) => (
								<div
									key={milestone.id}
									className="flex flex-col gap-3 bg-card px-3 py-2.5 lg:flex-row lg:items-start lg:justify-between"
								>
									{editingMilestoneId === milestone.id ? (
										<div className="grid w-full gap-2 pr-3 sm:grid-cols-[1fr_180px]">
											<Input
												value={editingMilestoneTitle}
												onChange={(event) =>
													setEditingMilestoneTitle(event.target.value)
												}
												placeholder="Milestone title"
											/>
											<DatePicker
												value={editingMilestoneDate}
												onChange={(next) => setEditingMilestoneDate(next ?? "")}
												boundary="end"
											/>
										</div>
									) : (
										<div className="space-y-1.5">
											<div className="flex flex-wrap items-center gap-1.5">
												<p className="text-sm font-medium text-foreground">
													{milestone.title}
												</p>
												<Badge
													variant={
														milestone.status === "Completed"
															? "done"
															: milestone.status === "AtRisk"
																? "danger"
																: "warning"
													}
													className="px-1.5 py-0 text-[11px]"
												>
													{milestone.status}
												</Badge>
												{milestone.targetDate && (
													<Badge
														variant={
															isOverdue(milestone.targetDate) &&
															milestone.status !== "Completed"
																? "danger"
																: "info"
														}
														className="px-1.5 py-0 text-[11px]"
													>
														<Calendar className="mr-1 h-2.5 w-2.5" />
														{formatDate(milestone.targetDate)}
														{isOverdue(milestone.targetDate) &&
														milestone.status !== "Completed"
															? " · overdue"
															: ""}
													</Badge>
												)}
											</div>
											{milestone.description && (
												<p className="text-xs text-muted-foreground">
													{milestone.description}
												</p>
											)}
											<p className="text-[11px] text-muted-foreground/70">
												Created {formatDate(milestone.createdAt)} · Updated{" "}
												{formatDate(milestone.updatedAt)}
												{milestone.completedAt
													? ` · Completed ${formatDate(milestone.completedAt)}`
													: ""}
											</p>
										</div>
									)}
									<div className="flex shrink-0 items-center gap-1.5">
										{editingMilestoneId === milestone.id ? (
											<>
												<Button
													size="sm"
													className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs"
													onClick={() => handleSaveMilestoneEdit(milestone.id)}
												>
													Save
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 text-xs"
													onClick={handleCancelMilestoneEdit}
												>
													Cancel
												</Button>
											</>
										) : (
											<>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 p-0"
													onClick={() => handleStartMilestoneEdit(milestone)}
												>
													<Pencil className="h-3.5 w-3.5" />
												</Button>
												{milestone.status !== "Completed" && (
													<Button
														size="sm"
														className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 w-7 p-0"
														onClick={() =>
															handleCompleteMilestone(milestone.id)
														}
													>
														<CheckCircle2 className="h-3.5 w-3.5" />
													</Button>
												)}
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
													onClick={() => handleDeleteMilestone(milestone.id)}
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</Section>

			{/* Epics */}
			<Section
				icon={GitBranchPlus}
				title="Epics"
				count={epics.length}
				collapsed={epicsCollapsed}
				onToggle={() => setEpicsCollapsed((v) => !v)}
			>
				<div className="space-y-3">
					<div className="grid gap-2 lg:grid-cols-[110px_1fr_180px_100px_auto]">
						<Input
							value={epicKey}
							onChange={(event) => setEpicKey(event.target.value)}
							placeholder="E-01"
						/>
						<Input
							value={epicName}
							onChange={(event) => setEpicName(event.target.value)}
							placeholder="Epic name"
						/>
						<DatePicker
							value={epicTargetDate}
							onChange={(next) => setEpicTargetDate(next ?? "")}
							boundary="end"
						/>
						<Input
							value={epicOrder}
							onChange={(event) => setEpicOrder(event.target.value)}
							placeholder="Order"
							type="number"
							step={1}
						/>
						<Button onClick={handleCreateEpic} disabled={!epicName.trim()}>
							Add epic
						</Button>
					</div>
					<Input
						value={epicDescription}
						onChange={(event) => setEpicDescription(event.target.value)}
						placeholder="Epic description (optional)"
					/>
					{epics.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No epics yet. Add one to group work by feature area.
						</p>
					) : (
						<div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border">
							{epics.map((epic) => (
								<div
									key={epic.id}
									className="flex flex-col gap-3 bg-card px-3 py-2.5 lg:flex-row lg:items-start lg:justify-between"
								>
									{editingEpicId === epic.id ? (
										<div className="grid w-full gap-2 lg:grid-cols-[110px_1fr_180px_100px]">
											<Input
												value={editingEpicKey}
												onChange={(event) =>
													setEditingEpicKey(event.target.value)
												}
												placeholder="Key"
											/>
											<Input
												value={editingEpicName}
												onChange={(event) =>
													setEditingEpicName(event.target.value)
												}
												placeholder="Epic name"
											/>
											<DatePicker
												value={editingEpicTargetDate}
												onChange={(next) =>
													setEditingEpicTargetDate(next ?? "")
												}
												boundary="end"
											/>
											<Input
												value={editingEpicOrder}
												onChange={(event) =>
													setEditingEpicOrder(event.target.value)
												}
												placeholder="Order"
												type="number"
												step={1}
											/>
											<Input
												value={editingEpicDescription}
												onChange={(event) =>
													setEditingEpicDescription(event.target.value)
												}
												placeholder="Description (optional)"
												className="lg:col-span-4"
											/>
										</div>
									) : (
										<div className="space-y-1.5">
											<div className="flex flex-wrap items-center gap-1.5">
												{epic.key && (
													<Badge
														variant="lavender"
														className="px-1.5 py-0 text-[11px] font-mono"
													>
														{epic.key}
													</Badge>
												)}
												<p className="text-sm font-medium text-foreground">
													{epic.name}
												</p>
												{epic.targetDate && (
													<Badge
														variant={
															isOverdue(epic.targetDate) ? "danger" : "info"
														}
														className="px-1.5 py-0 text-[11px]"
													>
														Due {formatDate(epic.targetDate)}
													</Badge>
												)}
												{epic.order != null && (
													<Badge
														variant="neutral"
														className="px-1.5 py-0 text-[11px]"
													>
														#{epic.order}
													</Badge>
												)}
											</div>
											{epic.description && (
												<p className="text-xs text-muted-foreground">
													{epic.description}
												</p>
											)}
											<p className="text-[11px] text-muted-foreground/70">
												Created {formatDate(epic.createdAt)} · Updated{" "}
												{formatDate(epic.updatedAt)}
											</p>
										</div>
									)}
									<div className="flex shrink-0 items-center gap-1.5">
										{editingEpicId === epic.id ? (
											<>
												<Button
													size="sm"
													className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs"
													onClick={() => handleSaveEpicEdit(epic.id)}
												>
													Save
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 text-xs"
													onClick={handleCancelEpicEdit}
												>
													Cancel
												</Button>
											</>
										) : (
											<>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 p-0"
													onClick={() => handleStartEpicEdit(epic)}
												>
													<Pencil className="h-3.5 w-3.5" />
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
													onClick={() => handleDeleteEpic(epic.id)}
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</Section>

			{/* Parts (Monorepo only) */}
			{isMonorepo && (
				<Section
					icon={GitBranchPlus}
					title="Project Parts"
					count={parts.length}
					collapsed={partsCollapsed}
					onToggle={() => setPartsCollapsed((v) => !v)}
				>
					<div className="space-y-3">
						<div className="grid gap-2 sm:grid-cols-[1fr_auto]">
							<Input
								value={partName}
								onChange={(event) => setPartName(event.target.value)}
								placeholder="Part name (e.g. api, auth, dashboard)"
							/>
							<Button onClick={handleCreatePart} disabled={!partName.trim()}>
								Add part
							</Button>
						</div>
						{parts.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No project parts yet. Add one to assign tasks by monorepo area.
							</p>
						) : (
							<div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border">
								{parts.map((part) => (
									<div
										key={part.id}
										className="flex flex-col gap-3 bg-card px-3 py-2.5 lg:flex-row lg:items-start lg:justify-between"
									>
										{editingPartId === part.id ? (
											<div className="grid w-full gap-2 pr-3 sm:grid-cols-[1fr_1fr_100px]">
												<Input
													value={editingPartName}
													onChange={(event) =>
														setEditingPartName(event.target.value)
													}
													placeholder="Part name"
												/>
												<Input
													value={editingPartDescription}
													onChange={(event) =>
														setEditingPartDescription(event.target.value)
													}
													placeholder="Description (optional)"
												/>
												<Input
													value={editingPartOrder}
													onChange={(event) =>
														setEditingPartOrder(event.target.value)
													}
													placeholder="Order"
													type="number"
													step={1}
												/>
											</div>
										) : (
											<div className="space-y-1.5">
												<div className="flex flex-wrap items-center gap-1.5">
													<p className="text-sm font-medium text-foreground">
														{part.name}
													</p>
													{part.order != null && (
														<Badge
															variant="neutral"
															className="px-1.5 py-0 text-[11px]"
														>
															#{part.order}
														</Badge>
													)}
												</div>
												{part.description && (
													<p className="text-xs text-muted-foreground">
														{part.description}
													</p>
												)}
												<p className="text-[11px] text-muted-foreground/70">
													Created {formatDate(part.createdAt)} · Updated{" "}
													{formatDate(part.updatedAt)}
												</p>
											</div>
										)}
										<div className="flex shrink-0 items-center gap-1.5">
											{editingPartId === part.id ? (
												<>
													<Button
														size="sm"
														className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs"
														onClick={() => handleSavePartEdit(part.id)}
													>
														Save
													</Button>
													<Button
														variant="ghost"
														size="sm"
														className="h-7 text-xs"
														onClick={handleCancelPartEdit}
													>
														Cancel
													</Button>
												</>
											) : (
												<>
													<Button
														variant="ghost"
														size="sm"
														className="h-7 w-7 p-0"
														onClick={() => handleStartPartEdit(part)}
													>
														<Pencil className="h-3.5 w-3.5" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
														onClick={() => handleDeletePart(part.id)}
													>
														<Trash2 className="h-3.5 w-3.5" />
													</Button>
												</>
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</Section>
			)}

			{/* Tasks */}
			<Section
				icon={LayoutList}
				title={
					<span className="flex items-center gap-1.5">
						Tasks
						<HelpTooltip
							feature="Project Tasks"
							what="Task list scoped to this project."
							use="Filter by state, part, epic, milestone, size, and search text."
							works="Updates URL search params and refetches the project task list."
						/>
					</span>
				}
				count={totalTasks}
				collapsed={tasksCollapsed}
				onToggle={() => setTasksCollapsed((v) => !v)}
			>
				<div className="space-y-3">
					{/* Filters */}
					<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(180px,1.2fr)_140px_150px_150px_150px_130px_150px_36px_auto]">
						<Input
							placeholder="Search tasks…"
							value={search.searchQuery || ""}
							onChange={(event) =>
								updateSearch({
									searchQuery: event.target.value || undefined,
								})
							}
							className="w-full"
						/>

						<Select
							value={search.state || "all"}
							onValueChange={(value) =>
								updateSearch({
									state: value === "all" ? undefined : value,
								})
							}
						>
							<SelectTrigger className="w-full">
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

						{isMonorepo && (
							<Select
								value={search.partId || "all"}
								onValueChange={(value) =>
									updateSearch({
										partId: value === "all" ? undefined : value,
									})
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="All parts" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All parts</SelectItem>
									{parts.map((part) => (
										<SelectItem key={part.id} value={part.id}>
											{part.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}

						<Select
							value={search.epicId || "all"}
							onValueChange={(value) =>
								updateSearch({
									epicId: value === "all" ? undefined : value,
								})
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All epics" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All epics</SelectItem>
								{epics.map((epic) => (
									<SelectItem key={epic.id} value={epic.id}>
										{epic.key ? `${epic.key} ` : ""}
										{epic.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							value={search.milestoneId || "all"}
							onValueChange={(value) =>
								updateSearch({
									milestoneId: value === "all" ? undefined : value,
								})
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="All milestones" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All milestones</SelectItem>
								{milestones.map((milestone) => (
									<SelectItem key={milestone.id} value={milestone.id}>
										{milestone.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							value={search.size || "all"}
							onValueChange={(value) =>
								updateSearch({
									size: value === "all" ? undefined : value,
								})
							}
						>
							<SelectTrigger className="w-full">
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
							value={search.sortBy || "updatedAt"}
							onValueChange={(value) => updateSearch({ sortBy: value })}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="updatedAt">Updated</SelectItem>
								<SelectItem value="createdAt">Created</SelectItem>
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
							className="h-9 w-9"
							aria-label="Toggle sort order"
						>
							{search.sortOrder === "asc" ? (
								<ArrowUpAZ className="h-4 w-4" />
							) : (
								<ArrowDownAZ className="h-4 w-4" />
							)}
						</Button>

						{hasActiveTaskFilters && (
							<Button
								variant="ghost"
								onClick={clearTaskFilters}
								className="h-9 justify-center gap-1 text-muted-foreground hover:text-foreground"
							>
								<X className="h-3.5 w-3.5" />
								Clear
							</Button>
						)}
					</div>

					<div className="rounded-lg border border-border bg-muted/30 p-3">
						<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
							<div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
								<CheckCircle2 className="h-4 w-4 text-muted-foreground" />
								Batch apply to filtered tasks
								<HelpTooltip
									feature="Project Batch Apply"
									what="Applies one update to every task matching the current project filters."
									use="Filter first, choose the field to apply, then confirm the batch update."
									works="Sends the active filters and chosen updates to a project-scoped API endpoint."
								/>
							</div>
							<Badge variant="outline">
								{totalTasks} matching task{totalTasks === 1 ? "" : "s"}
							</Badge>
						</div>
						<div className="mb-2 grid gap-2 md:grid-cols-[180px_1fr]">
							<Select value={batchScope} onValueChange={setBatchScope}>
								<SelectTrigger className="w-full bg-card">
									<SelectValue placeholder="Batch scope" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="current-filters">
										Current task filters
									</SelectItem>
									<SelectItem value="milestone">One milestone</SelectItem>
									<SelectItem value="epic">One epic</SelectItem>
								</SelectContent>
							</Select>
							{batchScope === "milestone" ? (
								<Select
									value={batchScopeMilestoneId || "none"}
									onValueChange={(value) =>
										setBatchScopeMilestoneId(value === "none" ? "" : value)
									}
								>
									<SelectTrigger className="w-full bg-card">
										<SelectValue placeholder="Choose milestone scope" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Choose milestone</SelectItem>
										{milestones.map((milestone) => (
											<SelectItem key={milestone.id} value={milestone.id}>
												{milestone.title}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : batchScope === "epic" ? (
								<Select
									value={batchScopeEpicId || "none"}
									onValueChange={(value) =>
										setBatchScopeEpicId(value === "none" ? "" : value)
									}
								>
									<SelectTrigger className="w-full bg-card">
										<SelectValue placeholder="Choose epic scope" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Choose epic</SelectItem>
										{epics.map((epic) => (
											<SelectItem key={epic.id} value={epic.id}>
												{epic.key ? `${epic.key} ` : ""}
												{epic.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : (
								<p className="flex min-h-9 items-center rounded-md border border-border bg-card px-3 text-xs text-muted-foreground">
									Uses the filters above, including state, part, epic,
									milestone, size, and search.
								</p>
							)}
						</div>
						<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[150px_180px_180px_180px_120px_auto]">
							<Select value={batchState} onValueChange={setBatchState}>
								<SelectTrigger className="w-full bg-card">
									<SelectValue placeholder="State" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="no-change">Keep state</SelectItem>
									{batchStates.map((state) => (
										<SelectItem key={state} value={state}>
											Set {state}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select
								value={batchMilestoneId}
								onValueChange={setBatchMilestoneId}
							>
								<SelectTrigger className="w-full bg-card">
									<SelectValue placeholder="Milestone" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="no-change">Keep milestone</SelectItem>
									<SelectItem value="clear">Clear milestone</SelectItem>
									{milestones.map((milestone) => (
										<SelectItem key={milestone.id} value={milestone.id}>
											{milestone.title}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select value={batchEpicId} onValueChange={setBatchEpicId}>
								<SelectTrigger className="w-full bg-card">
									<SelectValue placeholder="Epic" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="no-change">Keep epic</SelectItem>
									<SelectItem value="clear">Clear epics</SelectItem>
									{epics.map((epic) => (
										<SelectItem key={epic.id} value={epic.id}>
											{epic.key ? `${epic.key} ` : ""}
											{epic.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							{isMonorepo ? (
								<Select value={batchPartId} onValueChange={setBatchPartId}>
									<SelectTrigger className="w-full bg-card">
										<SelectValue placeholder="Part" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="no-change">Keep part</SelectItem>
										<SelectItem value="clear">Clear parts</SelectItem>
										{parts.map((part) => (
											<SelectItem key={part.id} value={part.id}>
												{part.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : (
								<div className="hidden xl:block" />
							)}

							<Input
								value={batchPriority}
								onChange={(event) => setBatchPriority(event.target.value)}
								placeholder="Priority"
								type="number"
								min={0}
								max={100}
								step={1}
								className="bg-card"
							/>

							<Button
								className="justify-center bg-primary text-primary-foreground hover:bg-primary/90"
								onClick={handleBatchApplyTasks}
								disabled={batchApplyTasks.isPending || totalTasks === 0}
								className="justify-center"
							>
								<CheckCircle2 className="mr-1.5 h-4 w-4" />
								Apply
							</Button>
						</div>
					</div>

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
						<div className="space-y-1.5">
							{tasks.map((task) => (
								<TaskCard
									key={task.id}
									task={task}
									onStateChange={handleTaskStateChange}
									onSelect={handleTaskSelect}
									showProject={false}
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
				</div>
			</Section>

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

function StatCell({
	label,
	value,
	accent,
}: {
	label: string;
	value: number;
	accent?: boolean;
}) {
	return (
		<div className="px-5 py-4">
			<p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
				{label}
			</p>
			<p
				className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-primary" : "text-foreground"}`}
			>
				{value}
			</p>
		</div>
	);
}
