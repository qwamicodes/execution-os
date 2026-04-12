import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeftRight,
	Bot,
	ChevronRight,
	Clock3,
	Copy,
	FolderPlus,
	Lightbulb,
	RefreshCw,
	Sparkles,
	Trash2,
} from "lucide-react";
import { goeyToast as toast } from "goey-toast";
import { useEffect, useState } from "react";
import {
	useClassifyIdeaAI,
	useConvertIdeaToProject,
	useConvertIdeaToTask,
	useDeleteIdea,
	useIdea,
	useUpdateIdea,
} from "@/hooks/use-ideas";
import type { IdeaState } from "@/lib/types";

export const Route = createFileRoute("/ideas/$ideaId")({
	component: IdeaDetailPage,
});

const IDEA_STATES: IdeaState[] = [
	"Captured",
	"Classified",
	"Clarified",
	"Planned",
	"Incubating",
	"Archived",
];

function formatDateTime(value: string | null | undefined) {
	if (!value) return "-";
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return "-";
	return parsed.toLocaleString();
}

function buildFallbackInterviewPrompt(title: string, description: string | null) {
	return [
		"You are my product discovery partner for this project.",
		"",
		"Use my existing project instructions in this chat/workspace as the primary source of truth.",
		"The idea below is delta context, not a full spec.",
		"",
		`Idea: ${title}`,
		`Idea context: ${description ?? "No additional context provided."}`,
		"",
		"Interview me until you have at least 95% confidence about what should be built.",
		"Ask 3-5 high-impact clarifying questions per round.",
		"After each round provide confidence, knowns, unknowns, assumptions, and risks.",
		"When confidence is high enough, output PRD-ready scope, TSD constraints, milestones, and first implementation slice.",
	].join("\n");
}

