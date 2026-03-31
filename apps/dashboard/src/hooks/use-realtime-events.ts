import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const EVENT_NAMES = [
	"task.created",
	"task.updated",
	"task.deleted",
	"task.restored",
	"task.state_changed",
	"task.bulk_created",
	"task.branch_created",
	"session.started",
	"session.paused",
	"session.resumed",
	"session.completed",
	"session.scratchpad_updated",
	"project.created",
	"project.updated",
	"project.deleted",
	"inbox.classified",
	"inbox.classified_auto",
	"integration.updated",
	"integration.voice.transcribe_requested",
	"integration.voice.transcribe_completed",
] as const;

function shouldRefreshSessions(eventType: string) {
	return eventType.startsWith("session.");
}

function shouldRefreshProjects(eventType: string) {
	return eventType.startsWith("project.");
}

function shouldRefreshIntegrations(eventType: string) {
	return eventType.startsWith("integration.");
}

export function useRealtimeEvents() {
	const queryClient = useQueryClient();

	useEffect(() => {
		if (typeof window === "undefined") return;

		const eventSource = new EventSource(`${API_BASE_URL}/api/v1/events/stream`, {
			withCredentials: true,
		});

		const onEvent = (event: Event) => {
			const message = event as MessageEvent<string>;
			let eventType = event.type;
			try {
				const parsed = JSON.parse(message.data) as {
					type?: string;
					data?: Record<string, unknown>;
				};
				if (parsed.type) eventType = parsed.type;
			} catch {
				// ignore invalid payloads
			}

			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: queryKeys.ai.recommendation() });
			if (shouldRefreshSessions(eventType)) {
				queryClient.invalidateQueries({ queryKey: queryKeys.sessions.active });
				queryClient.invalidateQueries({
					queryKey: queryKeys.sessions.history(),
				});
			}
			if (shouldRefreshProjects(eventType)) {
				queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
			}
			if (shouldRefreshIntegrations(eventType)) {
				queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
			}
		};

		for (const eventName of EVENT_NAMES) {
			eventSource.addEventListener(eventName, onEvent as EventListener);
		}

		return () => {
			for (const eventName of EVENT_NAMES) {
				eventSource.removeEventListener(eventName, onEvent as EventListener);
			}
			eventSource.close();
		};
	}, [queryClient]);
}
