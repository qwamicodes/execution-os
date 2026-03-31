import { Badge } from "@repo/ui/components/ui/badge";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { formatDate, SESSION_OUTCOME_CONFIG } from "@/lib/constants";
import type { Session } from "@/lib/types";

interface SessionHistoryCardProps {
	session: Session;
}

export function SessionHistoryCard({ session }: SessionHistoryCardProps) {
	const outcomeConfig = session.outcome
		? SESSION_OUTCOME_CONFIG[session.outcome]
		: null;

	const actualMinutes = session.actualDuration
		? Math.round(session.actualDuration / 60)
		: session.duration;

	return (
		<Card className="border-slate-200 bg-white/95 shadow-sm transition-colors hover:border-slate-300">
			<CardContent className="p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						{session.task ? (
							<Link
								to="/tasks/$taskId"
								params={{ taskId: session.taskId }}
								className="block truncate font-medium text-slate-900 transition-colors hover:text-slate-700"
							>
								{session.task.title}
							</Link>
						) : (
							<p className="truncate font-medium text-slate-900">
								Task #{session.taskId.slice(0, 8)}
							</p>
						)}

						<div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
							{outcomeConfig && (
								<Badge
									variant="outline"
									className={`border-0 text-xs ${outcomeConfig.color}`}
								>
									{outcomeConfig.label}
								</Badge>
							)}
							<span className="inline-flex items-center">
								<Clock className="mr-1 h-3 w-3" />
								{actualMinutes} min
							</span>
							<span>
								{formatDate(session.completedAt || session.startedAt)}
							</span>
						</div>

						{session.notes && (
							<p className="mt-2 line-clamp-2 text-sm text-slate-600">
								{session.notes}
							</p>
						)}

						{session.blockerNote && (
							<p className="mt-1 line-clamp-1 text-sm text-red-600">
								Blocker: {session.blockerNote}
							</p>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
