import { useEffect, useState } from "react";
import { formatSessionTime } from "@/lib/constants";
import type { Session } from "@/lib/types";

interface SessionTimerResult {
	remainingSeconds: number;
	formattedTime: string;
	isExpired: boolean;
	progress: number;
}

export function useSessionTimer(session: Session | null): SessionTimerResult {
	const [remainingSeconds, setRemainingSeconds] = useState(0);

	useEffect(() => {
		if (!session) {
			setRemainingSeconds(0);
			return;
		}

		function calculateRemaining() {
			if (!session) return 0;

			if (session.state === "Paused") {
				// When paused, show frozen time based on when it was paused
				if (session.pausedAt) {
					const expiresAt = new Date(session.expiresAt).getTime();
					const pausedAt = new Date(session.pausedAt).getTime();
					return Math.max(0, Math.floor((expiresAt - pausedAt) / 1000));
				}
				return 0;
			}

			// Active: calculate from expiresAt
			const expiresAt = new Date(session.expiresAt).getTime();
			const now = Date.now();
			return Math.max(0, Math.floor((expiresAt - now) / 1000));
		}

		setRemainingSeconds(calculateRemaining());

		if (session.state === "Paused") return;

		const interval = setInterval(() => {
			setRemainingSeconds(calculateRemaining());
		}, 1000);

		return () => clearInterval(interval);
	}, [session, session?.state, session?.expiresAt, session?.pausedAt]);

	const totalSeconds = session ? session.duration * 60 : 0;
	const elapsed = totalSeconds - remainingSeconds;
	const progress = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0;

	return {
		remainingSeconds,
		formattedTime: formatSessionTime(remainingSeconds),
		isExpired: remainingSeconds <= 0 && session?.state === "Active",
		progress: Math.min(100, progress),
	};
}
