import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useState } from "react";
import { goeyToast as toast } from "goey-toast";
import { useAutoClassifyTask, useClassifyTask } from "@/hooks/use-inbox";
import { formatRelativeTime } from "@/lib/constants";
import type { Task } from "@/lib/types";
import { ClassifyForm } from "./classify-form";
import { useNavigate } from "@tanstack/react-router";

interface InboxTaskCardProps {
	task: Task;
}

function toObject(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

export function InboxTaskCard({ task }: InboxTaskCardProps) {
	const navigate = useNavigate();
	const [showClassify, setShowClassify] = useState(false);
	const autoClassify = useAutoClassifyTask();
	const classifyTask = useClassifyTask();

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
						new Set([
							...suggestedTags.map((tag) => tag.toLowerCase()),
						]),
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

	return (
		<Card className="border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300">
			<CardContent className="p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<h3 className="font-medium text-slate-900">{task.title}</h3>

						{task.description && (
							<p className="mt-1 line-clamp-2 text-sm text-slate-600">
								{task.description}
							</p>
						)}

						<div className="mt-2 flex flex-wrap items-center gap-1.5">
							<span className="text-xs text-slate-500">
								{formatRelativeTime(task.createdAt)}
							</span>
							{needsReview && (
								<Badge
									variant="outline"
									className="border-amber-300 bg-amber-50 text-amber-700"
								>
									Needs review
								</Badge>
							)}
							{task.tags.length > 0 &&
								task.tags.map((tag) => (
									<Badge
										key={tag}
										variant="outline"
										className="border-slate-200 bg-slate-50 text-xs"
									>
										{tag}
									</Badge>
								))}
							{task.source !== "manual" && (
								<Badge variant="outline" className="text-xs capitalize">
									{task.source}
								</Badge>
							)}
						</div>
					</div>

					<div className="flex shrink-0 items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleAutoClassify}
							disabled={autoClassify.isPending}
						>
							<Sparkles className="mr-1 h-3.5 w-3.5" />
							AI
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowClassify(!showClassify)}
						>
							{showClassify ? (
								<>
									<ChevronUp className="mr-1 h-3 w-3" />
									Close
								</>
							) : (
								<>
									<ChevronDown className="mr-1 h-3 w-3" />
									Classify
								</>
							)}
						</Button>
					</div>
				</div>

				{showClassify && (
					<ClassifyForm
						taskId={task.id}
						onDone={() => setShowClassify(false)}
					/>
				)}

				{needsReview && hasSuggestedFields && (
					<div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
						<p className="text-xs font-medium text-amber-900">
							AI suggested values
							{aiConfidence !== null
								? ` (${Math.round(aiConfidence * 100)}% confidence)`
								: ""}
						</p>
						<div className="flex flex-wrap gap-1.5 text-xs text-amber-900">
							{suggestedTitle && (
								<Badge variant="outline">title improved</Badge>
							)}
							{suggestedDescription && (
								<Badge variant="outline">description improved</Badge>
							)}
							{suggestedSize && (
								<Badge variant="outline">size: {suggestedSize}</Badge>
							)}
							{suggestedUrgency && (
								<Badge variant="outline">urgency: {suggestedUrgency}</Badge>
							)}
							{suggestedDeadline && (
								<Badge variant="outline">
									deadline: {suggestedDeadline.slice(0, 10)}
								</Badge>
							)}
							{typeof suggestedProtected === "boolean" && (
								<Badge variant="outline">
									protected: {String(suggestedProtected)}
								</Badge>
							)}
							{suggestedProtectionReason && (
								<Badge variant="outline">
									reason: {suggestedProtectionReason}
								</Badge>
							)}
							{suggestedProject && (
								<Badge variant="outline">project: {suggestedProject}</Badge>
							)}
							{suggestedTags.map((tag) => (
								<Badge key={tag} variant="outline">
									tag: {tag}
								</Badge>
							))}
						</div>
						<div className="flex items-center gap-2">
							<Button
								size="sm"
								onClick={handleApplyAISuggestion}
								disabled={classifyTask.isPending}
							>
								Apply AI Suggestion
							</Button>
							<span className="text-xs text-amber-900">
								or use Classify to edit before applying
							</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
