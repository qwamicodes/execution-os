import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import {
	Outlet,
	createFileRoute,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import {
	ArrowDownAZ,
	ArrowUpAZ,
	CheckSquare,
	CircleCheckBig,
	CircleSlash,
	Clock3,
	Filter,
	Lightbulb,
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
import { useProjects } from "@/hooks/use-projects";
import { useAIClassifyTask, useTasks, useUpdateTask } from "@/hooks/use-tasks";
import type { TaskFilters, TaskSize, TaskState } from "@/lib/types";
import { goeyToast as toast } from "goey-toast";

export interface TasksSearch {
	state?: string;
	projectId?: string;
	size?: string;
	tag?: string;
	sortBy?: string;
	sortOrder?: string;
	page?: number;
}

export const Route = createFileRoute("/ideas")({
	validateSearch: (search: Record<string, unknown>): TasksSearch => ({
		state: search.state as string | undefined,
		projectId: search.projectId as string | undefined,
		size: search.size as string | undefined,
		tag: search.tag as string | undefined,
		sortBy: (search.sortBy as string) || "createdAt",
		sortOrder: (search.sortOrder as string) || "desc",
		page: Number(search.page) || 1,
	}),
	component: IdeasPage,
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
	)
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
			? "text-blue-700 bg-blue-50 border-blue-100"
			: tone === "blocked"
				? "text-amber-700 bg-amber-50 border-amber-100"
				: tone === "done"
					? "text-emerald-700 bg-emerald-50 border-emerald-100"
					: "text-slate-700 bg-slate-50 border-slate-200";

	return (
		<Card className="border-white/80 bg-white/90 shadow-sm transition-transform duration-300 hover:-translate-y-0.5">
			<CardContent className="flex items-center justify-between p-4">
				<div>
					<p className="text-xs font-medium tracking-[0.12em] text-slate-500 uppercase">
						{label}
					</p>
					<p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
				</div>
				<div className={`rounded-xl border p-2.5 ${toneClass}`}>
					<Icon className="h-4 w-4" />
				</div>
			</CardContent>
		</Card>
	)
}

function IdeasPage() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/ideas" });
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const [ideaOpen, setIdeaOpen] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);
	const updateTask = useUpdateTask();
	const classifyAI = useAIClassifyTask();
	const { data: projectList } = useProjects();

	const filters: TaskFilters = {
		kind: "idea",
		state: search.state as TaskState | undefined,
		projectId: search.projectId,
		size: search.size as TaskSize | undefined,
		tag: search.tag,
		sortBy: search.sortBy as TaskFilters["sortBy"],
		sortOrder: search.sortOrder as TaskFilters["sortOrder"],
		page: search.page,
		limit: 20,
	}

	const { data, isLoading } = useTasks(filters);
	const tasks = data?.tasks || [];
	const total = data?.total || 0;
	const totalPages = Math.ceil(total / 20);
	const readyCount = tasks.filter((task) => task.state === "Ready").length;
	const blockedCount = tasks.filter((task) => task.state === "Blocked").length;
	const doneCount = tasks.filter((task) => task.state === "Done").length;

	const hasActiveFilters = Boolean(
		search.state || search.projectId || search.size || search.tag,
	);

	useEffect(() => {
		const frame = requestAnimationFrame(() => setIsLoaded(true));
		return () => cancelAnimationFrame(frame);
	}, []);

	if (pathname.startsWith("/ideas/")) {
		return <Outlet />;
	}

	function updateSearch(updates: Partial<TasksSearch>) {
		navigate({
			search: (prev: TasksSearch) => ({
				...prev,
				...updates,
				page: updates.page ?? 1,
			}),
		})
	}

	function clearFilters() {
		navigate({
			search: {
				sortBy: "createdAt",
				sortOrder: "desc",
				page: 1,
			},
		})
	}

	function handleStateChange(taskId: string, newState: TaskState) {
		updateTask.mutate({ id: taskId, data: { state: newState } });
	}

	function handleSelect(taskId: string) {
		navigate({ to: "/ideas/$ideaId", params: { ideaId: taskId } });
	}

	function handleToggleIdea(task: (typeof tasks)[number]) {
		const normalized = task.tags.map((tag) => tag.toLowerCase());
		const isIdeaTask = normalized.some(
			(tag) => tag === "idea" || tag.startsWith("idea/"),
		)
		const withoutIdeaTags = normalized.filter(
			(tag) =>
				tag !== "idea" &&
				tag !== "idea/raw" &&
				tag !== "idea/validated" &&
				tag !== "idea/next",
		)
		const nextTags = isIdeaTask
			? Array.from(new Set(withoutIdeaTags))
			: Array.from(new Set([...withoutIdeaTags, "idea", "idea/raw"]));

		updateTask.mutate(
			{
				id: task.id,
				data: { tags: nextTags },
			},
			{
				onSuccess: () => {
					toast.success(
						isIdeaTask ? "Converted to execution task" : "Converted to idea",
					)
				},
				onError: (error) => {
					toast.error(error.message);
				},
			},
		)
	}

	function handleAIClassify(taskId: string) {
		classifyAI.mutate(taskId, {
			onSuccess: () => {
				toast.success("Idea AI classification completed");
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
	]
	const sizes: TaskSize[] = ["Small", "Medium", "Large", "Huge"];

	return (
		<div className="relative space-y-6 overflow-hidden">
			<div aria-hidden className="pointer-events-none absolute inset-0">
				<div className="absolute -top-24 left-1/3 h-56 w-56 rounded-full bg-sky-200/30 blur-3xl" />
				<div className="absolute -right-12 top-24 h-52 w-52 rounded-full bg-cyan-100/45 blur-3xl" />
			</div>

			<div className="relative space-y-6">
				<StaggerReveal visible={isLoaded} delayMs={20}>
					<Card className="overflow-hidden border-sky-100 bg-linear-to-br from-white via-slate-50/70 to-sky-50/80 shadow-lg shadow-slate-200/60">
						<CardContent className="flex flex-wrap items-start justify-between gap-4 p-6 sm:p-7">
							<div>
								<p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase">
									Idea Space
								</p>
								<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
									<span className="inline-flex items-center gap-2">
										Ideas
										<HelpTooltip
											feature="Ideas"
											what="Capture and refine ideas before promoting to execution."
											use="Filter by state/project and review ideation pipeline."
											works="Keeps discovery tasks separate from execution tasks."
										/>
									</span>
								</h1>
								<p className="mt-2 max-w-2xl text-sm text-slate-600">
									Capture, review, and mature ideas before promoting them into
									execution.
								</p>
								<div className="mt-4 flex flex-wrap items-center gap-2">
									<Badge className="border-0 bg-slate-900 text-white">
										{total} total
									</Badge>
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
											className="rounded-full bg-slate-100 text-slate-600"
										>
											All ideas
										</Badge>
									)}
								</div>
							</div>
							<div className="flex items-center gap-1.5">
								<Button
									variant="outline"
									onClick={() => setIdeaOpen(true)}
									className="h-10 gap-2 border-amber-300 bg-amber-50 px-4 text-amber-900 hover:bg-amber-100"
								>
									<Lightbulb className="h-4 w-4" />
									Log idea
								</Button>
								<HelpTooltip
									feature="Log Idea"
									what="Creates a new idea item."
									use="Capture opportunity, hypothesis, or concept for later validation."
									works="Opens idea creation mode and tags the task as idea/raw."
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
					<Card className="border-white/80 bg-white/90 shadow-sm">
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center justify-between text-base font-semibold text-slate-900">
								<span className="inline-flex items-center gap-2">
									<Filter className="h-4 w-4 text-slate-600" />
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
										className="h-8 text-slate-600 hover:text-slate-900"
									>
										<X className="mr-1 h-3.5 w-3.5" />
										Clear
									</Button>
								)}
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[140px_170px_130px_170px_44px]">
							<Select
								value={search.state || "all"}
								onValueChange={(v) =>
									updateSearch({
										state: v === "all" ? undefined : v,
									})
								}
							>
								<SelectTrigger className="w-full bg-white">
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
								<SelectTrigger className="w-full bg-white">
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
								<SelectTrigger className="w-full bg-white">
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
								<SelectTrigger className="w-full bg-white">
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
								className="w-full bg-white"
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
					<Card className="border-white/80 bg-white/95 shadow-sm">
						<CardContent className="p-4 sm:p-5">
							{isLoading && <SkeletonList count={5} />}

							{!isLoading && tasks.length === 0 && (
								<EmptyState
									icon={CheckSquare}
									title="No ideas found"
									description={
										hasActiveFilters
											? "Try adjusting your filters."
											: "Log your first idea to get started."
									}
								>
									{!hasActiveFilters && (
										<Button
											variant="outline"
											onClick={() => setIdeaOpen(true)}
											className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
										>
											<Lightbulb className="mr-1 h-4 w-4" />
											Log idea
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
											onToggleIdea={handleToggleIdea}
											onAIClassify={handleAIClassify}
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
			</div>

			<CreateTaskDialog
				open={ideaOpen}
				onOpenChange={setIdeaOpen}
				mode="idea"
				defaultTags={["idea", "idea/raw"]}
			/>
		</div>
	);
}
