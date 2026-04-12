import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Timer } from "lucide-react";
import { useEffect } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import {
	RouteHeroBadge,
	RouteHeroHeader,
} from "@/components/shared/route-hero-header";
import { useActiveSession } from "@/hooks/use-sessions";

export const Route = createFileRoute("/sessions/")({
	component: SessionsPage,
});

function SessionsPage() {
	const navigate = useNavigate();
	const { data: session, isLoading } = useActiveSession();

	useEffect(() => {
		if (!session) return;
		navigate({
			to: "/sessions/$sessionId",
			params: { sessionId: session.id },
			replace: true,
		});
	}, [session, navigate]);

	if (isLoading) {
		return (
			<div className="space-y-6">
				<RouteHeroHeader
					eyebrow="Execution Flow"
					title="Focus Sessions"
					description="Time-boxed work sessions designed for deep, uninterrupted execution."
					help={{
						feature: "Focus Sessions",
						what: "Pomodoro-style execution mode linked to a single task.",
						use: "Start from a Ready task, stay inside one objective, and close with an outcome.",
						works:
							"Tracks timer, pause/resume state, notes, and final outcome for analytics.",
					}}
					badges={
						<RouteHeroBadge className="rounded-full bg-slate-100 text-slate-600">
							Loading session state
						</RouteHeroBadge>
					}
				/>
				<div className="flex h-48 items-center justify-center">
					<Spinner size="lg" />
				</div>
			</div>
		);
	}

	if (!session) {
		return (
			<div className="space-y-6">
				<RouteHeroHeader
					eyebrow="Execution Flow"
					title="Focus Sessions"
					description="Time-boxed work sessions designed for deep, uninterrupted execution."
					help={{
						feature: "Focus Sessions",
						what: "Pomodoro-style execution mode linked to a single task.",
						use: "Start from a Ready task, stay inside one objective, and close with an outcome.",
						works:
							"Tracks timer, pause/resume state, notes, and final outcome for analytics.",
					}}
					badges={
						<RouteHeroBadge className="rounded-full bg-sky-100 text-sky-700">
							No active session
						</RouteHeroBadge>
					}
				/>

				<div className="grid gap-4 md:grid-cols-2">
					<Card className="border-slate-200 bg-white/85">
						<CardContent className="space-y-4 p-6">
							<div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium tracking-[0.14em] text-slate-600 uppercase">
								Focus Mode
							</div>
							<h2 className="text-xl font-semibold tracking-tight text-slate-900">
								No active session
							</h2>
							<p className="text-sm text-slate-600">
								Start from a Ready task and keep momentum with the built-in
								pomodoro timer, scratchpad, and outcome tracking.
							</p>
							<div className="flex flex-wrap items-center gap-2">
								<Button asChild>
									<Link to="/tasks" search={{ state: "Ready" }}>
										Browse ready tasks
									</Link>
								</Button>
								<Button variant="outline" asChild>
									<Link to="/sessions/history">View history</Link>
								</Button>
							</div>
						</CardContent>
					</Card>
					<EmptyState
						icon={Timer}
						title="Execution ritual"
						description="Pick one task, run one timer, and ship one concrete outcome."
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-48 items-center justify-center">
			<Spinner size="lg" />
		</div>
	);
}
