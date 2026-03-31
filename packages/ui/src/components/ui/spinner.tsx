import { cn } from "@repo/ui/lib/utils";

interface SpinnerProps {
	className?: string;
	size?: "sm" | "md" | "lg";
}

const sizeClasses = {
	sm: "size-4 border-2",
	md: "size-6 border-2",
	lg: "size-8 border-3",
};

export function Spinner({ className, size = "md" }: SpinnerProps) {
	return (
		<div
			role="status"
			aria-label="Loading"
			className={cn(
				"animate-spin rounded-full border-muted-foreground/25 border-t-foreground",
				sizeClasses[size],
				className,
			)}
		/>
	);
}
