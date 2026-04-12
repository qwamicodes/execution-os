import { Button } from "@repo/ui/components/ui/button";
import { Calendar } from "@repo/ui/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";
import { Calendar as CalendarIcon } from "lucide-react";
import moment from "moment";

type DateBoundary = "start" | "end" | "none";

interface DatePickerProps {
	value?: string | null;
	onChange: (next: string | undefined) => void;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	boundary?: DateBoundary;
}

function toIso(date: Date, boundary: DateBoundary) {
	const m = moment(date);
	if (boundary === "start") return m.startOf("day").toISOString();
	if (boundary === "end") return m.endOf("day").toISOString();
	return m.toISOString();
}

export function DatePicker({
	value,
	onChange,
	placeholder = "Pick a date",
	className,
	disabled = false,
	boundary = "end",
}: DatePickerProps) {
	const parsed = value && moment(value).isValid() ? moment(value).toDate() : undefined;
	const label =
		parsed && moment(parsed).isValid()
			? moment(parsed).format("MMM D, YYYY")
			: placeholder;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					disabled={disabled}
					className={cn(
						"w-full justify-start text-left font-normal",
						!parsed && "text-muted-foreground",
						className,
					)}
				>
					<CalendarIcon className="mr-2 h-4 w-4" />
					{label}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={parsed}
					onSelect={(selected) => {
						if (!selected) {
							onChange(undefined);
							return;
						}
						onChange(toIso(selected, boundary));
					}}
					autoFocus
				/>
			</PopoverContent>
		</Popover>
	);
}
