import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Lightbulb, Plus, WandSparkles } from "lucide-react";
import { goeyToast as toast } from "goey-toast";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonList } from "@/components/shared/skeleton-list";
import { LogIdeaDialog } from "@/components/ideas/log-idea-dialog";
import { useIdeas, useMigrateLegacyIdeaTasks } from "@/hooks/use-ideas";
import type { IdeaFilters, IdeaState } from "@/lib/types";

export interface IdeasSearch {
	state?: string;
	searchQuery?: string;
	page?: number;
}

export const Route = createFileRoute("/ideas")({
	validateSearch: (search: Record<string, unknown>): IdeasSearch => ({
		state: search.state as string | undefined,
		searchQuery: search.searchQuery as string | undefined,
		page: Number(search.page) || 1,
	}),
	component: IdeasPage,
});

function IdeasPage() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/ideas" });
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const [logIdeaOpen, setLogIdeaOpen] = useState(false);
	const migrateLegacyIdeas = useMigrateLegacyIdeaTasks();

	const filters: IdeaFilters = {
		state: search.state as IdeaState | undefined,
		searchQuery: search.searchQuery,
		page: search.page,
		limit: 20,
	};
	const { data, isLoading } = useIdeas(filters);
	const ideas = data?.ideas ?? [];

	if (pathname.startsWith("/ideas/")) {
		return <Outlet />;
	}

	function updateSearch(updates: Partial<IdeasSearch>) {
		navigate({
			search: (prev: IdeasSearch) => ({ ...prev, ...updates, page: updates.page ?? 1 }),
		});
	}

	function handleCreateIdea() {
		setLogIdeaOpen(true);
	}

	function handleLegacyMigration() {
		migrateLegacyIdeas.mutate(undefined, {
			onSuccess: (result) => {
				toast.success(`Legacy ideas migration completed`, {
					description: `Scanned ${result.scanned}, migrated ${result.migrated}`,
				});
			},
			onError: (error) => toast.error(error.message),
		});
	}

	return (
		<>
			<div className="space-y-6">
			<Card className="border-sky-100 bg-linear-to-br from-white via-slate-50/70 to-sky-50/80">
				<CardContent className="flex items-start justify-between gap-4 p-6">
					<div>
						<p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase">Idea Space</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Ideas</h1>
						<p className="mt-2 text-sm text-slate-600">Ideas are now separate from tasks and mutually exclusive.</p>
						<div className="mt-3">
							<Badge className="border-0 bg-slate-900 text-white">{data?.total ?? 0} total</Badge>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" onClick={handleLegacyMigration}>
							<WandSparkles className="mr-2 h-4 w-4" />
							Migrate legacy idea-tags
						</Button>
						<Button className="dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white" onClick={handleCreateIdea}>
							<Plus className="mr-2 h-4 w-4" />
							Log idea
						</Button>
					</div>
				</CardContent>
			</Card>

			<div className="flex flex-wrap items-center gap-2">
				<Input
					placeholder="Search ideas..."
					value={search.searchQuery || ""}
					onChange={(event) =>
						updateSearch({ searchQuery: event.target.value || undefined })
					}
					className="w-64"
				/>
				<Select value={search.state || "all"} onValueChange={(value) => updateSearch({ state: value === "all" ? undefined : value })}>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="State" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All states</SelectItem>
						{["Captured", "Classified", "Clarified", "Planned", "Incubating", "Archived"].map((state) => (
							<SelectItem key={state} value={state}>{state}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{isLoading ? (
				<SkeletonList count={6} />
			) : ideas.length === 0 ? (
				<EmptyState
					icon={Lightbulb}
					title="No ideas found"
					description="Capture your next idea to get started."
				>
					<Button onClick={handleCreateIdea}>Log idea</Button>
				</EmptyState>
			) : (
				<div className="grid gap-3 md:grid-cols-2">
					{ideas.map((idea) => (
						<Card key={idea.id} className="cursor-pointer" onClick={() => navigate({ to: "/ideas/$ideaId", params: { ideaId: idea.id } })}>
							<CardHeader className="pb-2">
								<CardTitle className="line-clamp-1 text-base">{idea.title}</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								<p className="line-clamp-2 text-sm text-slate-600">{idea.description || "No description"}</p>
								<div className="flex items-center gap-2">
									<Badge variant="outline">{idea.state}</Badge>
									<Badge variant="outline" className="ml-auto">
										<Lightbulb className="mr-1 h-3 w-3" />
										Idea
									</Badge>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
			</div>
			<LogIdeaDialog open={logIdeaOpen} onOpenChange={setLogIdeaOpen} />
		</>
	);
}
