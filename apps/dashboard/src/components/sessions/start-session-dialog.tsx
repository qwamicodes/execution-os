import { Button } from "@repo/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { useState } from "react";
import { goeyToast as toast } from "goey-toast";
import { useStartSession } from "@/hooks/use-sessions";
import type { Task } from "@/lib/types";

const DURATIONS = [
	{ value: 15, label: "15 min" },
	{ value: 25, label: "25 min" },
	{ value: 30, label: "30 min" },
	{ value: 45, label: "45 min" },
	{ value: 60, label: "60 min" },
	{ value: 90, label: "90 min" },
	{ value: 120, label: "120 min" },
];

interface StartSessionDialogProps {
	task: Task;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function StartSessionDialog({
	task,
	open,
	onOpenChange,
}: StartSessionDialogProps) {
	const [duration, setDuration] = useState("25");
	const startSession = useStartSession();

	function handleStart() {
		startSession.mutate(
			{
				taskId: task.id,
				duration: Number(duration),
			},
			{
				onSuccess: () => {
					toast.success("Session started");
					onOpenChange(false);
				},
				onError: (error) => {
					toast.error(error.message);
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>Start focus session</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<p className="text-sm text-muted-foreground">Task</p>
						<p className="font-medium truncate">{task.title}</p>
					</div>

					<div className="space-y-2">
						<Label>Duration</Label>
						<RadioGroup
							value={duration}
							onValueChange={setDuration}
							className="grid grid-cols-4 gap-2"
						>
							{DURATIONS.map((d) => (
								<Label
									key={d.value}
									htmlFor={`dur-${d.value}`}
									className={`flex cursor-pointer items-center justify-center rounded-lg border-2 p-2 text-sm font-medium transition-colors ${
										duration === String(d.value)
											? "border-primary bg-primary/5"
											: "border-muted hover:border-muted-foreground/25"
									}`}
								>
									<RadioGroupItem
										value={String(d.value)}
										id={`dur-${d.value}`}
										className="sr-only"
									/>
									{d.label}
								</Label>
							))}
						</RadioGroup>
					</div>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button onClick={handleStart} disabled={startSession.isPending}>
							{startSession.isPending ? "Starting..." : "Start"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
