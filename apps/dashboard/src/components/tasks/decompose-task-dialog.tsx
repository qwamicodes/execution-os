import { Button } from "@repo/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";

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
	onSubmit: (payload: { feedback?: string }) => void;
	isSubmitting?: boolean;
	taskTitle?: string;
}

export function DecomposeTaskDialog({
	open,
	onOpenChange,
	onSubmit,
	isSubmitting = false,
	taskTitle,
}: DecomposeTaskDialogProps) {
	const [selectedChips, setSelectedChips] = useState<string[]>([]);
	const [notes, setNotes] = useState("");

	useEffect(() => {
		if (!open) return;
		setSelectedChips([]);
		setNotes("");
	}, [open]);

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
		onSubmit({ feedback: feedback.length > 0 ? feedback : undefined });
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Guide AI decomposition</DialogTitle>
					<DialogDescription>
						Add direction for how this should be broken down. Leave blank to let AI
						propose the route.
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
					<Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
						{isSubmitting
							? "Decomposing..."
							: composedFeedback
								? "Decompose with guidance"
								: "Let AI decide"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
