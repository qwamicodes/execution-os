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
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { goeyToast as toast } from "goey-toast";
import {
	ArrowDownAZ,
	ArrowUpAZ,
	Ban,
	Check,
	Filter,
	Inbox,
	Plus,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { useState } from "react";
import { InboxTaskCard } from "@/components/inbox/inbox-task-card";
import { EmptyState } from "@/components/shared/empty-state";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import {
	RouteHeroBadge,
	RouteHeroHeader,
} from "@/components/shared/route-hero-header";
import { SkeletonList } from "@/components/shared/skeleton-list";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import {
	useApplyAllAISuggestions,
	useDeleteAllAISuggestions,
	useIgnoreAllAISuggestions,
	useInbox,
} from "@/hooks/use-inbox";
import { useProjects } from "@/hooks/use-projects";
import type { InboxFilters, TaskSize } from "@/lib/types";

export interface InboxSearch {
	projectId?: string;
	size?: string;
	source?: string;
	triageStatus?: string;
	searchQuery?: string;
	sortBy?: string;
	sortOrder?: string;
}

export const Route = createFileRoute("/inbox")({
	validateSearch: (search: Record<string, unknown>): InboxSearch => ({
		projectId: search.projectId as string | undefined,
		size: search.size as string | undefined,
		source: search.source as string | undefined,
		triageStatus: search.triageStatus as string | undefined,
		searchQuery: search.searchQuery as string | undefined,
		sortBy: (search.sortBy as string) || "createdAt",
		sortOrder: (search.sortOrder as string) || "desc",
	}),
	component: InboxPage,
});

function InboxPage() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/inbox" });
	const [createOpen, setCreateOpen] = useState(false);
	const { data: projectList } = useProjects();
	const ignoreAllAISuggestions = useIgnoreAllAISuggestions();
	const applyAllAISuggestions = useApplyAllAISuggestions();
	const deleteAllAISuggestions = useDeleteAllAISuggestions();
	const filters: InboxFilters = {
		projectId: search.projectId,
		size: search.size as TaskSize | undefined,
		source: search.source,
		triageStatus: search.triageStatus as InboxFilters["triageStatus"],
		searchQuery: search.searchQuery,
		sortBy: search.sortBy as InboxFilters["sortBy"],
		sortOrder: search.sortOrder as InboxFilters["sortOrder"],
	};
	const { data, isLoading } = useInbox(filters);

	const tasks = data?.tasks || [];
	const pendingCount = data?.meta?.pendingClassification || 0;
	const needsReviewCount = data?.meta?.needsReview || 0;
	const hasActiveFilters = Boolean(
		search.projectId ||
			search.size ||
			search.source ||
			search.triageStatus ||
			search.searchQuery,
	);
	const sizes: TaskSize[] = ["Small", "Medium", "Large", "Huge"];

	function updateSearch(updates: Partial<InboxSearch>) {
		navigate({
			search: (prev: InboxSearch) => ({
				...prev,
				...updates,
			}),
		});
	}

	function clearFilters() {
		navigate({
			search: {
				sortBy: "createdAt",
				sortOrder: "desc",
			},
		});
	}

	function handleIgnoreAllAISuggestions() {
		ignoreAllAISuggestions.mutate(undefined, {
			onSuccess: (result) => {
				toast.success("AI suggestions ignored", {
					description: `${result.ignored ?? 0} inbox item${result.ignored === 1 ? "" : "s"} updated.`,
				});
			},
			onError: (error) => toast.error(error.message),
		});
	}

	function handleApplyAllAISuggestions() {
		if (
			!window.confirm(
				`Apply all ${needsReviewCount} AI suggestion${needsReviewCount === 1 ? "" : "s"} waiting for review?`,
			)
		) {
			return;
		}
		applyAllAISuggestions.mutate(undefined, {
			onSuccess: (result) => {
				toast.success("AI suggestions applied", {
					description: `${result.applied ?? 0} inbox item${result.applied === 1 ? "" : "s"} classified.`,
				});
			},
			onError: (error) => toast.error(error.message),
		});
	}

	function handleDeleteAllAISuggestions() {
		if (
			!window.confirm(
				`Delete all ${needsReviewCount} inbox item${needsReviewCount === 1 ? "" : "s"} waiting for AI review?`,
			)
		) {
			return;
		}
		deleteAllAISuggestions.mutate(undefined, {
			onSuccess: (result) => {
				toast.success("Inbox items deleted", {
					description: `${result.deleted ?? 0} inbox item${result.deleted === 1 ? "" : "s"} deleted.`,
				});
			},
			onError: (error) => toast.error(error.message),
		});
	}

	return (
		<div className="space-y-6">
			<RouteHeroHeader
				eyebrow="Execution Flow"
				title="Inbox"
				description="Triage incoming work quickly, then move each item into execution."
				help={{
					feature: "Inbox",
					what: "Central intake for new work from integrations and manual capture.",
					use: "Review each task, confirm intent, then move it into the right execution state.",
					works:
						"Items start here before AI and manual triage push them into project workflows.",
				}}
				badges={
					<>
						<RouteHeroBadge variant="default">
							{tasks.length} total
						</RouteHeroBadge>
						<RouteHeroBadge variant="sky">
							<Sparkles className="mr-1 h-3 w-3" />
							AI-assisted triage
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
							Add task
						</Button>
						<HelpTooltip
							feature="Add Task"
							what="Creates a new inbox task manually."
							use="Click to capture a new task when it did not come from an integration."
							works="Saves to inbox first so AI triage and assignment can happen before scheduling."
						/>
					</div>
				}
			/>

			<div className="grid gap-3 sm:grid-cols-3">
				<Card className="border-border bg-card">
					<CardContent className="p-4">
						<p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
							Inbox Total
						</p>
						<p className="mt-1 text-2xl font-semibold text-foreground">
							{tasks.length}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border bg-card">
					<CardContent className="p-4">
						<p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
							Pending AI Classify
						</p>
						<p className="mt-1 text-2xl font-semibold text-foreground">
							{pendingCount}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border bg-card">
					<CardContent className="p-4">
						<p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
							Needs Review
						</p>
						<p className="mt-1 text-2xl font-semibold text-foreground">
							{needsReviewCount}
						</p>
					</CardContent>
				</Card>
			</div>

			{(pendingCount > 0 || needsReviewCount > 0) && (
				<div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
					<Badge variant="secondary">
						<Sparkles className="mr-1 h-3 w-3" />
						{pendingCount} AI candidates
					</Badge>
					<HelpTooltip
						feature="AI Candidates"
						what="Items AI detected as ready for automatic classification."
						use="Open and confirm AI output, then adjust only if context is wrong."
						works="The triage model scores incoming tasks and marks high-confidence ones for quick review."
					/>
					{needsReviewCount > 0 && (
						<Badge variant="outline">
							{needsReviewCount} need manual review
						</Badge>
					)}
					{needsReviewCount > 0 && (
						<div className="ml-auto flex flex-wrap items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={handleIgnoreAllAISuggestions}
								disabled={ignoreAllAISuggestions.isPending}
								className="h-8 bg-card"
							>
								<Ban className="mr-1 h-3.5 w-3.5" />
								Ignore all
							</Button>
							<Button
								size="sm"
								onClick={handleApplyAllAISuggestions}
								disabled={applyAllAISuggestions.isPending}
								className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
							>
								<Check className="mr-1 h-3.5 w-3.5" />
								Apply all
							</Button>
							<Button
								variant="destructive"
								size="sm"
								onClick={handleDeleteAllAISuggestions}
								disabled={deleteAllAISuggestions.isPending}
								className="h-8"
							>
								<Trash2 className="mr-1 h-3.5 w-3.5" />
								Delete all
							</Button>
						</div>
					)}
				</div>
			)}

			<Card className="border-border bg-card">
				<CardContent className="space-y-3 p-4">
					<div className="flex items-center justify-between gap-3">
						<div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
							<Filter className="h-4 w-4 text-muted-foreground" />
							Filters
							<HelpTooltip
								feature="Inbox Filters"
								what="Controls inbox scope and ordering."
								use="Search, filter by project and triage status, then sort the inbox queue."
								works="Updates URL search params and refetches inbox tasks."
							/>
						</div>
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
					</div>
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(220px,1fr)_170px_140px_150px_130px_170px_44px]">
						<Input
							placeholder="Search inbox..."
							value={search.searchQuery || ""}
							onChange={(event) =>
								updateSearch({
									searchQuery: event.target.value || undefined,
								})
							}
							className="w-full bg-card"
						/>
						<Select
							value={search.projectId || "all"}
							onValueChange={(value) =>
								updateSearch({
									projectId: value === "all" ? undefined : value,
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
							onValueChange={(value) =>
								updateSearch({
									size: value === "all" ? undefined : value,
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
							value={search.triageStatus || "all"}
							onValueChange={(value) =>
								updateSearch({
									triageStatus: value === "all" ? undefined : value,
								})
							}
						>
							<SelectTrigger className="w-full bg-card">
								<SelectValue placeholder="All triage" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All triage</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
								<SelectItem value="needsReview">Needs review</SelectItem>
								<SelectItem value="classified">Classified</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={search.source || "all"}
							onValueChange={(value) =>
								updateSearch({
									source: value === "all" ? undefined : value,
								})
							}
						>
							<SelectTrigger className="w-full bg-card">
								<SelectValue placeholder="All sources" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All sources</SelectItem>
								<SelectItem value="manual">Manual</SelectItem>
								<SelectItem value="slack">Slack</SelectItem>
								<SelectItem value="email">Email</SelectItem>
								<SelectItem value="git">Git</SelectItem>
								<SelectItem value="voice">Voice</SelectItem>
								<SelectItem value="linear">Linear</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={search.sortBy || "createdAt"}
							onValueChange={(value) => updateSearch({ sortBy: value })}
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
							aria-label="Toggle sort order"
						>
							{search.sortOrder === "asc" ? (
								<ArrowUpAZ className="h-4 w-4" />
							) : (
								<ArrowDownAZ className="h-4 w-4" />
							)}
						</Button>
					</div>
				</CardContent>
			</Card>

			{isLoading && <SkeletonList count={3} />}

			{!isLoading && tasks.length === 0 && (
				<EmptyState
					icon={Inbox}
					title={hasActiveFilters ? "No inbox tasks found" : "Inbox zero"}
					description={
						hasActiveFilters
							? "Try adjusting your filters."
							: "No tasks waiting to be classified. Nice work!"
					}
				>
					{!hasActiveFilters && (
						<Button variant="outline" onClick={() => setCreateOpen(true)}>
							<Plus className="mr-1 h-4 w-4" />
							Add a task
						</Button>
					)}
				</EmptyState>
			)}

			{!isLoading && tasks.length > 0 && (
				<Card className="border-border bg-card">
					<CardContent className="space-y-3 p-4">
						{tasks.map((task) => (
							<InboxTaskCard key={task.id} task={task} />
						))}
					</CardContent>
				</Card>
			)}

			<CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
		</div>
	);
}
