import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
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
import { Textarea } from "@repo/ui/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
	DecompositionPreview,
	DecompositionPreviewSubtask,
} from "@/lib/types";

const DECOMPOSE_GUIDANCE_CHIPS = [
	"Backend-first implementation",
	"Frontend-first implementation",
	"Ship an MVP slice first",
	"API contract and validation before UI",
	"Write tests as each subtask ships",
	"Focus on reliability and edge cases",
	"Prioritize speed over polish",
	"Prioritize maintainability over speed",
];

interface DecomposeTaskDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPreview: (payload: { feedback?: string }) => void;
	onApply: (payload: {
		feedback?: string;
		replaceExisting?: boolean;
		subtasks: DecompositionPreviewSubtask[];
	}) => void;
	onRegenerate: (payload: { feedback?: string }) => void;
	isSubmitting?: boolean;
	isPreviewing?: boolean;
	taskTitle?: string;
	existingSubtaskCount?: number;
	preview?: DecompositionPreview | null;
}

export function DecomposeTaskDialog({
	open,
	onOpenChange,
	onPreview,
	onApply,
	onRegenerate,
	isSubmitting = false,
	isPreviewing = false,
	taskTitle,
	existingSubtaskCount = 0,
	preview,
}: DecomposeTaskDialogProps) {
	const [selectedChips, setSelectedChips] = useState<string[]>([]);
	const [notes, setNotes] = useState("");
	const [editableSubtasks, setEditableSubtasks] = useState<
		DecompositionPreviewSubtask[]
	>([]);

	useEffect(() => {
		if (!open) return;
		setSelectedChips([]);
		setNotes("");
	}, [open]);

	useEffect(() => {
		setEditableSubtasks(preview?.subtasks ?? []);
	}, [preview]);

	const composedFeedback = useMemo(() => {
		const sections: string[] = [];
		if (selectedChips.length > 0) {
			sections.push(
				`Preferred direction:\n${selectedChips.map((chip) => `- ${chip}`).join("\n")}`,
			);
		}
		const normalizedNotes = notes.trim();
		if (normalizedNotes.length > 0) {
			sections.push(`Additional guidance:\n${normalizedNotes}`);
		}
		if (sections.length === 0) return "";
		return sections.join("\n\n").slice(0, 500);
	}, [notes, selectedChips]);

	function toggleChip(chip: string) {
		setSelectedChips((current) =>
			current.includes(chip)
				? current.filter((value) => value !== chip)
				: [...current, chip],
		);
	}

	function handleSubmit() {
		const feedback = composedFeedback.trim();
		onPreview({ feedback: feedback.length > 0 ? feedback : undefined });
	}

	function currentFeedback() {
		const feedback = composedFeedback.trim();
		return feedback.length > 0 ? feedback : undefined;
	}

	function updateSubtask(
		order: number,
		patch: Partial<DecompositionPreviewSubtask>,
	) {
		setEditableSubtasks((current) =>
			current.map((subtask) =>
				subtask.order === order ? { ...subtask, ...patch } : subtask,
			),
		);
	}

	function removeSubtask(order: number) {
		setEditableSubtasks((current) =>
			current
				.filter((subtask) => subtask.order !== order)
				.map((subtask, index) => ({
					...subtask,
					order: index,
					state: index === 0 ? "Ready" : "Ongoing",
				})),
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Guide AI decomposition</DialogTitle>
					<DialogDescription>
						Add direction for how this should be broken down. Leave blank to let
						AI propose the route.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{taskTitle ? (
						<p className="line-clamp-2 text-xs text-muted-foreground">
							Task: {taskTitle}
						</p>
					) : null}

					<div className="space-y-2">
						<Label>Direction chips</Label>
						<div className="flex flex-wrap gap-2">
							{DECOMPOSE_GUIDANCE_CHIPS.map((chip) => {
								const active = selectedChips.includes(chip);
								return (
									<Button
										key={chip}
										type="button"
										size="sm"
										variant={active ? "default" : "outline"}
										onClick={() => toggleChip(chip)}
										className="h-8"
									>
										{chip}
									</Button>
								);
							})}
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="decompose-guidance">Your guidance</Label>
						<Textarea
							id="decompose-guidance"
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							placeholder="Add your own plan, constraints, priorities, or sequence..."
							rows={5}
							maxLength={500}
							className="resize-none"
						/>
						<p className="text-right text-xs text-muted-foreground">
							{composedFeedback.length}/500
						</p>
					</div>

					{preview ? (
						<div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="text-sm font-medium text-foreground">
										Proposed subtasks
									</p>
									<p className="text-xs text-muted-foreground">
										{preview.reason || "AI generated an ordered breakdown."}
									</p>
								</div>
								<Badge variant="neutral" className="text-xs">
									{preview.subtasks.length} items
								</Badge>
							</div>
							<div className="no-scrollbar max-h-64 space-y-2 overflow-y-auto pr-1">
								{editableSubtasks.map((subtask) => (
									<div
										key={`${subtask.order}-${subtask.title}`}
										className="rounded-md border border-border bg-card p-2"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="flex flex-1 items-center gap-2">
												<span className="text-xs font-medium text-muted-foreground">
													{subtask.order + 1}.
												</span>
												<Input
													value={subtask.title}
													onChange={(event) =>
														updateSubtask(subtask.order, {
															title: event.target.value,
														})
													}
													className="h-8 text-sm"
												/>
											</div>
											<div className="flex items-center gap-2">
												<Badge variant="neutral" className="text-xs">
													{subtask.state}
												</Badge>
												<Button
													type="button"
													size="icon"
													variant="ghost"
													className="h-8 w-8 text-muted-foreground hover:text-destructive"
													onClick={() => removeSubtask(subtask.order)}
													disabled={editableSubtasks.length <= 1}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
										<Textarea
											value={subtask.description ?? ""}
											onChange={(event) =>
												updateSubtask(subtask.order, {
													description: event.target.value || null,
												})
											}
											rows={2}
											className="mt-2 resize-none text-xs"
											placeholder="Subtask description"
										/>
										<div className="mt-2 flex items-center gap-2">
											<Label className="text-xs text-muted-foreground">
												Sessions
											</Label>
											<Input
												type="number"
												min={1}
												max={3}
												value={subtask.estimatedSessions}
												onChange={(event) =>
													updateSubtask(subtask.order, {
														estimatedSessions: Math.min(
															3,
															Math.max(1, Number(event.target.value) || 1),
														),
													})
												}
												className="h-8 w-20 text-xs"
											/>
										</div>
									</div>
								))}
							</div>
							{existingSubtaskCount > 0 ? (
								<p className="text-xs text-amber-700">
									Applying this will replace {existingSubtaskCount} existing
									subtask{existingSubtaskCount === 1 ? "" : "s"}.
								</p>
							) : null}
						</div>
					) : null}
				</div>

				<DialogFooter className="gap-2 sm:justify-end">
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					{preview ? (
						<>
							<Button
								type="button"
								variant="outline"
								onClick={() => onRegenerate({ feedback: currentFeedback() })}
								disabled={isSubmitting || isPreviewing}
							>
								{isPreviewing ? "Regenerating..." : "Regenerate"}
							</Button>
							<Button
								type="button"
								className="bg-primary text-primary-foreground hover:bg-primary/90"
								onClick={() =>
									onApply({
										feedback: currentFeedback(),
										replaceExisting: existingSubtaskCount > 0,
										subtasks: editableSubtasks.filter((subtask) =>
											subtask.title.trim(),
										),
									})
								}
								disabled={
									isSubmitting ||
									isPreviewing ||
									!editableSubtasks.some((subtask) => subtask.title.trim())
								}
							>
								{isSubmitting ? "Applying..." : "Apply breakdown"}
							</Button>
						</>
					) : (
						<Button
							type="button"
							variant="info"
							onClick={handleSubmit}
							disabled={isSubmitting || isPreviewing}
						>
							{isPreviewing
								? "Generating preview..."
								: composedFeedback
									? "Preview with guidance"
									: "Preview AI breakdown"}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