function IdeaDetailPage() {
	const { ideaId } = Route.useParams();
	const navigate = useNavigate();
	const { data: idea, isLoading } = useIdea(ideaId);
	const updateIdea = useUpdateIdea();
	const deleteIdea = useDeleteIdea();
	const convertIdeaToTask = useConvertIdeaToTask();
	const convertIdeaToProject = useConvertIdeaToProject();
	const classifyIdeaAI = useClassifyIdeaAI();
	const [selectedState, setSelectedState] = useState<IdeaState>("Captured");

	useEffect(() => {
		if (idea?.state) {
			setSelectedState(idea.state);
		}
	}, [idea?.state]);

	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Spinner size="lg" />
			</div>
		);
	}

	if (!idea) {
		return (
			<div className="flex h-64 items-center justify-center">
				<p className="text-muted-foreground">Idea not found</p>
			</div>
		);
	}

	const currentIdea = idea;
	const aiClassification =
		typeof currentIdea.sourceMetadata === "object" &&
		currentIdea.sourceMetadata !== null &&
		"aiClassification" in currentIdea.sourceMetadata
			? (currentIdea.sourceMetadata.aiClassification as
					| Record<string, unknown>
					| undefined)
			: undefined;
	const interviewPrompt =
		typeof currentIdea.sourceMetadata === "object" &&
		currentIdea.sourceMetadata !== null &&
		"agentInterviewPrompt" in currentIdea.sourceMetadata
			? String(currentIdea.sourceMetadata.agentInterviewPrompt ?? "")
			: buildFallbackInterviewPrompt(currentIdea.title, currentIdea.description);

	const activeIndex = IDEA_STATES.indexOf(currentIdea.state);
	const stateProgress = IDEA_STATES.map((state, index) => ({
		state,
		active: state === currentIdea.state,
		complete: activeIndex >= 0 && index <= activeIndex,
	}));

	function handleStateChange(nextState: IdeaState) {
		const prevState = selectedState;
		setSelectedState(nextState);
		updateIdea.mutate(
			{ id: currentIdea.id, data: { state: nextState } },
			{
				onSuccess: () => {
					toast.success("Idea state updated", {
						description: `${prevState} -> ${nextState}`,
					});
				},
				onError: (error) => {
					setSelectedState(prevState);
					toast.error(error.message);
				},
			},
		);
	}

	function handleDelete() {
		deleteIdea.mutate(currentIdea.id, {
			onSuccess: () => {
				toast.success("Idea deleted");
				navigate({ to: "/ideas" });
			},
			onError: (error) => toast.error(error.message),
		});
	}

	function handleConvertToTask() {
		convertIdeaToTask.mutate(currentIdea.id, {
			onSuccess: (result) => {
				toast.success("Idea converted to task", {
					description: `Created task: ${result.task.title}`,
				});
				navigate({ to: "/tasks/$taskId", params: { taskId: result.task.id } });
			},
			onError: (error) => toast.error(error.message),
		});
	}

	function handleConvertToProject() {
		convertIdeaToProject.mutate(currentIdea.id, {
			onSuccess: (result) => {
				toast.success("Idea converted to project", {
					description: `Created project: ${result.project.name}`,
				});
				navigate({ to: "/projects/$projectId", params: { projectId: result.project.id } });
			},
			onError: (error) => toast.error(error.message),
		});
	}

	function handleClassifyAndClarify() {
		classifyIdeaAI.mutate(currentIdea.id, {
			onSuccess: () => {
				toast.success("Idea AI pipeline completed", {
					description: "Classified and clarified with updated copy.",
				});
			},
			onError: (error) => toast.error(error.message),
		});
	}

	return (
		<div className="space-y-6">
			<nav className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
				<Link to="/ideas" className="font-medium hover:text-foreground">
					Ideas
				</Link>
				<ChevronRight className="size-3" />
				<span className="max-w-60 truncate text-foreground">{currentIdea.title}</span>
			</nav>

			<Card className="overflow-hidden border-border/80 bg-linear-to-br from-background to-muted/30">
				<CardHeader className="space-y-4">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="min-w-0 flex-1 space-y-2">
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline" className="border-sky-400/40 text-sky-600 dark:text-sky-300">
									<Lightbulb className="mr-1 h-3.5 w-3.5" />
									Idea Detail
								</Badge>
								<Badge variant="secondary">{currentIdea.state}</Badge>
								{currentIdea.size ? <Badge variant="outline">{currentIdea.size}</Badge> : null}
								{currentIdea.urgency ? <Badge variant="outline">{currentIdea.urgency}</Badge> : null}
							</div>
							<CardTitle className="text-2xl sm:text-3xl">{currentIdea.title}</CardTitle>
							<p className="text-sm leading-relaxed text-muted-foreground">
								{currentIdea.description || "No description yet."}
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<Button variant="outline" onClick={handleClassifyAndClarify} disabled={classifyIdeaAI.isPending}>
								<Bot className="mr-2 h-4 w-4" />
								{classifyIdeaAI.isPending ? "Processing..." : "AI classify & clarify"}
							</Button>
							<Button variant="outline" onClick={handleConvertToProject} disabled={convertIdeaToProject.isPending}>
								<FolderPlus className="mr-2 h-4 w-4" />
								Convert to project
							</Button>
							<Button variant="outline" onClick={handleConvertToTask} disabled={convertIdeaToTask.isPending}>
								<ArrowLeftRight className="mr-2 h-4 w-4" />
								Convert to task
							</Button>
							<Button variant="outline" className="text-destructive" onClick={handleDelete} disabled={deleteIdea.isPending}>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</Button>
						</div>
					</div>
				</CardHeader>
			</Card>

			<div className="grid gap-6 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader className="space-y-4">
						<CardTitle className="text-base">Lifecycle</CardTitle>
						<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
							{stateProgress.map((item) => (
								<div
									key={item.state}
									className={`rounded-lg border px-3 py-2 text-sm ${item.active ? "border-sky-400/50 bg-sky-50/70 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200" : item.complete ? "border-emerald-300/40 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-border text-muted-foreground"}`}
								>
									{item.state}
								</div>
							))}
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="max-w-sm space-y-2">
							<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
								Set state
							</p>
							<Select
								value={selectedState}
								onValueChange={(value) => handleStateChange(value as IdeaState)}
								disabled={updateIdea.isPending}
							>
								<SelectTrigger>
									<SelectValue placeholder="State" />
								</SelectTrigger>
								<SelectContent>
									{IDEA_STATES.map((state) => (
										<SelectItem key={state} value={state}>
											{state}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{updateIdea.isPending ? (
								<p className="text-xs text-muted-foreground">Updating state...</p>
							) : null}
						</div>

						<div className="rounded-lg border border-border bg-muted/25 p-4">
							<div className="mb-2 flex items-center justify-between gap-2">
								<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
									Agent Interview Prompt
								</p>
								<Button
									size="sm"
									variant="outline"
									onClick={async () => {
										await navigator.clipboard.writeText(interviewPrompt);
										toast.success("Prompt copied");
									}}
								>
									<Copy className="mr-2 h-4 w-4" />
									Copy
								</Button>
							</div>
							<p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
								{interviewPrompt}
							</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Idea Signals</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Source</span>
							<span className="font-medium">{currentIdea.source}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Deadline</span>
							<span className="font-medium">{formatDateTime(currentIdea.deadline)}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Created</span>
							<span className="font-medium">{formatDateTime(currentIdea.createdAt)}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Updated</span>
							<span className="font-medium">{formatDateTime(currentIdea.updatedAt)}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="inline-flex items-center gap-1 text-muted-foreground">
								<Sparkles className="h-3.5 w-3.5" />
								AI confidence
							</span>
							<span className="font-medium">
								{typeof aiClassification?.confidence === "number"
									? `${Math.round(aiClassification.confidence * 100)}%`
									: "-"}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="inline-flex items-center gap-1 text-muted-foreground">
								<RefreshCw className="h-3.5 w-3.5" />
								AI status
							</span>
							<span className="font-medium">
								{typeof aiClassification?.status === "string"
									? aiClassification.status
									: "not-run"}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="inline-flex items-center gap-1 text-muted-foreground">
								<Clock3 className="h-3.5 w-3.5" />
								AI updated
							</span>
							<span className="font-medium">
								{formatDateTime(
									typeof aiClassification?.clarifiedAt === "string"
										? aiClassification.clarifiedAt
										: typeof aiClassification?.classifiedAt === "string"
											? aiClassification.classifiedAt
											: null,
								)}
							</span>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
