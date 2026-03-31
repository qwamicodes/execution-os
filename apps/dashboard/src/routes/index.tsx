import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Progress } from "@repo/ui/components/ui/progress";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ClipboardCopy,
	Inbox,
	LayoutDashboard,
	Lightbulb,
	Pause,
	Play,
	Plus,
	Sparkles,
	Square,
	Zap,
} from "lucide-react";
import {
	type CSSProperties,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { goeyToast as toast } from "goey-toast";
import { CompleteSessionDialog } from "@/components/sessions/complete-session-dialog";
import { StartSessionDialog } from "@/components/sessions/start-session-dialog";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { useTaskRecommendation } from "@/hooks/use-ai";
import { useInbox } from "@/hooks/use-inbox";
import { useSessionTimer } from "@/hooks/use-session-timer";
import {
	useActiveSession,
	usePauseSession,
	useResumeSession,
	useUpdateScratchpad,
} from "@/hooks/use-sessions";
import { useTasks } from "@/hooks/use-tasks";
import { generateBranchName, TASK_SIZE_CONFIG } from "@/lib/constants";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/")({
	component: DashboardPage,
});

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

function getDateLabel(): string {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
	}).format(new Date());
}

function copyBranchName(task: Task) {
	const branch = generateBranchName(task);
	navigator.clipboard.writeText(branch);
	toast.success(`Copied: ${branch}`);
}

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
	);
}

function DashboardPage() {
	const { user } = Route.useRouteContext();
	const { data: activeSession } = useActiveSession();

	const firstName = user.name.split(" ")[0] ?? user.name;

	if (activeSession) {
		return <ActiveSessionView session={activeSession} />;
	}

	return <IdleView name={firstName} />;
}

