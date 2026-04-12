import { Badge } from "@repo/ui/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { TASK_STATE_CONFIG, VALID_TRANSITIONS } from "@/lib/constants";
import type { TaskState } from "@/lib/types";

interface TaskStateDropdownProps {
	currentState: TaskState;
	onStateChange: (newState: TaskState) => void;
	disabled?: boolean;
}

export function TaskStateDropdown({
	currentState,
	onStateChange,
	disabled,
}: TaskStateDropdownProps) {
	const config = TASK_STATE_CONFIG[currentState];
	const validTransitions = VALID_TRANSITIONS[currentState];

	if (validTransitions.length === 0 || disabled) {
		return (
			<Badge variant="outline" className={config.color}>
				<config.icon className="mr-1 h-3 w-3" />
				{config.label}
			</Badge>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Badge className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:opacity-80">
					<config.icon className="mr-1 inline h-3 w-3" />
					{config.label}
				</Badge>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				{validTransitions.map((state) => {
					const targetConfig = TASK_STATE_CONFIG[state];
					return (
						<DropdownMenuItem key={state} onClick={() => onStateChange(state)}>
							<targetConfig.icon
								className={`mr-2 h-4 w-4 ${targetConfig.color.split(" ")[0]}`}
							/>
							{targetConfig.label}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
