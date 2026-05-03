import { Button } from "@repo/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { goeyToast as toast } from "goey-toast";
import { useState } from "react";
import { useSessionSounds } from "@/hooks/use-session-sounds";
import { useCompleteSession } from "@/hooks/use-sessions";
import { SESSION_OUTCOME_CONFIG } from "@/lib/constants";
import type { Session, SessionOutcome } from "@/lib/types";

interface CompleteSessionDialogProps {
	session: Session;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCompleted?: (nextTask?: { id: string; title: string }) => void;
}

export function CompleteSessionDialog({
	session,
	open,
	onOpenChange,
	onCompleted,
}: CompleteSessionDialogProps) {
	const [outcome, setOutcome] = useState<SessionOutcome>("Done");
	const [notes, setNotes] = useState("");
	const [blockerNote, setBlockerNote] = useState("");
	const completeSession = useCompleteSession();
	const { primeSessionAudio, playSessionComplete, playSessionError } =
		useSessionSounds();

	async function handleComplete() {
		await primeSessionAudio();
		completeSession.mutate(
			{
				id: session.id,
				data: {
					outcome,
					notes: notes || undefined,
					blockerNote:
						outcome === "Blocked" ? blockerNote || undefined : undefined,
				},
			},
			{
				onSuccess: (data) => {
					playSessionComplete();
					toast.success("Session completed");
					onOpenChange(false);
					onCompleted?.(data?.nextTask);
				},
				onError: (error) => {
					playSessionError();
					toast.error(error.message);
				},
			},
		);
	}

	const outcomes = Object.entries(SESSION_OUTCOME_CONFIG) as [
		SessionOutcome,
		(typeof SESSION_OUTCOME_CONFIG)[SessionOutcome],
	][];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>End session</DialogTitle>
					<DialogDescription>
						Record the outcome so the next task state is clear.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label>How did it go?</Label>
						<RadioGroup
							value={outcome}
							onValueChange={(v) => setOutcome(v as SessionOutcome)}
							className="grid grid-cols-2 gap-2"
						>
							{outcomes.map(([key, config]) => (
								<Label
									key={key}
									htmlFor={`outcome-${key}`}
									className={`flex cursor-pointer flex-col gap-1 rounded-lg border-2 p-3 transition-colors ${
										outcome === key
											? "border-primary bg-primary/5"
											: "border-muted hover:border-muted-foreground/25"
									}`}
								>
									<RadioGroupItem
										value={key}
										id={`outcome-${key}`}
										className="sr-only"
									/>
									<span className="text-sm font-medium">{config.label}</span>
									<span className="text-xs text-muted-foreground">
										{config.description}
									</span>
								</Label>
							))}
						</RadioGroup>
					</div>

					{outcome === "Blocked" && (
						<div className="space-y-2">
							<Label htmlFor="blocker">What blocked you?</Label>
							<Textarea
								id="blocker"
								placeholder="Describe the blocker..."
								className="resize-none"
								rows={2}
								value={blockerNote}
								onChange={(e) => setBlockerNote(e.target.value)}
							/>
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="notes">Notes (optional)</Label>
						<Textarea
							id="notes"
							placeholder="Any notes about this session..."
							className="resize-none"
							rows={2}
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
						/>
					</div>

					<div className="flex justify-end gap-2 border-t pt-4">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							className="bg-primary text-primary-foreground hover:bg-primary/90"
							onClick={handleComplete}
							disabled={completeSession.isPending}
						>
							{completeSession.isPending ? "Saving..." : "Complete"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
