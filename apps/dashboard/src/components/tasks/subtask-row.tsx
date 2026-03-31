import { Badge } from "@repo/ui/components/ui/badge";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { TASK_STATE_CONFIG } from "@/lib/constants";
import type { Task, TaskState } from "@/lib/types";

interface SubtaskRowProps {
	task: Task;
	onStateChange?: (taskId: string, newState: TaskState) => void;
	onSelect?: (taskId: string) => void;
}

export function SubtaskRow({ task, onStateChange, onSelect }: SubtaskRowProps) {
	const stateConfig = TASK_STATE_CONFIG[task.state];

	return (
		<div
			className={`group flex items-center gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white ${onSelect ? "cursor-pointer" : ""}`}
			onClick={() => onSelect?.(task.id)}
		>
			<Checkbox
				checked={task.state === "Done"}
				onCheckedChange={(checked) => {
					if (onStateChange) {
						onStateChange(task.id, checked ? "Done" : "Ready");
					}
				}}
				onClick={(e) => e.stopPropagation()}
			/>
			<span
				className={`flex-1 text-sm text-slate-800 ${task.state === "Done" ? "line-through text-slate-500" : ""}`}
			>
				{task.title}
			</span>
			<Badge
				variant="outline"
				className={`border-0 text-xs shadow-sm ${stateConfig.color}`}
			>
				{stateConfig.label}
			</Badge>
		</div>
	);
}
