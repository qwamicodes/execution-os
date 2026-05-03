import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { projects } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
	BatchApplyProjectTasksInput,
	CreateProjectEpicInput,
	CreateProjectInput,
	CreateProjectMilestoneInput,
	CreateProjectPartInput,
	ProjectFilters,
	UpdateProjectEpicInput,
	UpdateProjectInput,
	UpdateProjectMilestoneInput,
	UpdateProjectPartInput,
} from "@/lib/types";

export function useProjects(filters?: ProjectFilters) {
	return useQuery({
		queryKey: queryKeys.projects.list(filters),
		queryFn: () => projects.list(filters),
	});
}

export function useProject(id: string) {
	return useQuery({
		queryKey: queryKeys.projects.detail(id),
		queryFn: () => projects.get(id),
		enabled: !!id,
	});
}

export function useCreateProject() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateProjectInput) => projects.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

export function useUpdateProject() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateProjectInput }) =>
			projects.update(id, data),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.detail(variables.id),
			});
		},
	});
}

export function useDeleteProject() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return useMutation({
		mutationFn: (id: string) => projects.delete(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
			navigate({ to: "/projects" });
		},
	});
}

export function useProjectMilestones(projectId: string) {
	return useQuery({
		queryKey: queryKeys.projects.milestones(projectId),
		queryFn: () => projects.listMilestones(projectId),
		enabled: !!projectId,
	});
}

export function useCreateProjectMilestone(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreateProjectMilestoneInput) =>
			projects.createMilestone(projectId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.milestones(projectId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.detail(projectId),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

export function useUpdateProjectMilestone(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			milestoneId,
			data,
		}: {
			milestoneId: string;
			data: UpdateProjectMilestoneInput;
		}) => projects.updateMilestone(projectId, milestoneId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.milestones(projectId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.detail(projectId),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

export function useDeleteProjectMilestone(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (milestoneId: string) =>
			projects.deleteMilestone(projectId, milestoneId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.milestones(projectId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.detail(projectId),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

export function useProjectParts(projectId: string) {
	return useQuery({
		queryKey: queryKeys.projects.parts(projectId),
		queryFn: () => projects.listParts(projectId),
		enabled: !!projectId,
	});
}

export function useCreateProjectPart(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreateProjectPartInput) =>
			projects.createPart(projectId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.parts(projectId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.detail(projectId),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

export function useUpdateProjectPart(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			partId,
			data,
		}: {
			partId: string;
			data: UpdateProjectPartInput;
		}) => projects.updatePart(projectId, partId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.parts(projectId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.detail(projectId),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

export function useDeleteProjectPart(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (partId: string) => projects.deletePart(projectId, partId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.parts(projectId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.detail(projectId),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

export function useProjectEpics(projectId: string) {
	return useQuery({
		queryKey: queryKeys.projects.epics(projectId),
		queryFn: () => projects.listEpics(projectId),
		enabled: !!projectId,
	});
}

export function useCreateProjectEpic(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreateProjectEpicInput) =>
			projects.createEpic(projectId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.epics(projectId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.detail(projectId),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

export function useUpdateProjectEpic(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			epicId,
			data,
		}: {
			epicId: string;
			data: UpdateProjectEpicInput;
		}) => projects.updateEpic(projectId, epicId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.epics(projectId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.detail(projectId),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

export function useDeleteProjectEpic(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (epicId: string) => projects.deleteEpic(projectId, epicId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.epics(projectId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.detail(projectId),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		},
	});
}

export function useBatchApplyProjectTasks(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: BatchApplyProjectTasksInput) =>
			projects.batchApplyTasks(projectId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.detail(projectId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.milestones(projectId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.projects.epics(projectId),
			});
			queryClient.invalidateQueries({ queryKey: ["ai", "recommendation"] });
		},
	});
}
