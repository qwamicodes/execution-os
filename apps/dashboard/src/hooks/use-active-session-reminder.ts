import { useEffect, useRef } from "react";
import { goeyToast as toast } from "goey-toast";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@/lib/types";

const REMINDER_INTERVAL_MS = 5 * 60 * 1000;

export function useActiveSessionReminder(
	activeSession: Session | null | undefined,
	pathname: string,
) {
	const navigate = useNavigate();
	const lastReminderAt = useRef<number>(0);

	useEffect(() => {
		if (!activeSession) return;
		if (activeSession.state !== "Active" && activeSession.state !== "Paused") return;

		const activePath = `/sessions/${activeSession.id}`;
		if (pathname === activePath) return;

		const notify = () => {
			const now = Date.now();
			if (now - lastReminderAt.current < REMINDER_INTERVAL_MS) return;
			lastReminderAt.current = now;

			toast.info("Active focus session reminder", {
				description: activeSession.task?.title
					? `You are still focused on: ${activeSession.task.title}`
					: "You still have an active focus session running.",
				action: {
					label: "Open session",
					successLabel: "Opened",
					onClick: () => {
						navigate({
							to: "/sessions/$sessionId",
							params: { sessionId: activeSession.id },
						});
					},
				},
			});

			if (
				typeof window !== "undefined" &&
				document.hidden &&
				"Notification" in window &&
				Notification.permission === "granted"
			) {
				new Notification("Active focus session", {
					body: activeSession.task?.title
						? `Still running: ${activeSession.task.title}`
						: "You have an active focus session running.",
				});
			}
		};

		const interval = setInterval(notify, REMINDER_INTERVAL_MS);
		const visibilityHandler = () => {
			if (document.hidden) {
				notify();
			}
		};
		document.addEventListener("visibilitychange", visibilityHandler);

		return () => {
			clearInterval(interval);
			document.removeEventListener("visibilitychange", visibilityHandler);
		};
	}, [activeSession, pathname, navigate]);
}
