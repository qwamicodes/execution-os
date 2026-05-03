import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { goeyToast as toast } from "goey-toast";
import { Ban, Check, Sparkles } from "lucide-react";
import {
	useApplyTaskAISuggestion,
	useIgnoreTaskAISuggestion,
} from "@/hooks/use-tasks";
import type { Task } from "@/lib/types";

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

export function TaskAISuggestionPanel({ task }: { task: Task }) {
	const applySuggestion = useApplyTaskAISuggestion();
	const ignoreSuggestion = useIgnoreTaskAISuggestion();
	const aiClassification = toObject(
		toObject(task.sourceMetadata)?.aiClassification,
	);
	if (aiClassification?.status !== "needs_review") return null;

	const aiSuggested = toObject(aiClassification.suggested);
	if (!aiSuggested) return null;

	const suggestedTitle =
		typeof aiSuggested.title === "string" ? aiSuggested.title : undefined;
	const suggestedDescription =
		typeof aiSuggested.description === "string"
			? aiSuggested.description
			: undefined;
	const originalTitle =
		typeof aiSuggested.originalTitle === "string"
			? aiSuggested.originalTitle
			: task.title;
	const originalDescription =
		typeof aiSuggested.originalDescription === "string"
			? aiSuggested.originalDescription
			: task.description;
	const suggestedTags = toStringArray(aiSuggested.tags);
	const confidence =
		typeof aiClassification.confidence === "number"
			? aiClassification.confidence
			: null;

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
			typeof aiSuggested.size === "string"
				? { label: "Size", before: task.size, after: aiSuggested.size }
				: null,
			typeof aiSuggested.urgency === "string"
				? { label: "Urgency", before: task.urgency, after: aiSuggested.urgency }
				: null,
			typeof aiSuggested.deadline === "string"
				? {
						label: "Deadline",
						before: formatDeadline(task.deadline),
						after: formatDeadline(aiSuggested.deadline),
					}
				: null,
			typeof aiSuggested.protected === "boolean"
				? {
						label: "Protected",
						before: task.protected,
						after: aiSuggested.protected,
					}
				: null,
			typeof aiSuggested.protectionReason === "string"
				? {
						label: "Protection reason",
						before: task.protectionReason,
						after: aiSuggested.protectionReason,
					}
				: null,
			suggestedTags.length > 0
				? { label: "Tags", before: task.tags, after: suggestedTags }
				: null,
		] as Array<ChangeRow | null>
	)
		.filter((row): row is ChangeRow => row !== null)
		.filter((row) => formatValue(row.before) !== formatValue(row.after));

	if (suggestedRows.length === 0) return null;

	function handleApply() {
		applySuggestion.mutate(task.id, {
			onSuccess: () => toast.success("AI suggestion applied"),
			onError: (error) => toast.error(error.message),
		});
	}

	function handleIgnore() {
		ignoreSuggestion.mutate(task.id, {
			onSuccess: () => toast.success("AI suggestion ignored"),
			onError: (error) => toast.error(error.message),
		});
	}

	const textChangeLabels = new Set(["Title", "Description"]);

	return (
		<div
			className="mt-3 space-y-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3"
			onClick={(event) => event.stopPropagation()}
		>
			{/* Header */}
			<div className="flex items-center gap-1.5">
				<Sparkles className="h-3.5 w-3.5 text-primary" />
				<p className="text-xs font-medium text-primary">
					AI suggested changes
					{confidence !== null
						? ` · ${Math.round(confidence * 100)}% confidence`
						: ""}
				</p>
			</div>

			{/* Diff table */}
			<div className="overflow-hidden rounded-md border border-border bg-card">
				{/* Table header */}
				<div className="grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)] border-b border-border bg-muted/60 text-xs font-medium text-muted-foreground">
					<div className="px-2.5 py-1.5">Field</div>
					<div className="px-2.5 py-1.5">Before</div>
					<div className="px-2.5 py-1.5">After</div>
				</div>

				{/* Table rows */}
				{suggestedRows.map((row) => (
					<div
						key={row.label}
						className="grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)] border-b border-border/60 last:border-b-0"
					>
						<div className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
							{row.label}
						</div>
						<div className="min-w-0 border-l border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground">
							{textChangeLabels.has(row.label) ? (
								<TextDiff before={row.before} after={row.after} mode="before" />
							) : (
								<span className="line-clamp-3 break-words">
									{formatValue(row.before)}
								</span>
							)}
						</div>
						<div className="min-w-0 border-l border-border/60 px-2.5 py-1.5 text-xs font-medium text-foreground">
							{textChangeLabels.has(row.label) ? (
								<TextDiff before={row.before} after={row.after} mode="after" />
							) : (
								<span className="line-clamp-3 break-words">
									{formatValue(row.after)}
								</span>
							)}
						</div>
					</div>
				))}
			</div>

			{/* Suggested project */}
			{typeof aiSuggested.project === "string" && (
				<Badge variant="lavender">
					Suggested project: {aiSuggested.project}
				</Badge>
			)}

			{/* Actions */}
			<div className="flex flex-wrap items-center gap-2">
				<Button
					size="sm"
					onClick={handleApply}
					disabled={applySuggestion.isPending}
					className="h-7 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
				>
					<Check className="h-3 w-3" />
					Apply
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={handleIgnore}
					disabled={ignoreSuggestion.isPending}
					className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
				>
					<Ban className="h-3 w-3" />
					Ignore
				</Button>
			</div>
		</div>
	);
}
