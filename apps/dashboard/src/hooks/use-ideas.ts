import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ideas, tasks } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
	CreateIdeaInput,
	IdeaFilters,
	UpdateIdeaInput,
} from "@/lib/types";

export function useIdeas(filters?: IdeaFilters) {
	return useQuery({
		queryKey: queryKeys.ideas.list(filters),
		queryFn: () => ideas.list(filters),
	});
}

export function useIdea(id: string) {
	return useQuery({
		queryKey: queryKeys.ideas.detail(id),
		queryFn: () => ideas.get(id),
		enabled: Boolean(id),
	});
}

export function useCreateIdea() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreateIdeaInput) => ideas.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
		},
	});
}

export function useUpdateIdea() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateIdeaInput }) =>
			ideas.update(id, data),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.ideas.detail(variables.id),
			});
		},
	});
}

export function useDeleteIdea() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => ideas.delete(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
		},
	});
}

export function useConvertIdeaToTask() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => ideas.convertToTask(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}

export function useConvertIdeaToProject() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => ideas.convertToProject(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

export function useClassifyIdeaAI() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => ideas.classifyAI(id),
		onSuccess: (_data, id) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.ideas.detail(id) });
		},
	});
}

export function useMigrateLegacyIdeaTasks() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => ideas.migrateLegacyIdeas(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
		},
	});
}

export function useConvertTaskToIdea() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (taskId: string) => tasks.convertToIdea(taskId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.ideas.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}
