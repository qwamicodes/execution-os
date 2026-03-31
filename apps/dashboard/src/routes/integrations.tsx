import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { createFileRoute } from "@tanstack/react-router";
import {
	GitBranch,
	Mail,
	MessageSquare,
	Mic,
	PlugZap,
	Radar,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { goeyToast as toast } from "goey-toast";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import {
	RouteHeroBadge,
	RouteHeroHeader,
} from "@/components/shared/route-hero-header";
import {
	useConnectGitIntegration,
	useConnectGmailIntegration,
	useConnectLinearIntegration,
	useConnectSlackIntegration,
	useConnectVoiceIntegration,
	useDisconnectIntegration,
	useImportGitCommit,
	useIntegrations,
	useTranscribeVoice,
	useVoiceTranscriptionJob,
} from "@/hooks/use-integrations";
import { useCreateTaskBranch } from "@/hooks/use-tasks";
import type { GitProvider } from "@/lib/types";

export const Route = createFileRoute("/integrations")({
	component: IntegrationsRoute,
});

function IntegrationsRoute() {
	const { data: integrations = [] } = useIntegrations();
	const connectSlack = useConnectSlackIntegration();
	const connectGmail = useConnectGmailIntegration();
	const connectLinear = useConnectLinearIntegration();
	const connectGit = useConnectGitIntegration();
	const connectVoice = useConnectVoiceIntegration();
	const disconnect = useDisconnectIntegration();
	const importGitCommit = useImportGitCommit();
	const transcribeVoice = useTranscribeVoice();
	const createTaskBranch = useCreateTaskBranch();

	const [activeTab, setActiveTab] = useState("connections");

	const [linearApiKey, setLinearApiKey] = useState("");
	const [linearWorkspaceName, setLinearWorkspaceName] = useState("");

	const [gitProvider, setGitProvider] = useState<GitProvider>("github");
	const [gitRepositoryUrl, setGitRepositoryUrl] = useState("");
	const [gitAccessToken, setGitAccessToken] = useState("");
	const [gitDefaultBranch, setGitDefaultBranch] = useState("main");

	const [commitSha, setCommitSha] = useState("");
	const [commitMessage, setCommitMessage] = useState("");
	const [commitBranch, setCommitBranch] = useState("");
	const [commitUrl, setCommitUrl] = useState("");

	const [branchTaskId, setBranchTaskId] = useState("");
	const [branchName, setBranchName] = useState("");
	const [branchBase, setBranchBase] = useState("main");
	const [branchResult, setBranchResult] = useState<string | null>(null);

	const [voiceLanguage, setVoiceLanguage] = useState("en");
	const [voiceProvider, setVoiceProvider] = useState<
		"manual" | "openai_whisper"
	>("manual");
	const [voiceTitle, setVoiceTitle] = useState("");
	const [voiceTranscriptionText, setVoiceTranscriptionText] = useState("");
	const [voiceFile, setVoiceFile] = useState<File | null>(null);
	const [voiceJobId, setVoiceJobId] = useState<string | null>(null);

	const { data: voiceJob } = useVoiceTranscriptionJob(voiceJobId ?? undefined);

	const connectionState = useMemo(() => {
		const hasSlack = integrations.some(
			(record) => record.type === "Slack" && record.connected,
		);
		const hasGmail = integrations.some(
			(record) => record.type === "Gmail" && record.connected,
		);
		const hasLinear = integrations.some(
			(record) => record.type === "Linear" && record.connected,
		);
		const hasVoice = integrations.some(
			(record) => record.type === "Voice" && record.connected,
		);
		const hasGit = integrations.some(
			(record) =>
				["GitHub", "GitLab", "Bitbucket"].includes(record.type) &&
				record.connected,
		);

		return { hasSlack, hasGmail, hasLinear, hasVoice, hasGit };
	}, [integrations]);

	async function runAction(label: string, runner: () => Promise<unknown>) {
		try {
			await runner();
			toast.success(`${label} completed`);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Action failed";
			toast.error(message);
		}
	}

	return (
		<div className="space-y-6">
			<RouteHeroHeader
				eyebrow="Execution Flow"
				title="Integrations"
				description="Connect external tools, ingest work into inbox, and keep execution synchronized in real time."
				help={{
					feature: "Integrations",
					what: "Controls external connectors for intake and git/voice workflows.",
					use: "Connect providers first, then run import or transcription actions.",
					works:
						"Actions create inbox tasks and broadcast realtime updates to every active client.",
				}}
				badges={
					<>
						<RouteHeroBadge className="border-0 bg-slate-900 text-white">
							{integrations.length} configured
						</RouteHeroBadge>
						<RouteHeroBadge className="rounded-full bg-sky-100 text-sky-700">
							Slack · Gmail · Linear · Git · Voice
						</RouteHeroBadge>
					</>
				}
			/>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<div className="overflow-x-auto pb-1">
					<TabsList className="inline-flex w-max min-w-full sm:min-w-0">
						<TabsTrigger value="connections" className="whitespace-nowrap">
							Connections
						</TabsTrigger>
						<TabsTrigger value="git" className="whitespace-nowrap">
							Git
						</TabsTrigger>
						<TabsTrigger value="voice" className="whitespace-nowrap">
							Voice
						</TabsTrigger>
					</TabsList>
				</div>

				<TabsContent value="connections" className="mt-4 space-y-4">
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						<ProviderCard
							icon={MessageSquare}
							title="Slack"
							connected={connectionState.hasSlack}
							onConnect={() =>
								runAction("Slack connect", async () => {
									const data = await connectSlack.mutateAsync();
									window.location.href = data.authUrl;
								})
							}
							onDisconnect={() =>
								runAction("Slack disconnect", async () => {
									await disconnect.mutateAsync("slack");
								})
							}
						/>
						<ProviderCard
							icon={Mail}
							title="Gmail"
							connected={connectionState.hasGmail}
							onConnect={() =>
								runAction("Gmail connect", async () => {
									const data = await connectGmail.mutateAsync();
									window.location.href = data.authUrl;
								})
							}
							onDisconnect={() =>
								runAction("Gmail disconnect", async () => {
									await disconnect.mutateAsync("gmail");
								})
							}
						/>
						<ProviderCard
							icon={Radar}
							title="Linear"
							connected={connectionState.hasLinear}
							onConnect={() =>
								runAction("Linear connect", async () => {
									await connectLinear.mutateAsync({
										apiKey: linearApiKey,
										workspaceName: linearWorkspaceName || undefined,
									});
								})
							}
							onDisconnect={() =>
								runAction("Linear disconnect", async () => {
									await disconnect.mutateAsync("linear");
								})
							}
							fields={
								<>
									<Label className="text-xs text-slate-600">API key</Label>
									<Input
										type="password"
										value={linearApiKey}
										onChange={(event) => setLinearApiKey(event.target.value)}
									/>
									<Label className="text-xs text-slate-600">
										Workspace name
									</Label>
									<Input
										value={linearWorkspaceName}
										onChange={(event) =>
											setLinearWorkspaceName(event.target.value)
										}
									/>
								</>
							}
						/>
						<ProviderCard
							icon={GitBranch}
							title="Git"
							connected={connectionState.hasGit}
							onConnect={() => setActiveTab("git")}
							onDisconnect={() =>
								runAction("Git disconnect", async () => {
									await disconnect.mutateAsync("git");
								})
							}
						/>
						<ProviderCard
							icon={Mic}
							title="Voice"
							connected={connectionState.hasVoice}
							onConnect={() => setActiveTab("voice")}
							onDisconnect={() =>
								runAction("Voice disconnect", async () => {
									await disconnect.mutateAsync("voice");
								})
							}
						/>
					</div>
				</TabsContent>

				<TabsContent value="git" className="mt-4 space-y-4">
					<Card className="border-slate-200 bg-white">
						<CardHeader>
							<CardTitle className="inline-flex items-center gap-2 text-base">
								<PlugZap className="h-4 w-4" />
								Connect Repository
								<HelpTooltip
									feature="Git Connect"
									what="Connects GitHub/GitLab/Bitbucket for webhook-driven task intake."
									use="Set provider, repository URL, and token; then save connection."
									works="Stores integration config and returns a webhook endpoint per repository."
								/>
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3 md:grid-cols-2">
							<div className="space-y-1">
								<Label>Provider</Label>
								<Select
									value={gitProvider}
									onValueChange={(value) =>
										setGitProvider(value as GitProvider)
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="github">GitHub</SelectItem>
										<SelectItem value="gitlab">GitLab</SelectItem>
										<SelectItem value="bitbucket">Bitbucket</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1">
								<Label>Default branch</Label>
								<Input
									value={gitDefaultBranch}
									onChange={(event) => setGitDefaultBranch(event.target.value)}
								/>
							</div>
							<div className="space-y-1 md:col-span-2">
								<Label>Repository URL</Label>
								<Input
									value={gitRepositoryUrl}
									onChange={(event) => setGitRepositoryUrl(event.target.value)}
									placeholder="https://github.com/org/repo"
								/>
							</div>
							<div className="space-y-1 md:col-span-2">
								<Label>Access token</Label>
								<Input
									type="password"
									value={gitAccessToken}
									onChange={(event) => setGitAccessToken(event.target.value)}
								/>
							</div>
							<div className="md:col-span-2">
								<Button
									className="bg-slate-950 text-white hover:bg-slate-800"
									onClick={() =>
										runAction("Git connect", async () => {
											await connectGit.mutateAsync({
												provider: gitProvider,
												repositoryUrl: gitRepositoryUrl,
												accessToken: gitAccessToken,
												defaultBranch: gitDefaultBranch || undefined,
											});
										})
									}
								>
									Connect git integration
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card className="border-slate-200 bg-white">
						<CardHeader>
							<CardTitle className="inline-flex items-center gap-2 text-base">
								Import Commit as Task
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3 md:grid-cols-2">
							<div className="space-y-1">
								<Label>Commit SHA</Label>
								<Input
									value={commitSha}
									onChange={(event) => setCommitSha(event.target.value)}
								/>
							</div>
							<div className="space-y-1">
								<Label>Branch</Label>
								<Input
									value={commitBranch}
									onChange={(event) => setCommitBranch(event.target.value)}
								/>
							</div>
							<div className="space-y-1 md:col-span-2">
								<Label>Message</Label>
								<Textarea
									rows={3}
									value={commitMessage}
									onChange={(event) => setCommitMessage(event.target.value)}
								/>
							</div>
							<div className="space-y-1 md:col-span-2">
								<Label>Commit URL</Label>
								<Input
									value={commitUrl}
									onChange={(event) => setCommitUrl(event.target.value)}
								/>
							</div>
							<div className="md:col-span-2">
								<Button
									variant="outline"
									onClick={() =>
										runAction("Import commit", async () => {
											await importGitCommit.mutateAsync({
												provider: gitProvider,
												repositoryUrl: gitRepositoryUrl,
												commitSha,
												message: commitMessage,
												branch: commitBranch || undefined,
												url: commitUrl || undefined,
											});
										})
									}
								>
									Import commit
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card className="border-slate-200 bg-white">
						<CardHeader>
							<CardTitle className="text-base">
								Create Branch from Task
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3 md:grid-cols-3">
							<div className="space-y-1">
								<Label>Task ID</Label>
								<Input
									value={branchTaskId}
									onChange={(event) => setBranchTaskId(event.target.value)}
								/>
							</div>
							<div className="space-y-1">
								<Label>Base branch</Label>
								<Input
									value={branchBase}
									onChange={(event) => setBranchBase(event.target.value)}
								/>
							</div>
							<div className="space-y-1">
								<Label>Custom branch name</Label>
								<Input
									value={branchName}
									onChange={(event) => setBranchName(event.target.value)}
								/>
							</div>
							<div className="md:col-span-3">
								<Button
									variant="outline"
									onClick={() =>
										runAction("Create branch", async () => {
											const data = await createTaskBranch.mutateAsync({
												id: branchTaskId,
												data: {
													baseBranch: branchBase || undefined,
													branchName: branchName || undefined,
												},
											});
											setBranchResult(
												`${data.branchName} · ${data.checkoutCommand}`,
											);
										})
									}
								>
									Create branch
								</Button>
							</div>
							{branchResult ? (
								<p className="md:col-span-3 text-xs text-slate-600">
									{branchResult}
								</p>
							) : null}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="voice" className="mt-4 space-y-4">
					<Card className="border-slate-200 bg-white">
						<CardHeader>
							<CardTitle className="inline-flex items-center gap-2 text-base">
								Connect Voice Provider
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3 md:grid-cols-2">
							<div className="space-y-1">
								<Label>Provider</Label>
								<Select
									value={voiceProvider}
									onValueChange={(value) =>
										setVoiceProvider(value as "manual" | "openai_whisper")
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select provider" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="manual">Manual</SelectItem>
										<SelectItem value="openai_whisper">
											OpenAI Whisper
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-1">
								<Label>Default language</Label>
								<Input
									value={voiceLanguage}
									onChange={(event) => setVoiceLanguage(event.target.value)}
								/>
							</div>
							<div className="md:col-span-2">
								<Button
									variant="outline"
									onClick={() =>
										runAction("Voice connect", async () => {
											await connectVoice.mutateAsync({
												transcriptionProvider: voiceProvider,
												defaultLanguage: voiceLanguage || undefined,
											});
										})
									}
								>
									Save voice connection
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card className="border-slate-200 bg-white">
						<CardHeader>
							<CardTitle className="inline-flex items-center gap-2 text-base">
								Transcribe Voice Note
								<HelpTooltip
									feature="Voice Transcription"
									what="Uploads a voice note or text transcript and creates inbox tasks."
									use="Provide transcript text directly or attach audio and submit."
									works="Backend creates a transcription job and returns created tasks on completion."
								/>
							</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3 md:grid-cols-2">
							<div className="space-y-1 md:col-span-2">
								<Label>Title</Label>
								<Input
									value={voiceTitle}
									onChange={(event) => setVoiceTitle(event.target.value)}
								/>
							</div>
							<div className="space-y-1 md:col-span-2">
								<Label>Transcription text</Label>
								<Textarea
									rows={4}
									value={voiceTranscriptionText}
									onChange={(event) =>
										setVoiceTranscriptionText(event.target.value)
									}
								/>
							</div>
							<div className="space-y-1 md:col-span-2">
								<Label>Audio file (optional)</Label>
								<Input
									type="file"
									accept="audio/*"
									onChange={(event) =>
										setVoiceFile(event.target.files?.[0] ?? null)
									}
								/>
							</div>
							<div className="md:col-span-2">
								<Button
									className="bg-slate-950 text-white hover:bg-slate-800"
									onClick={() =>
										runAction("Voice transcribe", async () => {
											const result = await transcribeVoice.mutateAsync({
												audio: voiceFile ?? undefined,
												title: voiceTitle || undefined,
												transcription: voiceTranscriptionText || undefined,
												language: voiceLanguage || undefined,
											});
											setVoiceJobId(result.jobId);
										})
									}
								>
									Start transcription
								</Button>
							</div>
							{voiceJob ? (
								<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 md:col-span-2">
									<p>Status: {voiceJob.status}</p>
									{voiceJob.transcription ? (
										<p className="mt-1">Transcript: {voiceJob.transcription}</p>
									) : null}
									{voiceJob.tasks?.length ? (
										<p className="mt-1">
											Created tasks:{" "}
											{voiceJob.tasks.map((task) => task.title).join(", ")}
										</p>
									) : null}
									{voiceJob.error ? (
										<p className="mt-1">Error: {voiceJob.error}</p>
									) : null}
								</div>
							) : null}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function ProviderCard({
	icon: Icon,
	title,
	connected,
	onConnect,
	onDisconnect,
	fields,
}: {
	icon: typeof PlugZap;
	title: string;
	connected: boolean;
	onConnect: () => void;
	onDisconnect: () => void;
	fields?: ReactNode;
}) {
	return (
		<Card className="border-slate-200 bg-white">
			<CardHeader>
				<CardTitle className="inline-flex items-center gap-2 text-base">
					<Icon className="h-4 w-4" />
					{title}
					<span
						className={`rounded-full px-2 py-0.5 text-[11px] ${
							connected
								? "bg-emerald-100 text-emerald-700"
								: "bg-slate-100 text-slate-600"
						}`}
					>
						{connected ? "Connected" : "Not connected"}
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{fields ?? null}
				<div className="flex flex-col gap-2 sm:flex-row">
					<Button
						onClick={onConnect}
						variant={connected ? "outline" : "default"}
						className="w-full sm:w-auto"
					>
						{connected ? "Reconnect" : "Connect"}
					</Button>
					<Button
						onClick={onDisconnect}
						variant="ghost"
						disabled={!connected}
						className="w-full sm:w-auto"
					>
						Disconnect
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
