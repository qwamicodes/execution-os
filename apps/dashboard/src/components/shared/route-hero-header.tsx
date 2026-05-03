import { Badge, type BadgeVariant } from "@repo/ui/components/ui/badge";
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
	eyebrow,
	title,
	description,
	badges,
	action,
	help,
}: RouteHeroHeaderProps) {
	return (
		<div className="flex flex-wrap items-start justify-between gap-4">
			<div className="min-w-0">
				{eyebrow && (
					<p className="mb-1.5 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
						{eyebrow}
					</p>
				)}
				<div className="flex items-center gap-2">
					<h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
						{title}
					</h1>
					{help ? <HelpTooltip {...help} className="h-5 w-5" /> : null}
				</div>
				{description && (
					<p className="mt-1.5 max-w-2xl text-sm text-muted-foreground leading-relaxed">
						{description}
					</p>
				)}
				{badges && (
					<div className="mt-3 flex flex-wrap items-center gap-1.5">
						{badges}
					</div>
				)}
			</div>
			{action ? (
				<div className="shrink-0 w-full sm:w-auto">
					{action}
				</div>
			) : null}
		</div>
	);
}

export function RouteHeroBadge({
	children,
	variant = "secondary",
	className = "",
}: {
	children: ReactNode;
	variant?: BadgeVariant;
	className?: string;
}) {
	return (
		<Badge variant={variant} className={`text-xs ${className}`}>
			{children}
		</Badge>
	);
}
