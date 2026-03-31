import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inbox } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ClassifyTaskInput } from "@/lib/types";

export function useInbox() {
	return useQuery({
		queryKey: queryKeys.inbox,
		queryFn: () => inbox.list(),
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
