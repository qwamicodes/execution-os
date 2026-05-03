import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { CircleHelp } from "lucide-react";

interface HelpTooltipProps {
	feature: string;
	what: string;
	use: string;
	works: string;
	className?: string;
}

export function HelpTooltip({
	feature,
	what,
	use,
	works,
	className,
}: HelpTooltipProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={`Help for ${feature}`}
					className={cn(
						"inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-muted-foreground",
						className,
					)}
				>
					<CircleHelp className="h-4 w-4" />
				</button>
			</TooltipTrigger>
			<TooltipContent
				side="top"
				align="start"
				className="max-w-[320px] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl"
			>
				<p className="text-xs font-semibold tracking-[0.12em] uppercase">
					{feature}
				</p>
				<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
					<span className="font-semibold text-foreground">What:</span> {what}
				</p>
				<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
					<span className="font-semibold text-foreground">Use:</span> {use}
				</p>
				<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
					<span className="font-semibold text-foreground">Works:</span> {works}
				</p>
			</TooltipContent>
		</Tooltip>
	);
}
