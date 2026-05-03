import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { DatePicker } from "@repo/ui/components/ui/date-picker";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, Timer, X } from "lucide-react";
import { SessionHistoryCard } from "@/components/sessions/session-history-card";
import { EmptyState } from "@/components/shared/empty-state";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import { Pagination } from "@/components/shared/pagination";
import { formatLoggedDuration } from "@/lib/constants";
import {
	RouteHeroBadge,
	RouteHeroHeader,
} from "@/components/shared/route-hero-header";
import { SkeletonList } from "@/components/shared/skeleton-list";
import { useSessionHistory } from "@/hooks/use-sessions";
import type { SessionOutcome } from "@/lib/types";

export interface HistorySearch {
	outcome?: string;
	startDate?: string;
	endDate?: string;
	page?: number;
}

export const Route = createFileRoute("/sessions/history")({
	validateSearch: (search: Record<string, unknown>): HistorySearch => ({
		outcome: search.outcome as string | undefined,
		startDate: search.startDate as string | undefined,
		endDate: search.endDate as string | undefined,
		page: Number(search.page) || 1,
	}),
	component: SessionHistoryPage,
});

function SessionHistoryPage() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/sessions/history" });

	const { data, isLoading } = useSessionHistory({
		outcome: search.outcome as SessionOutcome | undefined,
		startDate: search.startDate,
		endDate: search.endDate,
		page: search.page,
		limit: 20,
	});

	const sessions = data?.data ?? [];
	const total = data?.meta?.total ?? 0;
	const totalPages = data?.meta?.pages ?? 1;
	const hasFilters = search.outcome || search.startDate || search.endDate;

	function updateSearch(updates: Partial<HistorySearch>) {
		navigate({
			search: (prev: HistorySearch) => ({
				...prev,
				...updates,
				page: updates.page ?? 1,
			}),
		});
	}

	function clearFilters() {
		navigate({ search: { page: 1 } });
	}

	const outcomes: SessionOutcome[] = ["Done", "Continue", "Blocked", "TooBig"];
	const doneCount = sessions.filter(
		(session) => session.outcome === "Done",
	).length;
	const totalMinutes = sessions.reduce((sum, session) => {
		const actualMinutes = session.actualDuration ?? session.duration;
		return sum + actualMinutes;
	}, 0);

	return (
		<div className="space-y-6">
			<RouteHeroHeader
				eyebrow="Execution Flow"
				title="Session History"
				description="Review outcomes, time spent, and session trends."
				help={{
					feature: "Session History",
					what: "Record of completed focus sessions and execution outcomes.",
					use: "Filter by outcome and date to audit productivity and identify bottlenecks.",
					works:
						"Reads paginated historical session data and aggregates timing metrics.",
				}}
				badges={
					<>
						<RouteHeroBadge variant="default">
							{total} sessions
						</RouteHeroBadge>
						<RouteHeroBadge variant="sky">
							Historical analytics
						</RouteHeroBadge>
					</>
				}
				action={
					<Button variant="outline" asChild>
						<Link to="/sessions">
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Active Session
						</Link>
					</Button>
				}
			/>

			<div className="grid gap-3 sm:grid-cols-3">
				<Card className="border-border bg-card">
					<CardContent className="p-4">
						<p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
							Sessions
						</p>
						<p className="mt-1 text-2xl font-semibold text-foreground">
							{total}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border bg-card">
					<CardContent className="p-4">
						<p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
							Done Outcomes
						</p>
						<p className="mt-1 text-2xl font-semibold text-foreground">
							{doneCount}
						</p>
					</CardContent>
				</Card>
				<Card className="border-border bg-card">
					<CardContent className="p-4">
						<p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
							Time Logged
						</p>
						<p className="mt-1 text-2xl font-semibold text-foreground">
							{formatLoggedDuration(totalMinutes)}
						</p>
					</CardContent>
				</Card>
			</div>

			<Card className="border-border bg-card">
				<CardContent className="space-y-3 p-4">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
						<CalendarClock className="h-4 w-4 text-muted-foreground" />
						Filter History
						<HelpTooltip
							feature="History Filters"
							what="Narrow the history list by outcome and date window."
							use="Set outcome and time range to inspect specific periods or patterns."
							works="Applies query params to the history endpoint and refreshes results."
						/>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Select
							value={search.outcome || "all"}
							onValueChange={(v) =>
								updateSearch({
									outcome: v === "all" ? undefined : v,
								})
							}
						>
							<SelectTrigger className="w-37.5 border-border bg-card">
								<SelectValue placeholder="All outcomes" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All outcomes</SelectItem>
								{outcomes.map((o) => (
									<SelectItem key={o} value={o}>
										{o === "TooBig" ? "Too Big" : o}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<div className="w-42.5">
							<DatePicker
								value={search.startDate}
								onChange={(next) =>
									updateSearch({
										startDate: next || undefined,
									})
								}
								placeholder="Start date"
								className="border-border bg-card"
								boundary="start"
							/>
						</div>

						<div className="w-42.5">
							<DatePicker
								value={search.endDate}
								onChange={(next) =>
									updateSearch({
										endDate: next || undefined,
									})
								}
								placeholder="End date"
								className="border-border bg-card"
								boundary="end"
							/>
						</div>

						{hasFilters && (
							<Button variant="ghost" size="sm" onClick={clearFilters}>
								<X className="mr-1 h-3 w-3" />
								Clear
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			<Card className="border-border bg-card">
				<CardContent className="p-4">
					{isLoading && <SkeletonList count={5} />}

					{!isLoading && sessions.length === 0 && (
						<EmptyState
							icon={Timer}
							title="No sessions found"
							description={
								hasFilters
									? "Try adjusting your filters."
									: "Complete a focus session to see it here."
							}
						/>
					)}

					{!isLoading && sessions.length > 0 && (
						<div className="space-y-2">
							{sessions.map((session) => (
								<SessionHistoryCard key={session.id} session={session} />
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{totalPages > 1 && (
				<Pagination
					currentPage={search.page || 1}
					totalPages={totalPages}
					onPageChange={(page) => updateSearch({ page })}
				/>
			)}
		</div>
	);
}
