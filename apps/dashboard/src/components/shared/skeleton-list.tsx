import { Skeleton } from "@repo/ui/components/ui/skeleton";

interface SkeletonListProps {
	count?: number;
}

export function SkeletonList({ count = 3 }: SkeletonListProps) {
	return (
		<div className="space-y-3">
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={`skeleton-${i + 1}`}
					className="rounded-lg border p-4 space-y-3"
				>
					<Skeleton className="h-5 w-3/4" />
					<Skeleton className="h-4 w-1/2" />
					<div className="flex gap-2">
						<Skeleton className="h-5 w-16 rounded-full" />
						<Skeleton className="h-5 w-12 rounded-full" />
						<Skeleton className="h-5 w-20 rounded-full" />
					</div>
				</div>
			))}
		</div>
	);
}
