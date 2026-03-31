import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Progress } from "@repo/ui/components/ui/progress";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Pause, Play, Square, Timer } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { goeyToast as toast } from "goey-toast";
import { CompleteSessionDialog } from "@/components/sessions/complete-session-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import {
	RouteHeroBadge,
	RouteHeroHeader,
} from "@/components/shared/route-hero-header";
import { useSessionTimer } from "@/hooks/use-session-timer";
import { useSessionSounds } from "@/hooks/use-session-sounds";
import {
	useActiveSession,
	usePauseSession,
	useResumeSession,
	useUpdateScratchpad,
} from "@/hooks/use-sessions";

export const Route = createFileRoute("/sessions/")({
	component: SessionsPage,
});

function SessionsPage() {
	const { data: session, isLoading } = useActiveSession();
	const pauseSession = usePauseSession();
	const resumeSession = useResumeSession();
	const updateScratchpad = useUpdateScratchpad();
	const { playSessionPause, playSessionResume, playSessionError } =
		useSessionSounds();
	const { formattedTime, isExpired, progress } = useSessionTimer(
		session || null,
	);

	const [completeOpen, setCompleteOpen] = useState(false);
	const [scratchpad, setScratchpad] = useState("");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const initialized = useRef(false);

	// Sync scratchpad from server on first load
	useEffect(() => {
		if (session && !initialized.current) {
			setScratchpad(session.scratchpad || "");
			initialized.current = true;
		}
		if (!session) {
			initialized.current = false;
		}
	}, [session]);

	const debouncedSave = useCallback(
		(content: string) => {
			if (!session) return;
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				updateScratchpad.mutate({ id: session.id, content });
			}, 500);
		},
		[session, updateScratchpad],
	);

	function handleScratchpadChange(value: string) {
		setScratchpad(value);
		debouncedSave(value);
	}

	function handlePauseResume() {
		if (!session) return;
		if (session.state === "Active") {
			pauseSession.mutate(session.id, {
				onSuccess: () => playSessionPause(),
				onError: (error) => {
					playSessionError();
					toast.error(error.message);
				},
			});
		} else {
			resumeSession.mutate(session.id, {
				onSuccess: () => playSessionResume(),
				onError: (error) => {
					playSessionError();
					toast.error(error.message);
				},
			});
		}
	}

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

	const isPaused = session.state === "Paused";

	return (
		<div className="space-y-6">
			<RouteHeroHeader
				eyebrow="Execution Flow"
				title="Focus Sessions"
				description="Single-task execution with timer, scratchpad, and structured outcomes."
				help={{
					feature: "Focus Sessions",
					what: "Pomodoro-style execution mode linked to a single task.",
					use: "Run one session at a time, update notes, then end with a clear result.",
					works:
						"Session lifecycle updates are persisted and used by AI recommendations.",
				}}
				badges={
					<>
						<RouteHeroBadge className="border-0 bg-slate-900 text-white">
							Pomodoro active
						</RouteHeroBadge>
						<RouteHeroBadge className="rounded-full bg-sky-100 text-sky-700">
							Timer + notes
						</RouteHeroBadge>
					</>
				}
				action={
					<Button variant="outline" asChild>
						<Link to="/sessions/history">Session history</Link>
					</Button>
				}
			/>

			<Card className="border-slate-200 bg-linear-to-b from-white to-slate-50">
				<CardContent className="flex flex-col items-center py-10">
					<div className="flex items-center gap-1.5">
						<Link
							to="/tasks/$taskId"
							params={{ taskId: session.taskId }}
							className="text-lg font-medium text-slate-600 transition-colors hover:text-slate-900"
						>
							{session.task?.title || "Current task"}
						</Link>
						<HelpTooltip
							feature="Current Task"
							what="The task this session is currently executing."
							use="Click it to jump into full task context while preserving session state."
							works="Session stores a task id link so timer work and task updates stay connected."
						/>
					</div>

					<Badge
						variant="secondary"
						className={`mt-4 rounded-full px-3 py-1 text-[11px] tracking-[0.14em] uppercase ${
							isPaused
								? "bg-amber-100 text-amber-700"
								: "bg-emerald-100 text-emerald-700"
						}`}
					>
						{isPaused ? "Paused" : "In Focus"}
					</Badge>

					<p
						className={`mt-4 font-mono text-5xl font-bold tabular-nums sm:text-6xl ${
							isExpired
								? "text-red-500"
								: isPaused
									? "text-amber-600"
									: "text-slate-950"
						}`}
					>
						{formattedTime}
					</p>

					<p className="mt-2 text-sm text-slate-600">
						{isExpired ? "Time's up!" : isPaused ? "Paused" : "Focused"}
					</p>

					<Progress value={progress} className="mt-4 h-2 w-full max-w-md" />

					<div className="mt-6 flex w-full flex-wrap items-center justify-center gap-3">
						<div className="flex items-center gap-1.5">
							<Button
								variant="outline"
								size="lg"
								className="w-full sm:w-auto"
								onClick={handlePauseResume}
								disabled={pauseSession.isPending || resumeSession.isPending}
							>
								{isPaused ? (
									<>
										<Play className="mr-2 h-4 w-4" />
										Resume
									</>
								) : (
									<>
										<Pause className="mr-2 h-4 w-4" />
										Pause
									</>
								)}
							</Button>
							<HelpTooltip
								feature="Pause / Resume"
								what="Temporarily stops or restarts the active timer."
								use="Pause when interrupted, then resume to continue the same session."
								works="Updates session state without closing it, preserving elapsed time and notes."
							/>
						</div>
						<div className="flex items-center gap-1.5">
							<Button
								variant="destructive"
								size="lg"
								className="w-full sm:w-auto"
								onClick={() => setCompleteOpen(true)}
							>
								<Square className="mr-2 h-4 w-4" />
								End Session
							</Button>
							<HelpTooltip
								feature="End Session"
								what="Completes the current focus block and asks for an outcome."
								use="Click at the end of a pomodoro to record progress and choose next action."
								works="Finalizes duration, captures outcome, and can trigger next-task suggestions."
							/>
						</div>
						<Button variant="ghost" size="lg" className="w-full sm:w-auto" asChild>
							<Link to="/tasks/$taskId" params={{ taskId: session.taskId }}>
								Open Task
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card className="border-slate-200 bg-white">
				<CardContent className="pt-6">
					<div className="mb-2 flex items-center gap-1.5">
						<label className="block text-sm font-medium text-slate-800">
							Scratchpad
						</label>
						<HelpTooltip
							feature="Scratchpad"
							what="Lightweight notes area for thoughts captured during focus."
							use="Write clues, links, blockers, or decisions while working."
							works="Debounced autosave syncs text to the active session in near real time."
						/>
					</div>
					<Textarea
						placeholder="Jot down notes, links, ideas while you work..."
						className="min-h-[140px] border-slate-300 bg-white"
						value={scratchpad}
						onChange={(e) => handleScratchpadChange(e.target.value)}
					/>
					<p className="mt-1 text-xs text-slate-500">Auto-saves as you type</p>
				</CardContent>
			</Card>

			{completeOpen && (
				<CompleteSessionDialog
					session={session}
					open={completeOpen}
					onOpenChange={setCompleteOpen}
					onCompleted={(nextTask) => {
						if (nextTask) {
							toast.info(`Suggested next: ${nextTask.title}`);
						}
					}}
				/>
			)}
		</div>
	);
}
