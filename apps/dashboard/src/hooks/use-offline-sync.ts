import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { goeyToast as toast } from "goey-toast";
import { API_BASE_URL } from "@/lib/api";
import {
	getOfflineQueueSize,
	processOfflineQueue,
} from "@/lib/offline-queue";
import { queryKeys } from "@/lib/query-keys";

export function useOfflineSync() {
	const queryClient = useQueryClient();
	const [isOnline, setIsOnline] = useState(
		typeof navigator === "undefined" ? true : navigator.onLine,
	);
	const [isSyncing, setIsSyncing] = useState(false);
	const [queueSize, setQueueSize] = useState(getOfflineQueueSize());

	const refreshQueueSize = useCallback(() => {
		setQueueSize(getOfflineQueueSize());
	}, []);

	const flushQueue = useCallback(async () => {
		if (!navigator.onLine) return;
		setIsSyncing(true);
		const result = await processOfflineQueue({ apiBaseUrl: API_BASE_URL });
		setIsSyncing(false);
		refreshQueueSize();

		if (result.processed > 0) {
			toast.success(
				`Synced ${result.processed} offline change${result.processed > 1 ? "s" : ""}.`,
			);
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.sessions.active });
			queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
		}
	}, [queryClient, refreshQueueSize]);

	useEffect(() => {
		const handleOnline = () => {
			setIsOnline(true);
			void flushQueue();
		};
		const handleOffline = () => {
			setIsOnline(false);
			toast.warning("Offline mode enabled. Mutations will be queued.");
		};
		const handleQueued = () => {
			refreshQueueSize();
			toast.info("Action queued offline and will sync when connection returns.");
		};
		const handleQueueUpdated = () => {
			refreshQueueSize();
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		window.addEventListener("execution-os:offline-operation-queued", handleQueued);
		window.addEventListener(
			"execution-os:offline-queue-updated",
			handleQueueUpdated,
		);

		if (navigator.onLine) {
			void flushQueue();
		}

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
			window.removeEventListener(
				"execution-os:offline-operation-queued",
				handleQueued,
			);
			window.removeEventListener(
				"execution-os:offline-queue-updated",
				handleQueueUpdated,
			);
		};
	}, [flushQueue, refreshQueueSize]);

	return useMemo(
		() => ({
			isOnline,
			isSyncing,
			queueSize,
			flushQueue,
		}),
		[flushQueue, isOnline, isSyncing, queueSize],
	);
}
