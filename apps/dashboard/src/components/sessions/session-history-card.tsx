import { Badge } from "@repo/ui/components/ui/badge";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import {
	formatDate,
	formatLoggedDuration,
	SESSION_OUTCOME_CONFIG,
} from "@/lib/constants";
import type { Session } from "@/lib/types";

interface SessionHistoryCardProps {
	session: Session;
}

export function SessionHistoryCard({ session }: SessionHistoryCardProps) {
	const outcomeConfig = session.outcome
		? SESSION_OUTCOME_CONFIG[session.outcome]
		: null;

	const actualMinutes = session.actualDuration ?? session.duration;

	return (
		<Card className="border-border bg-card shadow-sm transition-colors hover:bg-accent/30">
			<CardContent className="p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						{session.task ? (
							<Link
								to="/tasks/$taskId"
								params={{ taskId: session.taskId }}
								className="block truncate font-medium text-foreground transition-colors hover:text-muted-foreground"
							>
								{session.task.title}
							</Link>
						) : (
							<p className="truncate font-medium text-foreground">
								Task #{session.taskId.slice(0, 8)}
							</p>
						)}

						<div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
							{outcomeConfig && (
								<Badge variant={outcomeConfig.badge}>
									{outcomeConfig.label}
								</Badge>
							)}
							<span className="inline-flex items-center gap-1">
								<Clock className="h-3 w-3" />
								{formatLoggedDuration(actualMinutes)}
							</span>
							<span>
								{formatDate(session.completedAt || session.startedAt)}
							</span>
						</div>

						{session.notes && (
							<p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
								{session.notes}
							</p>
						)}

						{session.blockerNote && (
							<p className="mt-1 line-clamp-1 text-sm text-red-500 dark:text-red-400">
								Blocker: {session.blockerNote}
							</p>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
