import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { goeyToast as toast } from "goey-toast";
import {
	Bot,
	BrainCircuit,
	FileStack,
	Layers3,
	Loader2,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import {
	RouteHeroBadge,
	RouteHeroHeader,
} from "@/components/shared/route-hero-header";
import { useAIProviders, useTaskRecommendation } from "@/hooks/use-ai";
import { useIdeas } from "@/hooks/use-ideas";
import {
	usePMAIAnalyzeImages,
	usePMAIAnalyzeVideo,
	usePMAIApproveDocumentPlan,
	usePMAIDecomposeTask,
	usePMAIIngestDocument,
	usePMAIIngestDocumentUpload,
	usePMAIPlanSprint,
	usePMAIRebalanceSprint,
	usePMAISuggestAssignee,
	useTaskPriorityClearOverride,
	useTaskPriorityExplain,
	useTaskPriorityOverride,
	useTaskPriorityRecalculate,
} from "@/hooks/use-pm-ai";
import { useCreateProject, useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { ApiClientError } from "@/lib/api";
import { runWithPromiseToast } from "@/lib/toast";
import type { ProjectType } from "@/lib/types";

const AiSearchParams = z.object({
	tab: z
		.enum(["overview", "planner", "generation", "planning", "priority"])
		.default("overview"),
});

export const Route = createFileRoute("/ai")({
	component: AIRoute,
	validateSearch: AiSearchParams,
});

function parseCsvList(value: string) {
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function prettyJson(value: unknown) {
	return JSON.stringify(value, null, 2);
}

function generateCreativeProjectName(
	documentTitle: string,
	documentType: "tsd" | "prd" | "contract" | "feature_spec",
) {
	const cleaned = documentTitle
		.replace(/\.[a-z0-9]+$/i, "")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	const base = cleaned || "Untitled Initiative";
	const prefix =
		documentType === "tsd"
			? "Blueprint"
			: documentType === "prd"
				? "Launchpad"
				: documentType === "contract"
					? "Pact"
					: "Catalyst";
	const suffix = new Date().toLocaleDateString("en-GB", {
		month: "short",
		year: "2-digit",
	});
	return `${prefix}: ${base} (${suffix})`;
}

interface PMAIDraftPlanOutput {
	analysisId: string;
	documentType: "tsd" | "prd" | "contract" | "feature_spec";
	documentTitle: string;
	usageMode: "individual" | "team";
	generation?: {
		provider?: string | null;
		model?: string | null;
	};
	phases: unknown[];
	milestones: unknown[];
	summary: string;
	constraints: string[];
	deliverables: string[];
	risks: string[];
	confidence: number;
}

function OutputCard({
	lastAction,
	lastOutput,
}: {
	lastAction: string;
	lastOutput: unknown;
}) {
	return (
		<Card className="border-border bg-card">
			<CardHeader>
				<CardTitle className="inline-flex items-center gap-2 text-base">
					Last AI Output
					<HelpTooltip
						feature="AI Output Panel"
						what="Shows the raw response from the most recent AI action."
						use="Review payload shape and content before taking downstream actions."
						works="Stores the latest mutation result in local state and renders formatted JSON."
					/>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="mb-2 text-xs text-muted-foreground">{lastAction}</p>
				<pre className="no-scrollbar max-h-[28rem] overflow-auto rounded-lg border border-border bg-primary p-3 text-xs text-primary-foreground">
					{lastOutput
						? prettyJson(lastOutput)
						: "Run an action to inspect output"}
				</pre>
			</CardContent>
		</Card>
	);
}

function AIRoute() {
	const navigate = Route.useNavigate();
	const { tab = "overview" } = Route.useSearch();
	const { data: providers, isLoading: providersLoading } = useAIProviders();
	const { data: recommendation, isLoading: recommendationLoading } =
		useTaskRecommendation();
	const { data: projects = [] } = useProjects();
	const { data: taskListData } = useTasks({ limit: 100 });
	const { data: ideaListData } = useIdeas({ limit: 100 });
	const taskOptions = taskListData?.tasks ?? [];
	const ideaOptions = ideaListData?.ideas ?? [];

	const ingestDocument = usePMAIIngestDocument();
	const ingestDocumentUpload = usePMAIIngestDocumentUpload();
	const approveDocumentPlan = usePMAIApproveDocumentPlan();
	const analyzeVideo = usePMAIAnalyzeVideo();
	const analyzeImages = usePMAIAnalyzeImages();
	const decomposeTask = usePMAIDecomposeTask();
	const suggestAssignee = usePMAISuggestAssignee();
	const planSprint = usePMAIPlanSprint();
	const rebalanceSprint = usePMAIRebalanceSprint();
	const createProject = useCreateProject();
	const explainPriority = useTaskPriorityExplain();
	const overridePriority = useTaskPriorityOverride();
	const clearPriority = useTaskPriorityClearOverride();
	const recalculatePriorities = useTaskPriorityRecalculate();

	const [activeTab, setActiveTab] = useState<
		"overview" | "planner" | "generation" | "planning" | "priority"
	>(tab ?? "overview");

	const [documentType, setDocumentType] = useState<
		"tsd" | "prd" | "contract" | "feature_spec"
	>("tsd");
	const [usageMode, setUsageMode] = useState<"individual" | "team">(
		"individual",
	);
	const [documentTitle, setDocumentTitle] = useState("");
	const [documentText, setDocumentText] = useState("");
	const [documentFile, setDocumentFile] = useState<File | null>(null);
	const [documentProjectId, setDocumentProjectId] = useState("none");
	const [documentIdeaTaskId, setDocumentIdeaTaskId] = useState("none");
	const [documentTeamIds, setDocumentTeamIds] = useState("");
	const [documentFeedbackInstructions, setDocumentFeedbackInstructions] =
		useState("");
	const [documentCreateTasks, setDocumentCreateTasks] = useState(true);
	const [documentCreateMilestones, setDocumentCreateMilestones] =
		useState(true);
	const [documentSelectedMilestones, setDocumentSelectedMilestones] =
		useState("");
	const [createProjectPromptOpen, setCreateProjectPromptOpen] = useState(false);
	const [draftProjectName, setDraftProjectName] = useState("");
	const [draftProjectType, setDraftProjectType] = useState<ProjectType>("Core");

	const [videoSource, setVideoSource] = useState<
		"jam.dev" | "loom" | "upload" | "youtube"
	>("loom");
	const [videoUrl, setVideoUrl] = useState("");
	const [videoContext, setVideoContext] = useState("");

	const [imageRequestType, setImageRequestType] = useState<"feature" | "bug">(
		"feature",
	);
	const [imageUrl, setImageUrl] = useState("");
	const [imageContext, setImageContext] = useState("");

	const [decomposeTaskId, setDecomposeTaskId] = useState("none");
	const [decomposeStrategy, setDecomposeStrategy] = useState<
		"auto" | "architectural" | "feature" | "sequential"
	>("auto");

	const [suggestSkills, setSuggestSkills] = useState(
		"React,TypeScript,API Design",
	);
	const [suggestTeamIds, setSuggestTeamIds] = useState("");

	const [sprintId, setSprintId] = useState("sprint_current");
	const [sprintWeeks, setSprintWeeks] = useState(2);
	const [sprintTeamIds, setSprintTeamIds] = useState("");
	const [backlogTaskIds, setBacklogTaskIds] = useState<string[]>([]);
	const [backlogTaskCandidate, setBacklogTaskCandidate] = useState("none");

	const [rebalanceSprintId, setRebalanceSprintId] = useState("sprint_current");
	const [rebalanceCurrentDay, setRebalanceCurrentDay] = useState(6);
	const [rebalanceProgressJson, setRebalanceProgressJson] = useState(
		`[{"userId":"","completedSessions":0,"expectedSessions":0,"remainingTasks":[]}]`,
	);

	const [priorityTaskId, setPriorityTaskId] = useState("none");
	const [priorityMode, setPriorityMode] = useState<
		"promote" | "demote" | "set"
	>("promote");
	const [priorityScore, setPriorityScore] = useState(90);
	const [priorityReason, setPriorityReason] = useState("");

	const [lastAction, setLastAction] = useState("No action yet");
	const [lastOutput, setLastOutput] = useState<unknown>(null);
	const [documentDraft, setDocumentDraft] =
		useState<PMAIDraftPlanOutput | null>(null);
	const ideaTaskOptions = ideaOptions;

	const providerBadges = useMemo(
		() => providers?.enabledProviders ?? [],
		[providers?.enabledProviders],
	);

	async function runAction(
		action: string,
		runner: () => Promise<unknown>,
		options?: {
			successMessage?: string;
			successAction?: {
				label: string;
				onClick: () => void;
				successLabel?: string;
			};
		},
	) {
		const result = await runWithPromiseToast(action, runner, {
			successMessage: options?.successMessage ?? `${action} completed`,
			errorMessage: (error) => {
				if (error instanceof ApiClientError) {
					if (error.status === 503 && error.code === "SERVICE_UNAVAILABLE") {
						let nested:
							| { errors?: Array<{ provider?: string; message?: string }> }
							| undefined;
						if (error.details) {
							try {
								const parsed = JSON.parse(error.details) as
									| {
											details?: {
												errors?: Array<{
													provider?: string;
													message?: string;
												}>;
											};
											errors?: Array<{
												provider?: string;
												message?: string;
											}>;
									  }
									| undefined;
								nested = parsed?.details ?? parsed;
							} catch {
								nested = undefined;
							}
						}
						const first = nested?.errors?.[0];
						const provider = first?.provider?.toUpperCase() ?? "AI provider";
						const providerMessage = first?.message ?? error.message;
						return `${provider} failed: ${providerMessage}. Retry now. Check API key, network, and configured model.`;
					}
					return error.message;
				}
				return error instanceof Error ? error.message : "Unknown error";
			},
		});
		setLastAction(action);
		setLastOutput(result);
		if (options?.successAction) {
			toast.success(options.successMessage ?? `${action} completed`, {
				action: options.successAction,
			});
		}
	}

	async function generateDocumentDraftFromText() {
		const result = (await ingestDocument.mutateAsync({
			documentType,
			title: documentTitle || undefined,
			documentText,
			feedbackInstructions: documentFeedbackInstructions || undefined,
			projectId: documentProjectId === "none" ? undefined : documentProjectId,
			ideaTaskId:
				documentIdeaTaskId === "none" ? undefined : documentIdeaTaskId,
			usageMode,
			teamMemberIds: parseCsvList(documentTeamIds),
			createTasks: false,
			createMilestones: false,
			selectedMilestoneTitles: parseCsvList(documentSelectedMilestones),
		})) as PMAIDraftPlanOutput;
		setDocumentDraft(result);
		return result;
	}

	async function generateDocumentDraftFromUpload() {
		if (!documentFile) {
			throw new Error("Select a document file first");
		}
		const result = (await ingestDocumentUpload.mutateAsync({
			file: documentFile,
			documentType,
			title: documentTitle || undefined,
			feedbackInstructions: documentFeedbackInstructions || undefined,
			projectId: documentProjectId === "none" ? undefined : documentProjectId,
			ideaTaskId:
				documentIdeaTaskId === "none" ? undefined : documentIdeaTaskId,
			usageMode,
			teamMemberIds: parseCsvList(documentTeamIds),
			createTasks: false,
			createMilestones: false,
			selectedMilestoneTitles: parseCsvList(documentSelectedMilestones),
		})) as PMAIDraftPlanOutput;
		setDocumentDraft(result);
		return result;
	}

	async function approveDraft(projectId?: string) {
		if (!documentDraft) {
			throw new Error("Generate and review a draft before approval.");
		}
		return approveDocumentPlan.mutateAsync({
			analysisId: documentDraft.analysisId,
			documentType: documentDraft.documentType,
			documentTitle: documentDraft.documentTitle,
			projectId,
			ideaTaskId:
				documentIdeaTaskId === "none" ? undefined : documentIdeaTaskId,
			usageMode,
			teamMemberIds: parseCsvList(documentTeamIds),
			createTasks: documentCreateTasks,
			createMilestones: documentCreateMilestones,
			selectedMilestoneTitles: parseCsvList(documentSelectedMilestones),
			generation: documentDraft.generation,
			plan: {
				summary: documentDraft.summary,
				constraints: documentDraft.constraints,
				deliverables: documentDraft.deliverables,
				risks: documentDraft.risks,
				phases: documentDraft.phases,
				milestones: documentDraft.milestones,
				confidence: documentDraft.confidence,
			},
		});
	}

	async function handleApproveDraft() {
		if (!documentDraft) {
			throw new Error("Generate and review a draft before approval.");
		}
		const selectedProjectId =
			documentProjectId === "none" ? undefined : documentProjectId;
		const needsDestinationProject =
			(documentCreateTasks || documentCreateMilestones) && !selectedProjectId;

		if (needsDestinationProject) {
			setDraftProjectName(
				generateCreativeProjectName(
					documentDraft.documentTitle,
					documentDraft.documentType,
				),
			);
			setDraftProjectType("Core");
			setCreateProjectPromptOpen(true);
			return;
		}

		await runAction(
			"PM AI approve document draft",
			() => approveDraft(selectedProjectId),
			{
				successMessage: "Draft approved and persisted to database.",
			},
		);
	}

	async function handleCreateProjectAndApprove() {
		if (!documentDraft) {
			throw new Error("Generate and review a draft before approval.");
		}
		const createdProject = (await runWithPromiseToast(
			"Create destination project",
			() =>
				createProject.mutateAsync({
					name: draftProjectName.trim(),
					type: draftProjectType,
					description: `Generated from ${documentDraft.documentType.toUpperCase()} planning draft.`,
				}),
		)) as { id: string };

		setDocumentProjectId(createdProject.id);
		setCreateProjectPromptOpen(false);
		await runAction(
			"PM AI approve document draft",
			() => approveDraft(createdProject.id),
			{
				successMessage: "Draft approved and persisted to database.",
				successAction: {
					label: "View project",
					onClick: () =>
						navigate({
							to: "/projects/$projectId",
							params: { projectId: createdProject.id },
						}),
				},
			},
		);
	}

	function addBacklogTask(taskId: string) {
		if (taskId === "none") return;
		setBacklogTaskIds((previous) =>
			previous.includes(taskId) ? previous : [...previous, taskId],
		);
		setBacklogTaskCandidate("none");
	}

	function removeBacklogTask(taskId: string) {
		setBacklogTaskIds((previous) => previous.filter((id) => id !== taskId));
	}

	return (
		<div className="space-y-6">
			<RouteHeroHeader
				eyebrow="Execution Flow"
				title="AI Command Center"
				description="Operate routing, PM workflows, sprint planning, and priority controls from one structured surface."
				help={{
					feature: "AI Command Center",
					what: "Control panel for AI routing, planning, issue generation, and prioritization.",
					use: "Pick a tab, run an action, and inspect the output panel before applying decisions.",
					works:
						"Calls PM-AI endpoints with provider fallback across OpenAI, Claude, and Ollama.",
				}}
				badges={
					<>
						<RouteHeroBadge variant="default">
							{providers?.routingMode ?? "-"} routing
						</RouteHeroBadge>
						{providerBadges.map((provider) => (
							<RouteHeroBadge key={provider} className="capitalize">
								{provider}
							</RouteHeroBadge>
						))}
					</>
				}
			/>

			<Tabs
				defaultValue={tab}
				value={activeTab}
				onValueChange={(value) => setActiveTab(value as typeof activeTab)}
			>
				<div className="no-scrollbar overflow-x-auto pb-1">
					<TabsList className="inline-flex w-max min-w-full sm:min-w-0">
						<TabsTrigger
							onClick={() =>
								navigate({
									to: ".",
									search: {
										tab: "overview",
									},
								})
							}
							value="overview"
							className="whitespace-nowrap"
						>
							Overview
						</TabsTrigger>
						<TabsTrigger
							onClick={() =>
								navigate({
									to: ".",
									search: {
										tab: "planner",
									},
								})
							}
							value="planner"
							className="whitespace-nowrap"
						>
							Document Planner
						</TabsTrigger>
						<TabsTrigger
							onClick={() =>
								navigate({
									to: ".",
									search: {
										tab: "generation",
									},
								})
							}
							value="generation"
							className="whitespace-nowrap"
						>
							Issue Generation
						</TabsTrigger>
						<TabsTrigger
							onClick={() =>
								navigate({
									to: ".",
									search: {
										tab: "planning",
									},
								})
							}
							value="planning"
							className="whitespace-nowrap"
						>
							Planning
						</TabsTrigger>
						<TabsTrigger
							onClick={() =>
								navigate({
									to: ".",
									search: {
										tab: "priority",
									},
								})
							}
							value="priority"
							className="whitespace-nowrap"
						>
							Priority
						</TabsTrigger>
					</TabsList>
				</div>

				<TabsContent value="overview" className="mt-4">
					<div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
						<Card className="border-border bg-card">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<BrainCircuit className="h-4 w-4" />
									Routing + Recommendation
									<HelpTooltip
										feature="Routing + Recommendation"
										what="Shows active model routing strategy and current task recommendation."
										use="Confirm provider order and recommendation confidence before execution."
										works="Combines deterministic scoring with provider-based reasoning for next-task selection."
									/>
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3 text-sm">
								{providersLoading || recommendationLoading ? (
									<div className="space-y-3">
										<Skeleton className="h-4 w-40" />
										<Skeleton className="h-4 w-56" />
										<div className="rounded-lg border border-border bg-muted/40 p-3">
											<Skeleton className="h-4 w-44" />
											<Skeleton className="mt-2 h-5 w-3/4" />
											<Skeleton className="mt-2 h-3.5 w-2/3" />
										</div>
									</div>
								) : (
									<>
										<p className="text-muted-foreground">
											Routing mode:{" "}
											<span className="font-medium">
												{providers?.routingMode ?? "-"}
											</span>
										</p>
										<p className="text-muted-foreground">
											Provider order:{" "}
											<span className="font-medium">
												{providers?.providerOrder?.join(" -> ") ?? "-"}
											</span>
										</p>
										<div className="rounded-lg border border-border bg-muted/40 p-3">
											<p className="font-medium text-foreground">
												Current Recommendation
											</p>
											<p className="mt-1 text-muted-foreground">
												{recommendation?.recommendedTask?.task.title ??
													"No recommended task"}
											</p>
											<p className="mt-1 text-xs text-muted-foreground">
												Strategy: {recommendation?.strategy ?? "-"} | Provider:{" "}
												{recommendation?.provider ?? "rules"} | Confidence:{" "}
												{recommendation?.confidence ?? "n/a"}
											</p>
										</div>
									</>
								)}
							</CardContent>
						</Card>
						<OutputCard lastAction={lastAction} lastOutput={lastOutput} />
					</div>
				</TabsContent>

				<TabsContent value="planner" className="mt-4">
					<div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
						<Card className="border-border bg-card">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<FileStack className="h-4 w-4" />
									TSD / PRD / Contract Planner
									<HelpTooltip
										feature="Document Planner"
										what="Turns TSDs, PRDs, and contracts into structured tasks."
										use="Paste text or upload a file, then generate tasks for individual or team mode."
										works="Parses document intent, extracts deliverables, and emits task-ready plans."
									/>
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="space-y-1.5">
										<Label>Document Type</Label>
										<Select
											value={documentType}
											onValueChange={(value) =>
												setDocumentType(value as typeof documentType)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="tsd">TSD</SelectItem>
												<SelectItem value="prd">PRD</SelectItem>
												<SelectItem value="contract">Contract</SelectItem>
												<SelectItem value="feature_spec">
													Feature Spec
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-1.5">
										<Label>Usage Mode</Label>
										<Select
											value={usageMode}
											onValueChange={(value) =>
												setUsageMode(value as typeof usageMode)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="individual">Individual</SelectItem>
												<SelectItem value="team">Team</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
								<Input
									value={documentTitle}
									onChange={(event) => setDocumentTitle(event.target.value)}
									placeholder="Document title"
								/>
								<div className="space-y-1.5">
									<Label>Project (optional)</Label>
									<Select
										value={documentProjectId}
										onValueChange={setDocumentProjectId}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select project" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">No project</SelectItem>
											{projects.map((project) => (
												<SelectItem key={project.id} value={project.id}>
													{project.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5">
									<Label>Linked Idea (optional)</Label>
									<Select
										value={documentIdeaTaskId}
										onValueChange={setDocumentIdeaTaskId}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select idea task" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">No linked idea</SelectItem>
											{ideaTaskOptions.map((task) => (
												<SelectItem key={task.id} value={task.id}>
													{task.title}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<Input
									value={documentTeamIds}
									onChange={(event) => setDocumentTeamIds(event.target.value)}
									placeholder="Team member IDs (comma-separated, optional)"
								/>
								<div className="grid gap-3 sm:grid-cols-2">
									<label className="flex items-center gap-2 text-sm text-muted-foreground">
										<input
											type="checkbox"
											checked={documentCreateTasks}
											onChange={(event) =>
												setDocumentCreateTasks(event.target.checked)
											}
										/>
										Create tasks on approval
									</label>
									<label className="flex items-center gap-2 text-sm text-muted-foreground">
										<input
											type="checkbox"
											checked={documentCreateMilestones}
											onChange={(event) =>
												setDocumentCreateMilestones(event.target.checked)
											}
										/>
										Create milestones on approval
									</label>
								</div>
								<Input
									value={documentSelectedMilestones}
									onChange={(event) =>
										setDocumentSelectedMilestones(event.target.value)
									}
									placeholder="Selected milestone titles (comma-separated, optional)"
								/>
								<Textarea
									value={documentFeedbackInstructions}
									onChange={(event) =>
										setDocumentFeedbackInstructions(event.target.value)
									}
									rows={3}
									placeholder="Review instructions for AI (optional): what to improve before approval"
								/>
								<Textarea
									value={documentText}
									onChange={(event) => setDocumentText(event.target.value)}
									rows={6}
									placeholder="Paste TSD/PRD/contract text here"
								/>
								{documentDraft ? (
									<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
										Draft ready: {documentDraft.analysisId} |{" "}
										{documentDraft.phases.length} phases |{" "}
										{documentDraft.milestones.length} milestones. Review output,
										then click approve to persist.
									</div>
								) : null}
								<div className="flex flex-col gap-2">
									<div className="flex items-center gap-x-2">
										<Button
											onClick={() =>
												runAction(
													"PM AI generate document draft (text)",
													() => generateDocumentDraftFromText(),
													{
														successMessage:
															"Draft generated. Review output before approval.",
													},
												)
											}
											disabled={
												!documentText.trim() || ingestDocument.isPending
											}
										>
											{ingestDocument.isPending ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<Sparkles className="mr-2 h-4 w-4" />
											)}
											Generate Draft (Text)
										</Button>
										<HelpTooltip
											feature="Generate from Text"
											what="Creates task plans from pasted document text."
											use="Paste clean markdown/content and run to get a structured breakdown."
											works="Sends plain text payload to the PM-AI ingest pipeline."
										/>
									</div>
									<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
										<Input
											type="file"
											onChange={(event) =>
												setDocumentFile(event.target.files?.[0] ?? null)
											}
											className="w-full sm:max-w-sm"
										/>
										<Button
											variant="outline"
											onClick={() =>
												runAction(
													"PM AI generate document draft (upload)",
													() => generateDocumentDraftFromUpload(),
													{
														successMessage:
															"Draft generated. Review output before approval.",
													},
												)
											}
											disabled={!documentFile || ingestDocumentUpload.isPending}
										>
											{ingestDocumentUpload.isPending ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : null}
											Upload + Draft
										</Button>
										<HelpTooltip
											feature="Upload + Generate"
											what="Creates task plans from uploaded docs."
											use="Upload a text-rich document when copy/paste is not practical."
											works="Runs server-side extraction first, then routes extracted text through planner prompts."
										/>
									</div>
									<div className="flex items-center gap-2">
										<Button
											variant="default"
											onClick={() => handleApproveDraft()}
											disabled={!documentDraft || approveDocumentPlan.isPending}
										>
											{approveDocumentPlan.isPending ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : null}
											Approve Draft & Create
										</Button>
										<p className="text-xs text-muted-foreground">
											No tasks or milestones are persisted until approval. Plan
											size is inferred from the document.
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
						<OutputCard lastAction={lastAction} lastOutput={lastOutput} />
					</div>
					<Dialog
						open={createProjectPromptOpen}
						onOpenChange={setCreateProjectPromptOpen}
					>
						<DialogContent className="sm:max-w-lg">
							<DialogHeader>
								<DialogTitle>Create Destination Project</DialogTitle>
								<DialogDescription>
									Choose where approved tasks and milestones should be created.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-3">
								<div className="space-y-1.5">
									<Label>Project name</Label>
									<Input
										value={draftProjectName}
										onChange={(event) =>
											setDraftProjectName(event.target.value)
										}
										placeholder="Project name"
									/>
								</div>
								<div className="space-y-1.5">
									<Label>Project type</Label>
									<Select
										value={draftProjectType}
										onValueChange={(value) =>
											setDraftProjectType(value as ProjectType)
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="Clients">Clients</SelectItem>
											<SelectItem value="Core">Core</SelectItem>
											<SelectItem value="InHouse">InHouse</SelectItem>
											<SelectItem value="Office">Office</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setCreateProjectPromptOpen(false)}
								>
									Cancel
								</Button>
								<Button
									onClick={() => handleCreateProjectAndApprove()}
									disabled={
										!draftProjectName.trim() ||
										createProject.isPending ||
										approveDocumentPlan.isPending
									}
								>
									{createProject.isPending || approveDocumentPlan.isPending ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : null}
									Create project and approve
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</TabsContent>

				<TabsContent value="generation" className="mt-4">
					<div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
						<div className="space-y-4">
							<Card className="border-border bg-card">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-base">
										<Bot className="h-4 w-4" />
										Video to Bug Report
										<HelpTooltip
											feature="Video to Bug"
											what="Converts recorded walkthroughs into structured bug reports."
											use="Select source, add URL/context, then analyze."
											works="Extracts issue cues from media context and formats them into actionable task output."
										/>
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="grid gap-2 sm:grid-cols-2">
										<Select
											value={videoSource}
											onValueChange={(value) =>
												setVideoSource(value as typeof videoSource)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="jam.dev">Jam.dev</SelectItem>
												<SelectItem value="loom">Loom</SelectItem>
												<SelectItem value="upload">Upload</SelectItem>
												<SelectItem value="youtube">YouTube</SelectItem>
											</SelectContent>
										</Select>
										<Input
											value={videoUrl}
											onChange={(event) => setVideoUrl(event.target.value)}
											placeholder="Video URL"
										/>
									</div>
									<Textarea
										rows={3}
										value={videoContext}
										onChange={(event) => setVideoContext(event.target.value)}
										placeholder="Additional context"
									/>
									<Button
										size="sm"
										onClick={() =>
											runAction("PM AI analyze video", () =>
												analyzeVideo.mutateAsync({
													videoSource,
													videoUrl: videoUrl || null,
													additionalContext: videoContext || undefined,
												}),
											)
										}
										disabled={!videoUrl && !videoContext}
									>
										Analyze Video
									</Button>
									<HelpTooltip
										feature="Analyze Video"
										what="Runs AI analysis on the supplied video evidence."
										use="Add URL or context and run to generate a candidate issue report."
										works="Processes context fields and media source metadata through PM-AI issue prompts."
									/>
								</CardContent>
							</Card>

							<Card className="border-border bg-card">
								<CardHeader>
									<CardTitle className="inline-flex items-center gap-2 text-base">
										Images to Issue / Feature
										<HelpTooltip
											feature="Image Analysis"
											what="Turns screenshots into bug or feature briefs."
											use="Set request type, add image URL/context, then run analysis."
											works="Vision-capable model interprets UI evidence and writes structured proposals."
										/>
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="grid gap-2 sm:grid-cols-2">
										<Select
											value={imageRequestType}
											onValueChange={(value) =>
												setImageRequestType(value as typeof imageRequestType)
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="feature">Feature</SelectItem>
												<SelectItem value="bug">Bug</SelectItem>
											</SelectContent>
										</Select>
										<Input
											value={imageUrl}
											onChange={(event) => setImageUrl(event.target.value)}
											placeholder="Image URL"
										/>
									</div>
									<Textarea
										rows={3}
										value={imageContext}
										onChange={(event) => setImageContext(event.target.value)}
										placeholder="Context"
									/>
									<Button
										size="sm"
										onClick={() =>
											runAction("PM AI analyze images", () =>
												analyzeImages.mutateAsync({
													requestType: imageRequestType,
													context: imageContext || undefined,
													images: [{ source: "url", url: imageUrl || null }],
												}),
											)
										}
										disabled={!imageUrl}
									>
										Analyze Images
									</Button>
									<HelpTooltip
										feature="Analyze Images"
										what="Runs AI analysis on screenshot evidence."
										use="Provide image URL and context to generate bug or feature outputs."
										works="Builds a multi-modal prompt with image references and request intent."
									/>
								</CardContent>
							</Card>
						</div>
						<OutputCard lastAction={lastAction} lastOutput={lastOutput} />
					</div>
				</TabsContent>

				<TabsContent value="planning" className="mt-4">
					<div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
						<Card className="border-border bg-card">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<Layers3 className="h-4 w-4" />
									Planning + Assignment
									<HelpTooltip
										feature="Planning + Assignment"
										what="Tools for decomposition, assignment, sprint planning, and rebalance."
										use="Run each planner block with valid IDs and inspect output before applying."
										works="Coordinates PM-AI planning endpoints around team capacity and task metadata."
									/>
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2 rounded-lg border border-border p-3">
									<p className="inline-flex items-center gap-1.5 text-sm font-medium">
										Decompose Task
										<HelpTooltip
											feature="Decompose Task"
											what="Breaks one large task into smaller executable subtasks."
											use="Provide a task id and strategy, then run decomposition."
											works="Uses planning prompts to infer milestones, dependencies, and order."
										/>
									</p>
									<Select
										value={decomposeTaskId}
										onValueChange={setDecomposeTaskId}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select task" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">Select task</SelectItem>
											{taskOptions.map((task) => (
												<SelectItem key={task.id} value={task.id}>
													{task.title}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select
										value={decomposeStrategy}
										onValueChange={(value) =>
											setDecomposeStrategy(value as typeof decomposeStrategy)
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="auto">Auto</SelectItem>
											<SelectItem value="architectural">
												Architectural
											</SelectItem>
											<SelectItem value="feature">Feature</SelectItem>
											<SelectItem value="sequential">Sequential</SelectItem>
										</SelectContent>
									</Select>
									<Button
										size="sm"
										onClick={() =>
											runAction(
												"PM AI decompose task",
												() =>
													decomposeTask.mutateAsync({
														taskId: decomposeTaskId,
														decompositionStrategy: decomposeStrategy,
													}),
												{
													successMessage: "Decomposition requested",
													successAction: {
														label: "View task & subtasks",
														successLabel: "Opening...",
														onClick: () =>
															navigate({
																to: "/tasks/$taskId",
																params: { taskId: decomposeTaskId },
															}),
													},
												},
											)
										}
										disabled={decomposeTaskId === "none"}
									>
										Decompose
									</Button>
									<HelpTooltip
										feature="Run Decomposition"
										what="Executes AI task breakdown for the selected task."
										use="Run after setting task id and strategy."
										works="Calls decomposition endpoint and returns structured subtask suggestions."
									/>
								</div>

								<div className="space-y-2 rounded-lg border border-border p-3">
									<p className="inline-flex items-center gap-1.5 text-sm font-medium">
										Suggest Assignee
										<HelpTooltip
											feature="Suggest Assignee"
											what="Recommends who should own work based on skills and availability context."
											use="List required skills and optional team ids, then run suggest."
											works="Matches skill requirements to provided team profiles and planning signals."
										/>
									</p>
									<Input
										value={suggestSkills}
										onChange={(event) => setSuggestSkills(event.target.value)}
										placeholder="Skills (comma-separated)"
									/>
									<Input
										value={suggestTeamIds}
										onChange={(event) => setSuggestTeamIds(event.target.value)}
										placeholder="Team IDs (comma-separated, optional)"
									/>
									<Button
										size="sm"
										onClick={() =>
											runAction("PM AI suggest assignee", () =>
												suggestAssignee.mutateAsync({
													requiredSkills: parseCsvList(suggestSkills),
													teamMemberIds: parseCsvList(suggestTeamIds),
												}),
											)
										}
									>
										Suggest
									</Button>
									<HelpTooltip
										feature="Run Suggestion"
										what="Executes AI owner recommendation for current skill criteria."
										use="Use when deciding task ownership."
										works="Returns ranked assignee candidates with rationale."
									/>
								</div>

								<div className="space-y-2 rounded-lg border border-border p-3">
									<p className="inline-flex items-center gap-1.5 text-sm font-medium">
										Plan Sprint
										<HelpTooltip
											feature="Plan Sprint"
											what="Builds a sprint plan from backlog and team capacity."
											use="Set sprint id, duration, team ids, and candidate task ids."
											works="Optimizes completion goals using available time and dependency constraints."
										/>
									</p>
									<Input
										value={sprintId}
										onChange={(event) => setSprintId(event.target.value)}
										placeholder="Sprint ID"
									/>
									<Input
										type="number"
										min={1}
										max={8}
										value={sprintWeeks}
										onChange={(event) =>
											setSprintWeeks(Number(event.target.value || 2))
										}
										placeholder="Duration weeks"
									/>
									<Input
										value={sprintTeamIds}
										onChange={(event) => setSprintTeamIds(event.target.value)}
										placeholder="Team IDs (comma-separated)"
									/>
									<div className="flex flex-col gap-2 sm:flex-row">
										<Select
											value={backlogTaskCandidate}
											onValueChange={setBacklogTaskCandidate}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select backlog task" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">
													Select backlog task
												</SelectItem>
												{taskOptions.map((task) => (
													<SelectItem key={task.id} value={task.id}>
														{task.title}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<Button
											type="button"
											variant="outline"
											onClick={() => addBacklogTask(backlogTaskCandidate)}
											disabled={backlogTaskCandidate === "none"}
										>
											Add Task
										</Button>
									</div>
									{backlogTaskIds.length > 0 && (
										<div className="flex flex-wrap gap-2">
											{backlogTaskIds.map((taskId) => {
												const task = taskOptions.find(
													(entry) => entry.id === taskId,
												);
												return (
													<Button
														key={taskId}
														type="button"
														size="sm"
														variant="secondary"
														onClick={() => removeBacklogTask(taskId)}
														className="h-7"
													>
														{task?.title ?? taskId} x
													</Button>
												);
											})}
										</div>
									)}
									<Button
										size="sm"
										onClick={() =>
											runAction("PM AI plan sprint", () =>
												planSprint.mutateAsync({
													sprintId,
													durationWeeks: sprintWeeks,
													teamMemberIds: parseCsvList(sprintTeamIds),
													backlogTaskIds,
													goalType: "max_completion",
												}),
											)
										}
										disabled={backlogTaskIds.length === 0}
									>
										Plan Sprint
									</Button>
									<HelpTooltip
										feature="Run Sprint Plan"
										what="Executes AI sprint scheduling."
										use="Run after entering scope and team ids."
										works="Outputs a completion-oriented sprint allocation."
									/>
								</div>

								<div className="space-y-2 rounded-lg border border-border p-3">
									<p className="inline-flex items-center gap-1.5 text-sm font-medium">
										Rebalance Sprint
										<HelpTooltip
											feature="Rebalance Sprint"
											what="Adjusts sprint allocations mid-cycle using actual progress."
											use="Pass current day and progress JSON to get a revised plan."
											works="Compares expected vs actual throughput and proposes redistribution."
										/>
									</p>
									<Input
										value={rebalanceSprintId}
										onChange={(event) =>
											setRebalanceSprintId(event.target.value)
										}
										placeholder="Sprint ID"
									/>
									<Input
										type="number"
										min={1}
										max={60}
										value={rebalanceCurrentDay}
										onChange={(event) =>
											setRebalanceCurrentDay(Number(event.target.value || 6))
										}
										placeholder="Current day"
									/>
									<Textarea
										rows={3}
										value={rebalanceProgressJson}
										onChange={(event) =>
											setRebalanceProgressJson(event.target.value)
										}
										placeholder="Progress JSON array"
									/>
									<Button
										size="sm"
										onClick={() =>
											runAction("PM AI rebalance sprint", async () => {
												const progressData = JSON.parse(
													rebalanceProgressJson,
												) as Array<{
													userId: string;
													completedSessions: number;
													expectedSessions: number;
													remainingTasks: string[];
												}>;
												return rebalanceSprint.mutateAsync({
													sprintId: rebalanceSprintId,
													currentDay: rebalanceCurrentDay,
													progressData,
												});
											})
										}
									>
										Rebalance
									</Button>
									<HelpTooltip
										feature="Run Rebalance"
										what="Executes mid-sprint correction planning."
										use="Run when progress diverges from the initial sprint plan."
										works="Returns redistributed assignments based on current completion data."
									/>
								</div>
							</CardContent>
						</Card>
						<OutputCard lastAction={lastAction} lastOutput={lastOutput} />
					</div>
				</TabsContent>

				<TabsContent value="priority" className="mt-4">
					<div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
						<Card className="border-border bg-card">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<ShieldCheck className="h-4 w-4" />
									Task Priority Controls
									<HelpTooltip
										feature="Priority Controls"
										what="Explain, override, clear, or recalculate AI priority scoring."
										use="Select a task id for targeted actions or recalc all for global refresh."
										works="Applies deterministic + AI priority logic, with manual overrides when needed."
									/>
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<Select
									value={priorityTaskId}
									onValueChange={setPriorityTaskId}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select task" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Select task</SelectItem>
										{taskOptions.map((task) => (
											<SelectItem key={task.id} value={task.id}>
												{task.title}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<div className="flex flex-wrap gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											runAction("Explain task priority", () =>
												explainPriority.mutateAsync(priorityTaskId),
											)
										}
										disabled={priorityTaskId === "none"}
									>
										Explain
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											runAction("Clear priority override", () =>
												clearPriority.mutateAsync(priorityTaskId),
											)
										}
										disabled={priorityTaskId === "none"}
									>
										Clear Override
									</Button>
									<Button
										size="sm"
										onClick={() =>
											runAction("Recalculate priorities", () =>
												recalculatePriorities.mutateAsync(),
											)
										}
									>
										Recalculate All
									</Button>
									<HelpTooltip
										feature="Priority Actions"
										what="Controls immediate and global priority management."
										use="Explain for diagnostics, clear to remove manual overrides, recalculate to refresh queue order."
										works="Uses per-task override state plus global scoring recalculation."
									/>
								</div>
								<div className="grid gap-2 sm:grid-cols-3">
									<Select
										value={priorityMode}
										onValueChange={(value) =>
											setPriorityMode(value as typeof priorityMode)
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="promote">Promote</SelectItem>
											<SelectItem value="demote">Demote</SelectItem>
											<SelectItem value="set">Set</SelectItem>
										</SelectContent>
									</Select>
									<Input
										type="number"
										min={0}
										max={100}
										value={priorityScore}
										onChange={(event) =>
											setPriorityScore(Number(event.target.value || 0))
										}
										placeholder="Score"
									/>
									<Button
										size="sm"
										onClick={() =>
											runAction("Override priority", () =>
												overridePriority.mutateAsync({
													taskId: priorityTaskId,
													data: {
														mode: priorityMode,
														score:
															priorityMode === "set"
																? priorityScore
																: undefined,
														reason: priorityReason || undefined,
													},
												}),
											)
										}
										disabled={priorityTaskId === "none"}
									>
										Apply
									</Button>
								</div>
								<Textarea
									rows={2}
									value={priorityReason}
									onChange={(event) => setPriorityReason(event.target.value)}
									placeholder="Override reason"
								/>
							</CardContent>
						</Card>
						<OutputCard lastAction={lastAction} lastOutput={lastOutput} />
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
