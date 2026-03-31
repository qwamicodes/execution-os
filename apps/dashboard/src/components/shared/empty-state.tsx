import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
	icon: LucideIcon;
	title: string;
	description: string;
	children?: React.ReactNode;
}

export function EmptyState({
	icon: Icon,
	title,
	description,
	children,
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12 text-center">
			<div className="mb-4 rounded-full bg-muted p-3">
				<Icon className="h-6 w-6 text-muted-foreground" />
			</div>
			<h3 className="mb-1 text-lg font-semibold">{title}</h3>
			<p className="mb-4 max-w-sm text-sm text-muted-foreground">
				{description}
			</p>
			{children}
		</div>
	);
}
