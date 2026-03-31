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
						"inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700",
						className,
					)}
				>
					<CircleHelp className="h-4 w-4" />
				</button>
			</TooltipTrigger>
			<TooltipContent
				side="top"
				align="start"
				className="max-w-[320px] rounded-xl border border-slate-700/80 bg-slate-950 p-3 text-slate-100 shadow-xl"
			>
				<p className="text-xs font-semibold tracking-[0.12em] uppercase">
					{feature}
				</p>
				<p className="mt-2 text-xs leading-relaxed text-slate-200">
					<span className="font-semibold text-white">What:</span> {what}
				</p>
				<p className="mt-1 text-xs leading-relaxed text-slate-200">
					<span className="font-semibold text-white">Use:</span> {use}
				</p>
				<p className="mt-1 text-xs leading-relaxed text-slate-200">
					<span className="font-semibold text-white">Works:</span> {works}
				</p>
			</TooltipContent>
		</Tooltip>
	);
}