function IdleView({ name }: { name: string }) {
	const navigate = useNavigate();
	const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [ideaDialogOpen, setIdeaDialogOpen] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);

	const { data: inboxData, isLoading: inboxLoading } = useInbox();
	const { data: recommendationData, isLoading: recommendationLoading } =
		useTaskRecommendation();
	const { data: readyData, isLoading: readyLoading } = useTasks({
		state: "Ready",
		sortBy: "priority",
		sortOrder: "desc",
		limit: 12,
	});
	const isRecommendationLoading = recommendationLoading || readyLoading;

	const inboxCount = inboxData?.meta?.total ?? 0;
	const readyTasks = readyData?.tasks ?? [];
	const recommendedTaskId =
		recommendationData?.recommendedTask?.task.id ?? null;
	const topTask = recommendedTaskId
		? (readyTasks.find((task) => task.id === recommendedTaskId) ??
			readyTasks[0] ??
			null)
		: (readyTasks[0] ?? null);

	const topTaskReason = recommendationData?.recommendedTask?.reason ?? null;
	const nextTaskIds =
		recommendationData?.nextTasks.map((entry) => entry.task.id) ?? [];
	const topTaskBranch = topTask ? generateBranchName(topTask) : null;

	const upNext = (() => {
		const withoutTop = topTask
			? readyTasks.filter((task) => task.id !== topTask.id)
			: readyTasks;

		if (nextTaskIds.length === 0) {
			return withoutTop.slice(0, 3);
		}

		const ranked = nextTaskIds
			.map((id) => withoutTop.find((task) => task.id === id))
			.filter((task): task is Task => Boolean(task));
		const remainder = withoutTop.filter(
			(task) => !ranked.some((rankedTask) => rankedTask.id === task.id),
		);
		return [...ranked, ...remainder].slice(0, 3);
	})();

	useEffect(() => {
		const frame = requestAnimationFrame(() => setIsLoaded(true));
		return () => cancelAnimationFrame(frame);
	}, []);

	return (
		<div className="relative min-h-screen overflow-hidden bg-[#f7f7f5]">
			<div aria-hidden className="pointer-events-none absolute inset-0">
				<div className="absolute -left-20 top-16 h-80 w-80 rounded-full bg-[#dfe8ff]/55 blur-3xl" />
				<div className="absolute -right-16 bottom-6 h-72 w-72 rounded-full bg-[#d7f3ed]/60 blur-3xl" />
				<div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:28px_28px]" />
			</div>

			<div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
				<div className="flex items-center gap-1.5">
					<Button
						size="icon"
						variant="outline"
						className="h-11 w-11 rounded-2xl border-slate-300 bg-white/95 text-slate-800 shadow-sm backdrop-blur hover:bg-white"
						onClick={() => setCreateDialogOpen(true)}
						title="Add task"
					>
						<Plus className="size-4" />
					</Button>
					<HelpTooltip
						feature="Quick Add Task"
						what="Fast entry point to capture a new task."
						use="Use this when you want to quickly add work without leaving the dashboard."
						works="Opens the task creation modal from any idle dashboard state."
					/>
				</div>
			</div>

			<div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
				<div className="flex items-center gap-1.5">
					<Button
						size="icon"
						variant="outline"
						className="h-11 w-11 rounded-2xl border-slate-300 bg-white/95 text-slate-800 shadow-sm backdrop-blur hover:bg-white"
						onClick={() => navigate({ to: "/inbox" })}
						title="Open full workspace"
					>
						<LayoutDashboard className="size-4" />
					</Button>
					<HelpTooltip
						feature="Workspace Shortcut"
						what="Jumps to the full task workspace view."
						use="Open this when you need full queue controls and multi-task operations."
						works="Navigates directly to `/tasks` with current app context intact."
					/>
				</div>
			</div>

			<div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-7 px-4 py-16 sm:px-8">
				<StaggerReveal visible={isLoaded} delayMs={40} className="w-full">
					<div className="text-center">
						<p className="text-[11px] font-medium tracking-[0.22em] text-slate-500 uppercase">
							Execution OS
						</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
							{getGreeting()}, {name}
						</h1>
						<p className="mt-2 text-sm text-slate-600">{getDateLabel()}</p>
					</div>
				</StaggerReveal>

				<StaggerReveal visible={isLoaded} delayMs={110} className="w-full">
					<Card className="mx-auto w-full max-w-3xl border-slate-200/90 bg-white/96 shadow-[0_24px_64px_-44px_rgba(15,23,42,0.45)] backdrop-blur">
						<CardHeader className="pb-2 text-center">
							<div className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-slate-600 uppercase">
								<Sparkles className="h-3.5 w-3.5 text-emerald-700" />
								AI Picked Task
								<HelpTooltip
									feature="AI Picked Task"
									what="Highest-priority task recommendation for your next focus block."
									use="Review the reason, then start a session or open details."
									works="Combines priority scoring and AI reasoning to rank ready tasks."
								/>
							</div>
						</CardHeader>
						<CardContent className="space-y-5 pb-6">
							{isRecommendationLoading ? (
								<div className="space-y-5 py-2">
									<div className="space-y-3 text-center">
										<Skeleton className="mx-auto h-8 w-3/4" />
										<div className="flex flex-wrap items-center justify-center gap-2">
											<Skeleton className="h-5 w-24 rounded-full" />
											<Skeleton className="h-5 w-20 rounded-full" />
										</div>
										<Skeleton className="mx-auto h-4 w-2/3" />
									</div>
									<Skeleton className="mx-auto h-11 w-full max-w-xl rounded-xl" />
									<div className="flex flex-wrap items-center justify-center gap-2">
										<Skeleton className="h-10 w-36 rounded-xl" />
										<Skeleton className="h-10 w-28 rounded-xl" />
										<Skeleton className="h-10 w-24 rounded-xl" />
									</div>
									<div className="flex flex-wrap items-center justify-center gap-2">
										<Skeleton className="h-7 w-40 rounded-full" />
										<Skeleton className="h-7 w-36 rounded-full" />
										<Skeleton className="h-7 w-32 rounded-full" />
									</div>
								</div>
							) : topTask ? (
								<>
									<div className="space-y-2 text-center">
										<p className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[30px]">
											{topTask.title}
										</p>
										<div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
											{topTask.project && (
												<Badge
													variant="secondary"
													className="bg-slate-100 text-slate-700"
												>
													{topTask.project.name}
												</Badge>
											)}
											{topTask.size && (
												<Badge variant="outline" className="border-slate-200">
													{TASK_SIZE_CONFIG[topTask.size].label}
												</Badge>
											)}
										</div>
										{topTaskReason && (
											<p className="mx-auto max-w-2xl text-sm text-slate-600">
												{topTaskReason}
											</p>
										)}
									</div>

									{topTaskBranch && (
										<div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
											<p className="truncate font-mono text-xs text-slate-700">
												{topTaskBranch}
											</p>
											<Button
												size="icon"
												variant="ghost"
												className="h-8 w-8 rounded-lg"
												onClick={() => copyBranchName(topTask)}
												title="Copy branch name"
											>
												<ClipboardCopy className="h-3.5 w-3.5" />
											</Button>
											<HelpTooltip
												feature="Branch Name"
												what="Suggested git branch name generated from task metadata."
												use="Copy and use as your branch when starting implementation."
												works="Builds a standardized branch slug from task attributes."
											/>
										</div>
									)}

									<div className="flex flex-wrap items-center justify-center gap-2 pt-1">
										<Button
											onClick={() => setSessionDialogOpen(true)}
											className="h-10 rounded-xl bg-slate-900 px-4 text-white hover:bg-slate-800"
										>
											<Zap className="mr-2 size-4" />
											Start Session
										</Button>
										<Button
											variant="outline"
											className="h-10 rounded-xl border-slate-300 px-4"
											onClick={() =>
												navigate({
													to: "/tasks/$taskId",
													params: { taskId: topTask.id },
												})
											}
										>
											Open Task
										</Button>
										<Button
											variant="outline"
											className="h-10 rounded-xl px-4 border-slate-300"
											onClick={() => navigate({ to: "/inbox" })}
										>
											<Inbox className="mr-2 size-4" />
											Inbox{" "}
											{!inboxLoading && inboxCount > 0 ? `(${inboxCount})` : ""}
										</Button>
										<Button
											variant="outline"
											className="h-10 rounded-xl border-slate-300 px-4"
											onClick={() => setCreateDialogOpen(true)}
										>
											<Plus className="mr-2 size-4" />
											Add Task
										</Button>
										<Button
											variant="outline"
											className="h-10 rounded-xl border-amber-300 bg-amber-50 px-4 text-amber-900 hover:bg-amber-100"
											onClick={() => setIdeaDialogOpen(true)}
										>
											<Lightbulb className="mr-2 size-4" />
											Log Idea
										</Button>
									</div>

									{upNext.length > 0 && (
										<div className="flex flex-wrap items-center justify-center gap-2 pt-1">
											{upNext.map((task) => (
												<button
													type="button"
													key={task.id}
													onClick={() =>
														navigate({
															to: "/tasks/$taskId",
															params: { taskId: task.id },
														})
													}
													className="max-w-57.5 truncate rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
												>
													{task.title}
												</button>
											))}
										</div>
									)}
								</>
							) : (
								<div className="space-y-3 py-6 text-center">
									<p className="text-lg font-semibold text-slate-900">
										All clear for now
									</p>
									<p className="text-sm text-slate-600">
										Add a new task or classify your inbox to get an AI focus
										pick.
									</p>
									<div className="flex items-center justify-center gap-2">
										<Button
											onClick={() => setCreateDialogOpen(true)}
											className="h-10 rounded-xl bg-slate-900 px-4 text-white hover:bg-slate-800"
										>
											<Plus className="mr-2 size-4" />
											Add Task
										</Button>
										<Button
											variant="outline"
											className="h-10 rounded-xl border-amber-300 bg-amber-50 px-4 text-amber-900 hover:bg-amber-100"
											onClick={() => setIdeaDialogOpen(true)}
										>
											<Lightbulb className="mr-2 size-4" />
											Log Idea
										</Button>
										<Button
											variant="outline"
											className="h-10 rounded-xl border-slate-300 px-4"
											onClick={() => navigate({ to: "/inbox" })}
										>
											Go to Inbox
										</Button>
									</div>
								</div>
							)}

							<div className="pt-1">
								<p className="mb-2 text-center text-[11px] font-medium tracking-[0.16em] text-slate-500 uppercase">
									Session Controls
								</p>
								<div className="mb-2 flex justify-center">
									<HelpTooltip
										feature="Session Controls"
										what="Quick controls for starting or managing focus sessions."
										use="Start focus from play; pause/stop become active during an active session."
										works="Links directly into the session lifecycle state machine."
									/>
								</div>
								<div className="flex items-center justify-center gap-3">
									<Button
										size="icon"
										variant="outline"
										className="h-11 w-11 rounded-2xl border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
										onClick={() => topTask && setSessionDialogOpen(true)}
										disabled={!topTask}
										title={
											topTask
												? "Start session for AI-picked task"
												: "Add a task to start a session"
										}
									>
										<Play className="size-4" />
									</Button>
									<Button
										size="icon"
										variant="outline"
										className="h-11 w-11 rounded-2xl border-slate-300 bg-white text-slate-700"
										disabled
										title="Pause is available while a session is active"
									>
										<Pause className="size-4" />
									</Button>
									<Button
										size="icon"
										variant="outline"
										className="h-11 w-11 rounded-2xl border-slate-300 bg-white text-slate-700"
										disabled
										title="Stop is available while a session is active"
									>
										<Square className="size-4" />
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				</StaggerReveal>
			</div>

			<CreateTaskDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
			/>
			<CreateTaskDialog
				open={ideaDialogOpen}
				onOpenChange={setIdeaDialogOpen}
				mode="idea"
				defaultTags={["idea", "idea/raw"]}
			/>

			{topTask && (
				<StartSessionDialog
					task={topTask}
					open={sessionDialogOpen}
					onOpenChange={setSessionDialogOpen}
				/>
			)}
		</div>
	);
}

