import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { goeyToast as toast } from "goey-toast";
import {
	Ban,
	Check,
	ChevronDown,
	ChevronUp,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import {
	useAutoClassifyTask,
	useClassifyTask,
	useIgnoreAISuggestion,
} from "@/hooks/use-inbox";
import { useDeleteTask } from "@/hooks/use-tasks";
import { formatRelativeTime } from "@/lib/constants";
import type { Task } from "@/lib/types";
import { ClassifyForm } from "./classify-form";

interface InboxTaskCardProps {
	task: Task;
}

interface ChangeRow {
	label: string;
	before: unknown;
	after: unknown;
}

interface TextDiffPart {
	value: string;
	type: "same" | "added" | "removed";
}

function toObject(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

function formatValue(value: unknown) {
	if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "None";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "string") return value.trim() || "None";
	if (value === null || value === undefined) return "None";
	return String(value);
}

function formatDeadline(value: string | null | undefined) {
	if (!value) return "None";
	return value.slice(0, 10);
}

function tokenizeText(value: string) {
	return value.match(/\S+\s*/g) ?? [];
}

function diffText(before: string, after: string): TextDiffPart[] {
	const beforeTokens = tokenizeText(before);
	const afterTokens = tokenizeText(after);
	const lengths = Array.from({ length: beforeTokens.length + 1 }, () =>
		Array(afterTokens.length + 1).fill(0),
	);

	for (let i = beforeTokens.length - 1; i >= 0; i -= 1) {
		for (let j = afterTokens.length - 1; j >= 0; j -= 1) {
			const currentRow = lengths[i];
			const nextRow = lengths[i + 1];
			if (!currentRow || !nextRow) continue;
			currentRow[j] =
				beforeTokens[i] === afterTokens[j]
					? (nextRow[j + 1] ?? 0) + 1
					: Math.max(nextRow[j] ?? 0, currentRow[j + 1] ?? 0);
		}
	}

	const parts: TextDiffPart[] = [];
	let i = 0;
	let j = 0;
	while (i < beforeTokens.length && j < afterTokens.length) {
		const beforeToken = beforeTokens[i];
		const afterToken = afterTokens[j];
		if (!beforeToken || !afterToken) break;
		if (beforeToken === afterToken) {
			parts.push({ type: "same", value: beforeToken });
			i += 1;
			j += 1;
		} else if ((lengths[i + 1]?.[j] ?? 0) >= (lengths[i]?.[j + 1] ?? 0)) {
			parts.push({ type: "removed", value: beforeToken });
			i += 1;
		} else {
			parts.push({ type: "added", value: afterToken });
			j += 1;
		}
	}
	while (i < beforeTokens.length) {
		const beforeToken = beforeTokens[i];
		if (beforeToken) parts.push({ type: "removed", value: beforeToken });
		i += 1;
	}
	while (j < afterTokens.length) {
		const afterToken = afterTokens[j];
		if (afterToken) parts.push({ type: "added", value: afterToken });
		j += 1;
	}

	return parts;
}

function TextDiff({
	before,
	after,
	mode,
}: {
	before: unknown;
	after: unknown;
	mode: "before" | "after";
}) {
	const beforeText = formatValue(before);
	const afterText = formatValue(after);
	const visibleTypes =
		mode === "before"
			? new Set(["same", "removed"])
			: new Set(["same", "added"]);
	const parts = diffText(beforeText, afterText).filter((part) =>
		visibleTypes.has(part.type),
	);

	return (
		<span className="line-clamp-4 break-words">
			{parts.map((part, index) => {
				const className =
					part.type === "removed"
						? "rounded px-0.5 bg-red-500/15 text-red-600 dark:text-red-400 line-through"
						: part.type === "added"
							? "rounded px-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
							: "text-foreground";
				return (
					<span key={`${part.type}-${index}`} className={className}>
						{part.value}
					</span>
				);
			})}
		</span>
	);
}

export function InboxTaskCard({ task }: InboxTaskCardProps) {
	const navigate = useNavigate();
	const [showClassify, setShowClassify] = useState(false);
	const autoClassify = useAutoClassifyTask();
	const classifyTask = useClassifyTask();
	const ignoreAISuggestion = useIgnoreAISuggestion();
	const deleteTask = useDeleteTask();

	const aiClassification = toObject(
		toObject(task.sourceMetadata)?.aiClassification,
	);
	const aiStatus =
		typeof aiClassification?.status === "string"
			? aiClassification.status
			: null;
	const aiConfidence =
		typeof aiClassification?.confidence === "number"
			? aiClassification.confidence
			: null;
	const aiSuggested = toObject(aiClassification?.suggested);
	const suggestedSize =
		typeof aiSuggested?.size === "string" ? aiSuggested.size : undefined;
	const suggestedUrgency =
		typeof aiSuggested?.urgency === "string" ? aiSuggested.urgency : undefined;
	const suggestedDeadline =
		typeof aiSuggested?.deadline === "string"
			? aiSuggested.deadline
			: undefined;
	const suggestedProtected =
		typeof aiSuggested?.protected === "boolean"
			? aiSuggested.protected
			: undefined;
	const suggestedProtectionReason =
		typeof aiSuggested?.protectionReason === "string"
			? aiSuggested.protectionReason
			: undefined;
	const suggestedProject =
		typeof aiSuggested?.project === "string" ? aiSuggested.project : undefined;
	const suggestedTitle =
		typeof aiSuggested?.title === "string" ? aiSuggested.title : undefined;
	const suggestedDescription =
		typeof aiSuggested?.description === "string"
			? aiSuggested.description
			: undefined;
	const originalTitle =
		typeof aiSuggested?.originalTitle === "string"
			? aiSuggested.originalTitle
			: task.title;
	const originalDescription =
		typeof aiSuggested?.originalDescription === "string"
			? aiSuggested.originalDescription
			: task.description;
	const suggestedTags = toStringArray(aiSuggested?.tags);
	const needsReview = aiStatus === "needs_review";
	const hasSuggestedFields =
		Boolean(suggestedTitle) ||
		Boolean(suggestedDescription) ||
		Boolean(suggestedSize) ||
		Boolean(suggestedUrgency) ||
		Boolean(suggestedDeadline) ||
		typeof suggestedProtected === "boolean" ||
		Boolean(suggestedProtectionReason) ||
		suggestedTags.length > 0;
	const suggestedRows = (
		[
			suggestedTitle
				? { label: "Title", before: originalTitle, after: suggestedTitle }
				: null,
			suggestedDescription
				? {
						label: "Description",
						before: originalDescription,
						after: suggestedDescription,
					}
				: null,
			suggestedSize
				? { label: "Size", before: task.size, after: suggestedSize }
				: null,
			suggestedUrgency
				? { label: "Urgency", before: task.urgency, after: suggestedUrgency }
				: null,
			suggestedDeadline
				? {
						label: "Deadline",
						before: formatDeadline(task.deadline),
						after: formatDeadline(suggestedDeadline),
					}
				: null,
			typeof suggestedProtected === "boolean"
				? {
						label: "Protected",
						before: task.protected,
						after: suggestedProtected,
					}
				: null,
			suggestedProtectionReason
				? {
						label: "Protection reason",
						before: task.protectionReason,
						after: suggestedProtectionReason,
					}
				: null,
			suggestedTags.length > 0
				? { label: "Tags", before: task.tags, after: suggestedTags }
				: null,
		] as Array<ChangeRow | null>
	).filter((row): row is ChangeRow => row !== null);
	const changeRows = suggestedRows.filter(
		(row) => formatValue(row.before) !== formatValue(row.after),
	);
	const textChangeLabels = new Set(["Title", "Description"]);

	function handleAutoClassify() {
		autoClassify.mutate(task.id, {
			onSuccess: (updatedTask) => {
				const updatedMeta = toObject(updatedTask.sourceMetadata);
				const updatedAi = toObject(updatedMeta?.aiClassification);
				const updatedStatus =
					typeof updatedAi?.status === "string" ? updatedAi.status : null;
				if (updatedStatus === "needs_review") {
					toast.error(
						"AI classification needs review. Apply AI suggestion or classify manually.",
					);
					return;
				}
				toast.success("AI classification applied");
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});
	}

	function handleApplyAISuggestion() {
		const mergedSuggestedTags =
			suggestedTags.length > 0
				? Array.from(
						new Set([...suggestedTags.map((tag) => tag.toLowerCase())]),
					)
				: undefined;

		classifyTask.mutate(
			{
				id: task.id,
				data: {
					title: suggestedTitle,
					description: suggestedDescription,
					size: suggestedSize as
						| "Small"
						| "Medium"
						| "Large"
						| "Huge"
						| undefined,
					urgency: suggestedUrgency as
						| "Urgent"
						| "High"
						| "Medium"
						| "Low"
						| undefined,
					protected: suggestedProtected,
					protectionReason: suggestedProtectionReason as
						| "contract"
						| "sla"
						| "client"
						| "investor"
						| undefined,
					deadline: suggestedDeadline,
					tags: mergedSuggestedTags,
				},
			},
			{
				onSuccess: () => {
					toast.success("AI suggestion applied", {
						description: `The AI suggestion has been applied successfully on ${task.title}.`,
						action: {
							label: "View task",
							onClick: () =>
								navigate({ to: "/tasks/$taskId", params: { taskId: task.id } }),
						},
					});
				},
				onError: (error) => {
					toast.error(error.message);
				},
			},
		);
	}

	function handleIgnoreAISuggestion() {
		ignoreAISuggestion.mutate(task.id, {
			onSuccess: () => {
				toast.success("AI suggestion ignored");
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});
	}

	function handleDeleteTask() {
		if (!window.confirm(`Delete "${task.title}" from the inbox?`)) {
			return;
		}
		deleteTask.mutate(task.id, {
			onSuccess: () => {
				toast.success("Inbox task deleted");
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});
	}

	return (
		<div className="group rounded-md border border-border bg-card px-4 py-3 transition-colors duration-150 hover:bg-accent/20">
			{/* Main row */}
			<div className="flex items-start gap-3">
				{/* Inbox dot */}
				<span className="mt-[5px] h-2 w-2 shrink-0 rounded-full bg-primary/60" />

				<div className="min-w-0 flex-1">
					{/* Title + actions */}
					<div className="flex items-start justify-between gap-2">
						<button
							type="button"
							className="min-w-0 flex-1 text-left"
							onClick={() =>
								navigate({ to: "/tasks/$taskId", params: { taskId: task.id } })
							}
						>
							<h3 className="text-sm font-medium leading-snug text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors duration-100">
								{task.title}
							</h3>
						</button>

						<div className="flex shrink-0 items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
								onClick={(e) => {
									e.stopPropagation();
									handleAutoClassify();
								}}
								disabled={autoClassify.isPending}
							>
								<Sparkles className="h-3 w-3" />
								AI
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
								onClick={(e) => {
									e.stopPropagation();
									setShowClassify(!showClassify);
								}}
							>
								{showClassify ? (
									<>
										<ChevronUp className="h-3 w-3" />
										Close
									</>
								) : (
									<>
										<ChevronDown className="h-3 w-3" />
										Classify
									</>
								)}
							</Button>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									handleDeleteTask();
								}}
								disabled={deleteTask.isPending}
								aria-label="Delete inbox task"
								className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-colors hover:text-destructive group-hover:opacity-100"
							>
								<Trash2 className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>

					{/* Description */}
					{task.description && (
						<p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
							{task.description}
						</p>
					)}

					{/* Meta row */}
					<div className="mt-1.5 flex flex-wrap items-center gap-1">
						<span className="text-[11px] text-muted-foreground/70">
							{formatRelativeTime(task.createdAt)}
						</span>
						{needsReview && (
							<Badge variant="warning" className="px-1.5 py-0 text-[11px]">
								Needs review
							</Badge>
						)}
						{task.source !== "manual" && (
							<Badge
								variant="neutral"
								className="px-1.5 py-0 text-[11px] capitalize"
							>
								{task.source}
							</Badge>
						)}
						{task.tags.slice(0, 2).map((tag) => (
							<Badge
								key={tag}
								variant="neutral"
								className="px-1.5 py-0 text-[11px]"
							>
								{tag}
							</Badge>
						))}
					</div>
				</div>
			</div>

			{/* Classify form */}
			{showClassify && (
				<div className="mt-3 ml-5">
					<ClassifyForm
						taskId={task.id}
						onDone={() => setShowClassify(false)}
					/>
				</div>
			)}

			{/* AI suggestion panel */}
			{needsReview && hasSuggestedFields && (
				<div className="mt-3 ml-5 space-y-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
					{/* Header */}
					<div className="flex items-center gap-1.5">
						<Sparkles className="h-3.5 w-3.5 text-primary" />
						<p className="text-xs font-medium text-primary">
							AI suggested changes
							{aiConfidence !== null
								? ` · ${Math.round(aiConfidence * 100)}% confidence`
								: ""}
						</p>
					</div>

					{/* Diff table */}
					{changeRows.length > 0 ? (
						<div className="overflow-hidden rounded-md border border-border bg-card">
							<div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)] border-b border-border bg-muted/60 text-xs font-medium text-muted-foreground sm:grid">
								<div className="px-2.5 py-1.5">Field</div>
								<div className="px-2.5 py-1.5">Before</div>
								<div className="px-2.5 py-1.5">After</div>
							</div>
							{changeRows.map((row) => (
								<div
									key={row.label}
									className="grid grid-cols-1 border-b border-border/60 last:border-b-0 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)]"
								>
									<div className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
										{row.label}
									</div>
									<div className="min-w-0 px-2.5 py-1.5 text-xs text-muted-foreground sm:border-l sm:border-border/60">
										{textChangeLabels.has(row.label) ? (
											<TextDiff
												before={row.before}
												after={row.after}
												mode="before"
											/>
										) : (
											<span className="line-clamp-3 break-words">
												{formatValue(row.before)}
											</span>
										)}
									</div>
									<div className="min-w-0 px-2.5 py-1.5 text-xs font-medium text-foreground sm:border-l sm:border-border/60">
										{textChangeLabels.has(row.label) ? (
											<TextDiff
												before={row.before}
												after={row.after}
												mode="after"
											/>
										) : (
											<span className="line-clamp-3 break-words">
												{formatValue(row.after)}
											</span>
										)}
									</div>
								</div>
							))}
						</div>
					) : (
						<p className="text-xs text-muted-foreground">
							No visible field changes remain in this suggestion.
						</p>
					)}

					{suggestedProject && (
						<Badge variant="lavender" className="px-1.5 py-0 text-[11px]">
							Suggested project: {suggestedProject}
						</Badge>
					)}

					{/* Actions */}
					<div className="flex flex-wrap items-center gap-2">
						<Button
							size="sm"
							onClick={handleApplyAISuggestion}
							disabled={classifyTask.isPending}
							className="h-7 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
						>
							<Check className="h-3 w-3" />
							Apply
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleIgnoreAISuggestion}
							disabled={ignoreAISuggestion.isPending}
							className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
						>
							<Ban className="h-3 w-3" />
							Ignore
						</Button>
						<span className="text-[11px] text-muted-foreground">
							or Classify to edit first
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
