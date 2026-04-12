import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Progress } from "@repo/ui/components/ui/progress";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Input } from "@repo/ui/components/ui/input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { goeyToast as toast } from "goey-toast";
import {
	ArrowRight,
	ClipboardCopy,
	Pause,
	Play,
	Square,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CompleteSessionDialog } from "@/components/sessions/complete-session-dialog";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import { useSessionSounds } from "@/hooks/use-session-sounds";
import { useSessionTimer } from "@/hooks/use-session-timer";
import {
	useExtendSession,
	usePauseSession,
	useResumeSession,
	useSession,
	useUpdateScratchpad,
} from "@/hooks/use-sessions";
import { useUpdateTask } from "@/hooks/use-tasks";
import { generateBranchName } from "@/lib/constants";
import type { Session, Task } from "@/lib/types";

export const Route = createFileRoute("/sessions/$sessionId")({
	component: SessionDetailPage,
});

function copyBranchName(task: Task) {
	const branch = generateBranchName(task);
	navigator.clipboard.writeText(branch);
	toast.success(`Copied: ${branch}`);
	return branch;
}

function SessionDetailPage() {
	const { sessionId } = Route.useParams();
	const { data: session, isLoading } = useSession(sessionId);
	const navigate = useNavigate();

	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Spinner size="lg" />
			</div>
		);
	}

	if (!session) {
		return (
			<div className="space-y-6">
				<Card>
					<CardContent className="space-y-4 p-6">
						<p className="text-sm text-muted-foreground">
							The session id may be invalid or belong to another user.
						</p>
						<Button asChild>
							<Link to="/sessions/history">Open session history</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (session.state === "Completed" || session.state === "Abandoned") {
		return (
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Session Ended</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-sm text-muted-foreground">
							This focus session is already {session.state.toLowerCase()}.
						</p>
						<div className="flex flex-wrap gap-2">
							<Button onClick={() => navigate({ to: "/sessions/history" })}>
								Go to session history
							</Button>
							{session.taskId ? (
								<Button
									variant="outline"
									onClick={() =>
										navigate({
											to: "/tasks/$taskId",
											params: { taskId: session.taskId },
										})
									}
								>
									Open task
								</Button>
							) : null}
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return <ActiveSessionView session={session} />;
}

function ActiveSessionView({ session }: { session: Session }) {
	const navigate = useNavigate();
	const { formattedTime, progress, isExpired } = useSessionTimer(session);
	const pauseSession = usePauseSession();
	const resumeSession = useResumeSession();
	const extendSession = useExtendSession();
	const updateScratchpad = useUpdateScratchpad();
	const updateTask = useUpdateTask();
	const {
		primeSessionAudio,
		playSessionPause,
		playSessionResume,
		playSessionError,
	} = useSessionSounds();

	const [scratchpad, setScratchpad] = useState(session.scratchpad ?? "");
	const [completeOpen, setCompleteOpen] = useState(false);
	const [isEditingTime, setIsEditingTime] = useState(false);
	const [customTimeInput, setCustomTimeInput] = useState("");
	const initialized = useRef(false);
	const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null);

	useEffect(() => {
		if (!initialized.current && session.scratchpad != null) {
			setScratchpad(session.scratchpad);
			initialized.current = true;
		}
	}, [session.scratchpad]);

	const debouncedSave = useCallback(
		(value: string) => {
			if (debounceTimer.current) clearTimeout(debounceTimer.current);
			debounceTimer.current = setTimeout(() => {
				updateScratchpad.mutate({ id: session.id, content: value });
			}, 500);
		},
		[session.id, updateScratchpad],
	);

	function handleScratchpadChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
		const value = e.target.value;
		setScratchpad(value);
		debouncedSave(value);
	}

	const isPaused = session.state === "Paused";
	const task = session.task;

	function parseDurationToMinutes(raw: string) {
		const input = raw.trim();
		if (!input) return null;

		if (/^\d+$/.test(input)) {
			const minutes = Number.parseInt(input, 10);
			return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
		}

		const colonParts = input.split(":").map((part) => part.trim());
		if (
			colonParts.length >= 2 &&
			colonParts.length <= 3 &&
			colonParts.every((part) => /^\d+$/.test(part))
		) {
			const [h, m, s] =
				colonParts.length === 3
					? [
							Number.parseInt(colonParts[0] ?? "0", 10),
							Number.parseInt(colonParts[1] ?? "0", 10),
							Number.parseInt(colonParts[2] ?? "0", 10),
						]
					: [
							0,
							Number.parseInt(colonParts[0] ?? "0", 10),
							Number.parseInt(colonParts[1] ?? "0", 10),
						];
			const totalSeconds = h * 3600 + m * 60 + s;
			if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
			return Math.ceil(totalSeconds / 60);
		}

		return null;
	}

	async function extendByMinutesFlexible(totalRequestedMinutes: number) {
		let remaining = totalRequestedMinutes;
		const chunks: number[] = [];

		while (remaining > 0) {
			if (remaining <= 120) {
				chunks.push(remaining);
				break;
			}
			let chunk = 120;
			const nextRemaining = remaining - chunk;
			if (nextRemaining > 0 && nextRemaining < 5) {
				chunk = remaining - 5;
			}
			chunks.push(chunk);
			remaining -= chunk;
		}

		for (const minutes of chunks) {
			await extendSession.mutateAsync({
				id: session.id,
				data: { minutes },
			});
		}
	}

	async function applyCustomTimeInput() {
		const parsed = parseDurationToMinutes(customTimeInput);
		if (!parsed) {
			toast.error("Invalid time. Use minutes (e.g. 25) or hh:mm:ss.");
			return;
		}

		const minutes = Math.max(5, parsed);
		if (parsed < 5) {
			toast.info("Minimum extension is 5 minutes. Rounded up to 5.");
		}

		try {
			await primeSessionAudio();
			await extendByMinutesFlexible(minutes);
			playSessionResume();
			setIsEditingTime(false);
			setCustomTimeInput("");
			toast.success(`Session extended by ${minutes} minute${minutes === 1 ? "" : "s"}`);
		} catch {
			playSessionError();
			toast.error("Failed to extend session");
		}
	}

	function handleCopyBranchInSession(taskToUpdate: Task) {
		copyBranchName(taskToUpdate);
		if (taskToUpdate.state === "Active") {
			updateTask.mutate({ id: taskToUpdate.id, data: { state: "Ready" } });
			toast.info("Task moved to Ready");
		}
	}

	return (
		<div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
			<div aria-hidden className="pointer-events-none absolute inset-0">
				<div className="absolute left-10 top-10 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
				<div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
			</div>

			<div className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-10">
				<Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl shadow-black/30">
					<CardContent className="space-y-6 p-6 sm:p-8">
						<div className="space-y-4 text-center">
							<Badge
								variant="secondary"
								className="rounded-full bg-slate-800 px-3 py-1 text-[11px] tracking-[0.14em] text-slate-300 uppercase"
							>
								Focus Mode
							</Badge>
							{isEditingTime ? (
								<div className="mx-auto max-w-sm space-y-2">
									<Input
										autoFocus
										value={customTimeInput}
										onChange={(event) => setCustomTimeInput(event.target.value)}
										placeholder="25 or 01:15:30"
										className="h-12 border-slate-700 bg-slate-900 text-center font-mono text-lg text-slate-100 placeholder:text-slate-500"
										onKeyDown={(event) => {
											if (event.key === "Enter") {
												event.preventDefault();
												void applyCustomTimeInput();
											}
											if (event.key === "Escape") {
												setIsEditingTime(false);
												setCustomTimeInput("");
											}
										}}
									/>
									<div className="flex items-center justify-center gap-2">
										<Button
											size="sm"
											onClick={() => void applyCustomTimeInput()}
											disabled={extendSession.isPending}
										>
											Apply time
										</Button>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => {
												setIsEditingTime(false);
												setCustomTimeInput("");
											}}
										>
											Cancel
										</Button>
									</div>
									<p className="text-xs text-slate-400">
										Type minutes or <code>hh:mm:ss</code>. Plain numbers are
										treated as minutes.
									</p>
								</div>
							) : (
								<button
									type="button"
									className={`text-6xl font-mono font-bold tracking-tight tabular-nums transition-colors sm:text-8xl ${isExpired ? "text-red-400" : "text-slate-50 hover:text-cyan-300"}`}
									onClick={() => {
										setCustomTimeInput("15");
										setIsEditingTime(true);
									}}
									title="Click to add custom time (minutes or hh:mm:ss)"
								>
									{formattedTime}
								</button>
							)}
							<Progress value={progress} className="h-2 bg-slate-800" />
							{isPaused && (
								<Badge
									variant="secondary"
									className="bg-amber-950 text-amber-300"
								>
									Paused
								</Badge>
							)}
						</div>

						{task && (
							<div className="text-center">
								<p className="text-lg font-semibold text-slate-100">
									{task.title}
								</p>
								<div className="mt-1 flex items-center justify-center gap-2 text-sm text-slate-400">
									{task.project && <span>{task.project.name}</span>}
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
										onClick={() => handleCopyBranchInSession(task)}
										title="Copy git branch name"
									>
										<ClipboardCopy className="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>
						)}

						<div className="flex flex-wrap items-center justify-center gap-3">
							<Button
								size="lg"
								variant="outline"
								className="w-full gap-2 border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 sm:w-auto"
								onClick={async () => {
									await primeSessionAudio();
									extendSession.mutate(
										{
											id: session.id,
											data: { minutes: 15 },
										},
										{
											onSuccess: () => playSessionResume(),
											onError: () => playSessionError(),
										},
									);
								}}
								disabled={extendSession.isPending || isPaused}
							>
								<Zap className="size-4" />
								{extendSession.isPending ? "Adding..." : "Add 15 min"}
							</Button>
							{isPaused ? (
								<Button
									size="lg"
									variant="outline"
									className="w-full gap-2 border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 sm:w-auto"
									onClick={async () => {
										await primeSessionAudio();
										resumeSession.mutate(session.id, {
											onSuccess: () => playSessionResume(),
											onError: () => playSessionError(),
										});
									}}
									disabled={resumeSession.isPending}
								>
									<Play className="size-4" />
									Resume
								</Button>
							) : (
								<Button
									size="lg"
									variant="outline"
									className="w-full gap-2 border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 sm:w-auto"
									onClick={async () => {
										await primeSessionAudio();
										pauseSession.mutate(session.id, {
											onSuccess: () => playSessionPause(),
											onError: () => playSessionError(),
										});
									}}
									disabled={pauseSession.isPending}
								>
									<Pause className="size-4" />
									Pause
								</Button>
							)}
							<Button
								size="lg"
								variant="ghost"
								className="w-full gap-2 text-slate-300 hover:bg-slate-800 hover:text-slate-100 sm:w-auto"
								onClick={() => navigate({ to: "/" })}
								disabled={!isPaused}
								title={
									isPaused
										? "Exit focus mode"
										: "Pause session before exiting focus mode"
								}
							>
								<ArrowRight className="size-4" />
								Exit Focus Mode
							</Button>
							<Button
								size="lg"
								className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-500 sm:w-auto"
								onClick={() => {
									setCompleteOpen(true);
								}}
							>
								<Square className="size-4" />
								Complete Task
							</Button>
							<Button
								size="lg"
								variant="destructive"
								className="w-full gap-2 sm:w-auto"
								onClick={() => setCompleteOpen(true)}
							>
								<Square className="size-4" />
								End Session
							</Button>
						</div>
						{!isPaused ? (
							<p className="text-center text-xs text-slate-400">
								Pause this session to exit focus mode.
							</p>
						) : null}
					</CardContent>
				</Card>

				<Card className="border-slate-800 bg-slate-900/85 text-slate-100">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-slate-300">
							Scratchpad
							<HelpTooltip
								feature="Scratchpad"
								what="Temporary notes area during an active session."
								use="Capture progress, blockers, and useful links while working."
								works="Autosaves note updates to the active session record."
							/>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<Textarea
							placeholder="Notes, thoughts, progress..."
							className="min-h-45 resize-none border-0 bg-transparent p-0 text-slate-100 placeholder:text-slate-500 shadow-none focus-visible:ring-0"
							value={scratchpad}
							onChange={handleScratchpadChange}
						/>
					</CardContent>
				</Card>
			</div>

			<CompleteSessionDialog
				session={session}
				open={completeOpen}
				onOpenChange={setCompleteOpen}
				onCompleted={(nextTask) => {
					if (nextTask) {
						toast.info(`Next up: ${nextTask.title}`);
						navigate({
							to: "/tasks/$taskId",
							params: { taskId: nextTask.id },
						});
						return;
					}
					navigate({ to: "/sessions/history" });
				}}
			/>
		</div>
	);
}
