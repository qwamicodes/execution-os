import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inbox } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ClassifyTaskInput, InboxFilters } from "@/lib/types";

export function useInbox(filters?: InboxFilters) {
	return useQuery({
		queryKey: queryKeys.inboxList(filters),
		queryFn: () => inbox.list(filters),
	});
}

export function useClassifyTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: ClassifyTaskInput }) =>
			inbox.classify(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}

export function useAutoClassifyTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => inbox.autoClassify(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}

export function useIgnoreAISuggestion() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => inbox.ignoreAISuggestion(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}

function invalidateInboxViews(queryClient: ReturnType<typeof useQueryClient>) {
	queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
	queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
	queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
}

export function useIgnoreAllAISuggestions() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => inbox.ignoreAllAISuggestions(),
		onSuccess: () => invalidateInboxViews(queryClient),
	});
}

export function useApplyAllAISuggestions() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => inbox.applyAllAISuggestions(),
		onSuccess: () => invalidateInboxViews(queryClient),
	});
}

export function useDeleteAllAISuggestions() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => inbox.deleteAllAISuggestions(),
		onSuccess: () => invalidateInboxViews(queryClient),
	});
}
