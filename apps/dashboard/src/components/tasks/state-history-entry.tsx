import { formatRelativeTime, TASK_STATE_CONFIG } from "@/lib/constants";
import type { StateHistory } from "@/lib/types";

interface StateHistoryEntryProps {
	entry: StateHistory;
}

export function StateHistoryEntry({ entry }: StateHistoryEntryProps) {
	const fromConfig = TASK_STATE_CONFIG[entry.fromState];
	const toConfig = TASK_STATE_CONFIG[entry.toState];

	return (
		<div className="flex items-start gap-3 rounded-lg border border-slate-200/70 bg-slate-50/65 px-3 py-2.5">
			<div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-400/60" />
			<div className="min-w-0 flex-1">
				<p className="text-sm text-slate-700">
					<span className={fromConfig.color.split(" ")[0]}>
						{fromConfig.label}
					</span>
					<span className="mx-1.5 text-slate-400">→</span>
					<span className={toConfig.color.split(" ")[0]}>{toConfig.label}</span>
				</p>
				{entry.reason && (
					<p className="mt-0.5 text-xs text-slate-500">{entry.reason}</p>
				)}
				<p className="text-xs text-slate-400">
					{formatRelativeTime(entry.createdAt)}
				</p>
			</div>
		</div>
	);
}
