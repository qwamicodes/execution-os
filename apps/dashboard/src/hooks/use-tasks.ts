import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasks } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
	CreateTaskInput,
	TaskFilters,
	UpdateTaskInput,
} from "@/lib/types";

export function useTasks(filters?: TaskFilters) {
	return useQuery({
		queryKey: queryKeys.tasks.list(filters),
		queryFn: () => tasks.list(filters),
	});
}

export function useTask(id: string) {
	return useQuery({
		queryKey: queryKeys.tasks.detail(id),
		queryFn: () => tasks.get(id),
		enabled: !!id,
	});
}

export function useCreateTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateTaskInput) => tasks.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}

export function useUpdateTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) =>
			tasks.update(id, data),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.tasks.detail(variables.id),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}

export function useDeleteTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => tasks.delete(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}

export function useRestoreTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => tasks.restore(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}

export function useDecomposeTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => tasks.decompose(id),
		onSuccess: (_data, id) => {
			const refreshKeys = () => {
				queryClient.invalidateQueries({
					queryKey: queryKeys.tasks.detail(id),
				});
				queryClient.invalidateQueries({
					queryKey: queryKeys.tasks.subtasks(id),
				});
				queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			};

			// Decomposition is async server-side; refresh a few times to surface new subtasks quickly.
			refreshKeys();
			setTimeout(refreshKeys, 1000);
			setTimeout(refreshKeys, 2500);
			setTimeout(refreshKeys, 5000);

			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}

export function useAIClassifyTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => tasks.classifyAI(id),
		onSuccess: (_data, id) => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.tasks.detail(id),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}

export function useSubtasks(taskId: string) {
	return useQuery({
		queryKey: queryKeys.tasks.subtasks(taskId),
		queryFn: () => tasks.subtasks(taskId),
		enabled: !!taskId,
	});
}

export function useCreateTaskBranch() {
	return useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: string;
			data?: {
				baseBranch?: string;
				branchName?: string;
			};
		}) => tasks.createBranch(id, data),
	});
}