function ActiveSessionView({
	session,
}: {
	session: NonNullable<ReturnType<typeof useActiveSession>["data"]>;
}) {
	const { formattedTime, progress, isExpired } = useSessionTimer(session);
	const pauseSession = usePauseSession();
	const resumeSession = useResumeSession();
	const updateScratchpad = useUpdateScratchpad();

	const [scratchpad, setScratchpad] = useState(session.scratchpad ?? "");
	const [completeOpen, setCompleteOpen] = useState(false);
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
							<p
								className={`text-6xl font-mono font-bold tracking-tight tabular-nums sm:text-8xl ${isExpired ? "text-red-400" : "text-slate-50"}`}
							>
								{formattedTime}
							</p>
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
										onClick={() => copyBranchName(task)}
										title="Copy git branch name"
									>
										<ClipboardCopy className="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>
						)}

						<div className="flex flex-wrap items-center justify-center gap-3">
							{isPaused ? (
								<Button
									size="lg"
									variant="outline"
									className="w-full gap-2 border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 sm:w-auto"
									onClick={() => resumeSession.mutate(session.id)}
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
									onClick={() => pauseSession.mutate(session.id)}
									disabled={pauseSession.isPending}
								>
									<Pause className="size-4" />
									Pause
								</Button>
							)}
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
							className="min-h-[180px] resize-none border-0 bg-transparent p-0 text-slate-100 placeholder:text-slate-500 shadow-none focus-visible:ring-0"
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
					}
				}}
			/>
		</div>
	);
}
