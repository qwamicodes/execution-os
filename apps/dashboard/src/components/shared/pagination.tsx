import { Button } from "@repo/ui/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

export function Pagination({
	currentPage,
	totalPages,
	onPageChange,
}: PaginationProps) {
	if (totalPages <= 1) return null;

	const pages: number[] = [];
	const maxVisible = 5;
	let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
	const end = Math.min(totalPages, start + maxVisible - 1);

	if (end - start + 1 < maxVisible) {
		start = Math.max(1, end - maxVisible + 1);
	}

	for (let i = start; i <= end; i++) {
		pages.push(i);
	}

	return (
		<div className="flex items-center justify-center gap-1 pt-4">
			<Button
				variant="outline"
				size="sm"
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage <= 1}
			>
				<ChevronLeft className="h-4 w-4" />
			</Button>

			{start > 1 && (
				<>
					<Button variant="ghost" size="sm" onClick={() => onPageChange(1)}>
						1
					</Button>
					{start > 2 && <span className="px-1 text-muted-foreground">...</span>}
				</>
			)}

			{pages.map((page) => (
				<Button
					key={page}
					variant={page === currentPage ? "default" : "ghost"}
					size="sm"
					onClick={() => onPageChange(page)}
				>
					{page}
				</Button>
			))}

			{end < totalPages && (
				<>
					{end < totalPages - 1 && (
						<span className="px-1 text-muted-foreground">...</span>
					)}
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onPageChange(totalPages)}
					>
						{totalPages}
					</Button>
				</>
			)}

			<Button
				variant="outline"
				size="sm"
				onClick={() => onPageChange(currentPage + 1)}
				disabled={currentPage >= totalPages}
			>
				<ChevronRight className="h-4 w-4" />
			</Button>
		</div>
	);
}
