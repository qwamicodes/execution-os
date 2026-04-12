import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { createFileRoute } from "@tanstack/react-router";
import { Inbox, Plus, Sparkles } from "lucide-react";
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
import { useInbox } from "@/hooks/use-inbox";

export const Route = createFileRoute("/inbox")({
	component: InboxPage,
});

function InboxPage() {
	const { data, isLoading } = useInbox();
	const [createOpen, setCreateOpen] = useState(false);

	const tasks = data?.tasks || [];
	const pendingCount = data?.meta?.pendingClassification || 0;
	const needsReviewCount = data?.meta?.needsReview || 0;

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
						<RouteHeroBadge className="border-0 bg-slate-900 text-white">
							{tasks.length} total
						</RouteHeroBadge>
						<RouteHeroBadge className="rounded-full bg-sky-100 text-sky-700">
							<Sparkles className="mr-1 h-3 w-3" />
							AI-assisted triage
						</RouteHeroBadge>
					</>
				}
				action={
					<div className="flex items-center gap-1.5">
						<Button
							onClick={() => setCreateOpen(true)}
							className="h-10 gap-2 bg-slate-950 px-4 text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
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
				<Card className="border-slate-200 bg-white/85">
					<CardContent className="p-4">
						<p className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase">
							Inbox Total
						</p>
						<p className="mt-1 text-2xl font-semibold text-slate-900">
							{tasks.length}
						</p>
					</CardContent>
				</Card>
				<Card className="border-slate-200 bg-white/85">
					<CardContent className="p-4">
						<p className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase">
							Pending AI Classify
						</p>
						<p className="mt-1 text-2xl font-semibold text-slate-900">
							{pendingCount}
						</p>
					</CardContent>
				</Card>
				<Card className="border-slate-200 bg-white/85">
					<CardContent className="p-4">
						<p className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase">
							Needs Review
						</p>
						<p className="mt-1 text-2xl font-semibold text-slate-900">
							{needsReviewCount}
						</p>
					</CardContent>
				</Card>
			</div>

			{(pendingCount > 0 || needsReviewCount > 0) && (
				<div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
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
				</div>
			)}

			{isLoading && <SkeletonList count={3} />}

			{!isLoading && tasks.length === 0 && (
				<EmptyState
					icon={Inbox}
					title="Inbox zero"
					description="No tasks waiting to be classified. Nice work!"
				>
					<Button variant="outline" onClick={() => setCreateOpen(true)}>
						<Plus className="mr-1 h-4 w-4" />
						Add a task
					</Button>
				</EmptyState>
			)}

			{!isLoading && tasks.length > 0 && (
				<Card className="border-slate-200 bg-white/90">
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
