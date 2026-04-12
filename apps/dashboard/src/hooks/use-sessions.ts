import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessions } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
	CompleteSessionInput,
	ExtendSessionInput,
	SessionHistoryFilters,
	StartSessionInput,
} from "@/lib/types";

export function useActiveSession() {
	return useQuery({
		queryKey: queryKeys.sessions.active,
		queryFn: () => sessions.getActive(),
		refetchInterval: (query) => {
			// Poll every 30s only when there's an active session
			return query.state.data ? 30_000 : false;
		},
	});
}

export function useSession(id: string) {
	return useQuery({
		queryKey: queryKeys.sessions.detail(id),
		queryFn: () => sessions.getById(id),
		enabled: Boolean(id),
	});
}

export function useStartSession() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: StartSessionInput) => sessions.start(data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.sessions.active,
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.sessions.history() });
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}

export function usePauseSession() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => sessions.pause(id),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.sessions.active,
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.sessions.history() });
			queryClient.invalidateQueries({ queryKey: ["sessions", "detail"] });
		},
	});
}

export function useResumeSession() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => sessions.resume(id),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.sessions.active,
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.sessions.history() });
			queryClient.invalidateQueries({ queryKey: ["sessions", "detail"] });
		},
	});
}

export function useExtendSession() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: ExtendSessionInput }) =>
			sessions.extend(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.sessions.active,
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.sessions.history() });
			queryClient.invalidateQueries({ queryKey: ["sessions", "detail"] });
		},
	});
}

export function useCompleteSession() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: CompleteSessionInput }) =>
			sessions.complete(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.sessions.active,
			});
			queryClient.invalidateQueries({ queryKey: ["sessions", "detail"] });
			queryClient.invalidateQueries({ queryKey: queryKeys.sessions.history() });
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}

export function useUpdateScratchpad() {
	return useMutation({
		mutationFn: ({ id, content }: { id: string; content: string }) =>
			sessions.updateScratchpad(id, content),
	});
}

export function useSessionHistory(filters?: SessionHistoryFilters) {
	return useQuery({
		queryKey: queryKeys.sessions.history(filters),
		queryFn: () => sessions.history(filters),
	});
}
