import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Switch } from "@repo/ui/components/ui/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FolderOpen, LayoutGrid, List, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { goeyToast as toast } from "goey-toast";
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
import type { Project, ProjectType } from "@/lib/types";

export const Route = createFileRoute("/projects/")({
	component: ProjectsPage,
});

function ProjectsPage() {
	const navigate = useNavigate();
	const [createOpen, setCreateOpen] = useState(false);
	const [editProject, setEditProject] = useState<Project | null>(null);
	const [includeArchived, setIncludeArchived] = useState(false);
	const [activeTab, setActiveTab] = useState<string>("all");
	const [cardDensity, setCardDensity] = useState<"compact" | "expanded">(
		"expanded",
	);

	const { data: projectList, isLoading } = useProjects({
		type: activeTab === "all" ? undefined : (activeTab as ProjectType),
		includeArchived,
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
						<RouteHeroBadge className="border-0 bg-slate-900 text-white">
							{projects.length} projects
						</RouteHeroBadge>
						<RouteHeroBadge className="rounded-full bg-sky-100 text-sky-700">
							<Sparkles className="mr-1 h-3 w-3" />
							Portfolio view
						</RouteHeroBadge>
					</>
				}
				action={
					<div className="flex items-center gap-1.5">
						<Button
							onClick={() => setCreateOpen(true)}
							className="h-10 gap-2 bg-slate-950 px-4 text-white hover:bg-slate-800"
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

			<div className="grid gap-3 sm:grid-cols-4">
				<MetricCard label="Projects" value={projects.length} />
				<MetricCard label="Tasks" value={totalTasks} />
				<MetricCard label="Active" value={activeTasks} />
				<MetricCard label="Completed" value={completedTasks} />
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white/85 p-3">
					<div className="w-full overflow-x-auto pb-1 sm:w-auto sm:pb-0">
						<TabsList className="inline-flex w-max min-w-full bg-slate-100/80 sm:min-w-0">
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

					<div className="flex w-full flex-wrap items-center gap-3 text-sm text-slate-600 sm:w-auto">
						<div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
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
								className="border border-slate-200 bg-slate-50 text-slate-700"
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
