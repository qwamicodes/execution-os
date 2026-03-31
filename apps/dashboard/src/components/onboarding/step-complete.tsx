import { Button } from "@repo/ui/components/ui/button";
import {
	CheckSquare,
	FolderOpen,
	Inbox,
	PartyPopper,
	Timer,
} from "lucide-react";

interface StepCompleteProps {
	projectName: string;
	taskTitle?: string;
	onComplete: () => void;
}

const features = [
	{
		icon: Inbox,
		title: "Inbox",
		description: "Capture tasks quickly and classify them later",
	},
	{
		icon: CheckSquare,
		title: "Tasks",
		description: "Track work through states: Ready, Active, Done",
	},
	{
		icon: Timer,
		title: "Focus Sessions",
		description: "Time-boxed work sessions with scratchpad",
	},
	{
		icon: FolderOpen,
		title: "Projects",
		description: "Organize tasks into Clients, Office, Core, and SideQuests",
	},
];

export function StepComplete({
	projectName,
	taskTitle,
	onComplete,
}: StepCompleteProps) {
	return (
		<div className="flex flex-col items-center text-center">
			<div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900">
				<PartyPopper className="h-8 w-8 text-green-600 dark:text-green-400" />
			</div>

			<h2 className="mb-2 text-2xl font-bold tracking-tight">
				You&apos;re all set!
			</h2>
			<p className="mb-2 max-w-md text-muted-foreground">
				Your workspace is ready. Here&apos;s what you created:
			</p>

			<div className="mb-8 flex flex-col gap-1 text-sm">
				<p>
					📁 Project: <strong>{projectName}</strong>
				</p>
				{taskTitle && (
					<p>
						✅ Task: <strong>{taskTitle}</strong>
					</p>
				)}
			</div>

			{/* Feature overview */}
			<div className="mb-8 grid w-full max-w-md grid-cols-2 gap-3">
				{features.map((feature) => (
					<div
						key={feature.title}
						className="flex flex-col items-center gap-2 rounded-lg border p-4"
					>
						<feature.icon className="h-5 w-5 text-muted-foreground" />
						<span className="text-sm font-medium">{feature.title}</span>
						<span className="text-xs text-muted-foreground">
							{feature.description}
						</span>
					</div>
				))}
			</div>

			<Button size="lg" className="w-full max-w-sm" onClick={onComplete}>
				Go to Dashboard
			</Button>
		</div>
	);
}
