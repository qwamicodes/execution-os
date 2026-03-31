import { Badge } from "@repo/ui/components/ui/badge";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import type { ReactNode } from "react";
import { HelpTooltip } from "@/components/shared/help-tooltip";

interface RouteHeroHeaderProps {
	eyebrow?: string;
	title: string;
	description?: string;
	badges?: ReactNode;
	action?: ReactNode;
	help?: {
		feature: string;
		what: string;
		use: string;
		works: string;
	};
}

export function RouteHeroHeader({
	eyebrow = "Execution Flow",
	title,
	description,
	badges,
	action,
	help,
}: RouteHeroHeaderProps) {
	return (
		<Card className="overflow-hidden border-sky-100 bg-gradient-to-br from-white via-slate-50/70 to-sky-50/80 shadow-lg shadow-slate-200/60">
			<CardContent className="flex flex-wrap items-start justify-between gap-4 p-6 sm:p-7">
				<div>
					<p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase">
						{eyebrow}
					</p>
					<div className="mt-2 flex items-center gap-2">
						<h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
							{title}
						</h1>
						{help ? <HelpTooltip {...help} className="h-6 w-6" /> : null}
					</div>
					{description && (
						<p className="mt-2 max-w-2xl text-sm text-slate-600">
							{description}
						</p>
					)}
					{badges && (
						<div className="mt-4 flex flex-wrap items-center gap-2">
							{badges}
						</div>
					)}
				</div>
				{action ? <div className="w-full sm:w-auto">{action}</div> : null}
			</CardContent>
		</Card>
	);
}

export function RouteHeroBadge({
	children,
	variant = "secondary",
	className = "",
}: {
	children: ReactNode;
	variant?: "default" | "secondary" | "outline" | "destructive";
	className?: string;
}) {
	return (
		<Badge variant={variant} className={className}>
			{children}
		</Badge>
	);
}
