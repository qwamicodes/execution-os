import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import type { ReactNode } from "react";

interface AuthCardProps {
	title: string;
	description: string;
	children: ReactNode;
	footer?: ReactNode;
}

export function AuthCard({
	title,
	description,
	children,
	footer,
}: AuthCardProps) {
	return (
		<Card>
			<CardHeader className="text-center">
				<div className="mb-2 flex items-center justify-center gap-2">
					<img
						src="/favicon.svg"
						alt="Execution OS logo"
						className="h-8 w-8 rounded-md"
					/>
					<span className="text-2xl font-bold tracking-tight">Execution OS</span>
				</div>
				<CardTitle className="text-xl">{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				{children}
				{footer && (
					<div className="mt-6 text-center text-sm text-muted-foreground">
						{footer}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
