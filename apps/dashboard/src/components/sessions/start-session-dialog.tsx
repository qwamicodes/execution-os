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
import { useNavigate } from "@tanstack/react-router";
import { goeyToast as toast } from "goey-toast";
import { useState } from "react";
import { useSessionSounds } from "@/hooks/use-session-sounds";
import {
	useActiveSession,
	useExtendSession,
	useStartSession,
} from "@/hooks/use-sessions";
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
	const extendSession = useExtendSession();
	const { data: activeSession } = useActiveSession();
	const navigate = useNavigate();
	const { primeSessionAudio, playSessionStart, playSessionError } =
		useSessionSounds();

	async function handleStart() {
		await primeSessionAudio();
		const selectedMinutes = Number(duration);
		if (activeSession) {
			if (activeSession.taskId === task.id) {
				extendSession.mutate(
					{
						id: activeSession.id,
						data: { minutes: selectedMinutes },
					},
					{
						onSuccess: () => {
							playSessionStart();
							toast.success(`Session extended by ${selectedMinutes} minutes`);
							onOpenChange(false);
							navigate({
								to: "/sessions/$sessionId",
								params: { sessionId: activeSession.id },
							});
						},
						onError: (error) => {
							playSessionError();
							toast.error(error.message);
						},
					},
				);
				return;
			}

			toast.info("You already have an active session. Redirecting to it.");
			onOpenChange(false);
			navigate({
				to: "/sessions/$sessionId",
				params: { sessionId: activeSession.id },
			});
			return;
		}

		startSession.mutate(
			{
				taskId: task.id,
				duration: selectedMinutes,
			},
			{
				onSuccess: (session) => {
					playSessionStart();
					toast.success("Session started");
					onOpenChange(false);
					navigate({
						to: "/sessions/$sessionId",
						params: { sessionId: session.id },
					});
				},
				onError: (error) => {
					playSessionError();
					toast.error(error.message);
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Start focus session</DialogTitle>
					<DialogDescription>
						Choose a focused block for the selected task.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="max-w-md">
						<p className="text-sm text-muted-foreground">Task</p>
						<p className="font-medium line-clamp-2 wrap-break-word">
							{task.title}
						</p>
					</div>

					<div className="space-y-2">
						<Label>Duration</Label>
						<RadioGroup
							value={duration}
							onValueChange={setDuration}
							className="flex flex-wrap"
						>
							{DURATIONS.map((d) => (
								<Label
									key={d.value}
									htmlFor={`dur-${d.value}`}
									className={`flex cursor-pointer items-center justify-center rounded-lg border-2 p-2 text-sm font-medium transition-colors min-w-20 ${
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

					<div className="flex justify-end gap-2 border-t pt-4">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							className="bg-primary text-primary-foreground hover:bg-primary/90"
							onClick={handleStart}
							disabled={startSession.isPending || extendSession.isPending}
						>
							{startSession.isPending || extendSession.isPending
								? "Saving..."
								: activeSession?.taskId === task.id
									? "Extend session"
									: "Start"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
