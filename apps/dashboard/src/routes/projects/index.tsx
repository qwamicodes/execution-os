import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { goeyToast as toast } from "goey-toast";
import {
	ArrowDownAZ,
	ArrowUpAZ,
	FolderOpen,
	LayoutGrid,
	List,
	Plus,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { EmptyState } from "@/components/shared/empty-state";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import {
	RouteHeroBadge,
	RouteHeroHeader,
} from "@/components/shared/route-hero-header";
import { SkeletonList } from "@/components/shared/skeleton-list";
import {
	useDeleteProject,
	useProjects,
	useUpdateProject,
} from "@/hooks/use-projects";
import { PROJECT_TYPE_CONFIG } from "@/lib/constants";
import type { Project, ProjectFilters, ProjectType } from "@/lib/types";

export const Route = createFileRoute("/projects/")({
	component: ProjectsPage,
});

function ProjectsPage() {
	const navigate = useNavigate();
	const [searchQuery, setSearchQuery] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const [editProject, setEditProject] = useState<Project | null>(null);
	const [includeArchived, setIncludeArchived] = useState(false);
	const [sortBy, setSortBy] =
		useState<NonNullable<ProjectFilters["sortBy"]>>("updatedAt");
	const [sortOrder, setSortOrder] =
		useState<NonNullable<ProjectFilters["sortOrder"]>>("desc");
	const [activeTab, setActiveTab] = useState<string>("all");
	const [cardDensity, setCardDensity] = useState<"compact" | "expanded">(
		"expanded",
	);

	const { data: projectList, isLoading } = useProjects({
		type: activeTab === "all" ? undefined : (activeTab as ProjectType),
		includeArchived,
		searchQuery: searchQuery || undefined,
		sortBy,
		sortOrder,
	});

	const updateProject = useUpdateProject();
	const deleteProject = useDeleteProject();

	const projects = Array.isArray(projectList) ? projectList : [];
	const totalTasks = projects.reduce(
		(sum, project) => sum + (project.taskCount ?? 0),
		0,
	);
	const activeTasks = projects.reduce(
		(sum, project) => sum + (project.activeTasks ?? 0),
		0,
	);
	const completedTasks = projects.reduce(
		(sum, project) => sum + (project.completedTasks ?? 0),
		0,
	);

	function handleSelect(id: string) {
		navigate({ to: "/projects/$projectId", params: { projectId: id } });
	}

	function handleArchive(id: string, archived: boolean) {
		updateProject.mutate(
			{ id, data: { archived } },
			{
				onSuccess: () => {
					toast.success(archived ? "Project archived" : "Project unarchived");
				},
				onError: (error) => {
					toast.error(error.message);
				},
			},
		);
	}

	function handleDelete(id: string) {
		deleteProject.mutate(id, {
			onSuccess: () => {
				toast.success("Project deleted");
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});
	}

	const types: { value: string; label: string }[] = [
		{ value: "all", label: "All" },
		...Object.entries(PROJECT_TYPE_CONFIG).map(([key, config]) => ({
			value: key,
			label: `${config.emoji} ${config.label}`,
		})),
	];

	return (
		<div className="space-y-6">
			<RouteHeroHeader
				eyebrow="Execution Flow"
				title="Projects"
				description="Organize work across clients, core initiatives, and side quests."
				help={{
					feature: "Projects",
					what: "Portfolio-level grouping for tasks, scope, and delivery tracking.",
					use: "Create a project for each initiative, then organize tasks by type and status.",
					works:
						"Project metadata powers dashboards, AI context, and task routing across teams.",
				}}
				badges={
					<>
						<RouteHeroBadge variant="default">
							{projects.length} projects
						</RouteHeroBadge>
						<RouteHeroBadge variant="sky">
							<Sparkles className="mr-1 h-3 w-3" />
							Portfolio view
						</RouteHeroBadge>
					</>
				}
				action={
					<div className="flex items-center gap-1.5">
						<Button
							onClick={() => setCreateOpen(true)}
							className="h-10 gap-2 bg-primary px-4 text-primary-foreground hover:bg-primary/90"
						>
							<Plus className="h-4 w-4" />
							New project
						</Button>
						<HelpTooltip
							feature="New Project"
							what="Creates a container for tasks, reporting, and ownership."
							use="Use one project per client deliverable or internal initiative."
							works="Links tasks, sessions, and AI planning context under a single project record."
						/>
					</div>
				}
			/>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<MetricCard label="Projects" value={projects.length} />
				<MetricCard label="Tasks" value={totalTasks} />
				<MetricCard label="Active" value={activeTasks} />
				<MetricCard label="Completed" value={completedTasks} />
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-3">
					<div className="no-scrollbar w-full overflow-x-auto pb-1 sm:w-auto sm:pb-0">
						<TabsList className="inline-flex w-max min-w-full bg-muted/60 sm:min-w-0">
							{types.map((type) => (
								<TabsTrigger
									key={type.value}
									value={type.value}
									className="whitespace-nowrap"
								>
									{type.label}
								</TabsTrigger>
							))}
						</TabsList>
					</div>

					<div className="flex w-full flex-wrap items-center gap-3 text-sm text-muted-foreground sm:w-auto">
						<Input
							placeholder="Search projects..."
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							className="h-8 w-full bg-card sm:w-56"
						/>
						<Select
							value={sortBy}
							onValueChange={(value) =>
								setSortBy(value as NonNullable<ProjectFilters["sortBy"]>)
							}
						>
							<SelectTrigger className="h-8 w-full bg-card sm:w-44">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="updatedAt">Updated</SelectItem>
								<SelectItem value="createdAt">Created</SelectItem>
								<SelectItem value="name">Name</SelectItem>
								<SelectItem value="targetCompletionDate">
									Target date
								</SelectItem>
							</SelectContent>
						</Select>
						<Button
							variant="outline"
							size="icon"
							onClick={() =>
								setSortOrder((current) => (current === "asc" ? "desc" : "asc"))
							}
							className="h-8 w-8 bg-card"
							aria-label="Toggle project sort order"
						>
							{sortOrder === "asc" ? (
								<ArrowUpAZ className="h-4 w-4" />
							) : (
								<ArrowDownAZ className="h-4 w-4" />
							)}
						</Button>
						<div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
							<Button
								size="sm"
								variant={cardDensity === "compact" ? "default" : "ghost"}
								className="h-7 px-2.5"
								onClick={() => setCardDensity("compact")}
							>
								<List className="mr-1 h-3.5 w-3.5" />
								Compact
							</Button>
							<Button
								size="sm"
								variant={cardDensity === "expanded" ? "default" : "ghost"}
								className="h-7 px-2.5"
								onClick={() => setCardDensity("expanded")}
							>
								<LayoutGrid className="mr-1 h-3.5 w-3.5" />
								Expanded
							</Button>
						</div>
						<Switch
							checked={includeArchived}
							onCheckedChange={setIncludeArchived}
						/>
						<span>Show archived</span>
						<HelpTooltip
							feature="Archived Filter"
							what="Controls whether archived projects appear in this list."
							use="Enable when you need to revisit old work, disable for active focus."
							works="Toggles an include-archived query flag on the projects endpoint."
						/>
					</div>
				</div>

				{isLoading && <SkeletonList count={4} />}

				{!isLoading && projects.length === 0 && (
					<EmptyState
						icon={FolderOpen}
						title="No projects found"
						description={
							activeTab !== "all"
								? `No ${PROJECT_TYPE_CONFIG[activeTab as ProjectType]?.label} projects yet.`
								: "Create your first project to get started."
						}
					>
						{activeTab === "all" && (
							<Button variant="outline" onClick={() => setCreateOpen(true)}>
								<Plus className="mr-1 h-4 w-4" />
								Create a project
							</Button>
						)}
					</EmptyState>
				)}

				{!isLoading && projects.length > 0 && (
					<TabsContent value={activeTab} className="mt-4" forceMount>
						<div className="mb-3 flex items-center gap-2">
							<Badge
								variant="secondary"
								className="border border-border bg-muted/40 text-muted-foreground"
							>
								<Sparkles className="mr-1 h-3 w-3" />
								Structured by type
							</Badge>
						</div>
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{projects.map((project, index) => (
								<ProjectCard
									key={project.id}
									project={project}
									onSelect={handleSelect}
									onEdit={setEditProject}
									onArchive={handleArchive}
									onDelete={handleDelete}
									density={cardDensity}
									index={index}
								/>
							))}
						</div>
					</TabsContent>
				)}
			</Tabs>

			<CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />

			{editProject && (
				<EditProjectDialog
					project={editProject}
					open={!!editProject}
					onOpenChange={(open) => {
						if (!open) setEditProject(null);
					}}
				/>
			)}
		</div>
	);
}

function MetricCard({ label, value }: { label: string; value: number }) {
	return (
		<Card className="border-border bg-card">
			<CardContent className="p-4">
				<p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
					{label}
				</p>
				<p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
			</CardContent>
		</Card>
	);
}
