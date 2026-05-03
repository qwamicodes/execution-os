import { cn } from "@repo/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const badgeVariants = cva(
	"inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
	{
		variants: {
			variant: {
				// ── Base ─────────────────────────────────────────────────────────
				default: "border-transparent bg-primary text-primary-foreground shadow",
				secondary: "border-transparent bg-secondary text-secondary-foreground",
				destructive:
					"border-transparent bg-destructive text-destructive-foreground shadow",
				outline: "border-border text-foreground",

				// ── Semantic — theme-aware, works in light + dark ─────────────────

				/** Gray — Inbox, Low urgency, tags */
				neutral:
					"border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-400",

				/** Blue — Ready, Continue, info */
				info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/50 dark:text-blue-400",

				/** Amber — Ongoing, High urgency */
				warning:
					"border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-400",

				/** Red — Blocked, Urgent, danger states */
				danger:
					"border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-950/50 dark:text-red-400",

				/** Yellow — Paused, Medium urgency */
				caution:
					"border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-700/50 dark:bg-yellow-900/30 dark:text-yellow-400",

				/** Green — Active */
				success:
					"border-green-200 bg-green-50 text-green-700 dark:border-green-800/50 dark:bg-green-950/50 dark:text-green-400",

				/** Emerald — Done / completed */
				done: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-400",

				/** Orange — Large/Huge sizes, TooBig session outcome */
				orange:
					"border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/50 dark:bg-orange-950/50 dark:text-orange-400",

				/** Violet — Epics */
				purple:
					"border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/50 dark:text-violet-400",

				/** Sky blue — Project parts, monorepo areas */
				sky: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/50 dark:text-sky-400",

				/** Primary lavender — Project type, counts, highlights */
				lavender:
					"border-primary/25 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/15",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export type BadgeVariant = NonNullable<
	VariantProps<typeof badgeVariants>["variant"]
>;

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge, badgeVariants };
