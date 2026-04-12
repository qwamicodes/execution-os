import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pmAi, tasks } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
	PMAIAnalyzeImagesInput,
	PMAIAnalyzeVideoInput,
	PMAIDecomposeTaskInput,
	PMAIIngestDocumentInput,
	PMAIPlanSprintInput,
	PMAIRebalanceSprintInput,
	PMAISuggestAssigneeInput,
	TaskPriorityOverrideInput,
} from "@/lib/types";

export function usePMAIAnalyzeVideo() {
	return useMutation({
		mutationFn: (data: PMAIAnalyzeVideoInput) => pmAi.analyzeVideo(data),
	});
}

export function usePMAIAnalyzeImages() {
	return useMutation({
		mutationFn: (data: PMAIAnalyzeImagesInput) => pmAi.analyzeImages(data),
	});
}

export function usePMAIDecomposeTask() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: PMAIDecomposeTaskInput) => pmAi.decomposeTask(data),
		onSuccess: (_result, variables) => {
			const taskId = variables.taskId;
			const refreshKeys = () => {
				queryClient.invalidateQueries({
					queryKey: queryKeys.tasks.detail(taskId),
				});
				queryClient.invalidateQueries({
					queryKey: queryKeys.tasks.subtasks(taskId),
				});
				queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			};

			// Decomposition jobs complete asynchronously; do staggered refreshes.
			refreshKeys();
			setTimeout(refreshKeys, 1000);
			setTimeout(refreshKeys, 2500);
			setTimeout(refreshKeys, 5000);

			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
		},
	});
}

export function usePMAISuggestAssignee() {
	return useMutation({
		mutationFn: (data: PMAISuggestAssigneeInput) => pmAi.suggestAssignee(data),
	});
}

export function usePMAIPlanSprint() {
	return useMutation({
		mutationFn: (data: PMAIPlanSprintInput) => pmAi.planSprint(data),
	});
}

export function usePMAIRebalanceSprint() {
	return useMutation({
		mutationFn: (data: PMAIRebalanceSprintInput) => pmAi.rebalanceSprint(data),
	});
}

export function usePMAIIngestDocument() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: PMAIIngestDocumentInput) => pmAi.ingestDocument(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.ai.recommendation(),
			});
		},
	});
}

export function usePMAIIngestDocumentUpload() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: {
			file: File;
			documentType: "tsd" | "prd" | "contract" | "feature_spec";
			title?: string;
			feedbackInstructions?: string;
			projectId?: string;
			ideaTaskId?: string;
			usageMode?: "individual" | "team";
			teamMemberIds?: string[];
			createTasks?: boolean;
			createMilestones?: boolean;
			selectedMilestoneTitles?: string[];
			maxTasks?: number;
			maxMilestones?: number;
		}) => pmAi.ingestDocumentUpload(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.ai.recommendation(),
			});
		},
	});
}

export function usePMAIApproveDocumentPlan() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: {
			analysisId: string;
			documentType: "tsd" | "prd" | "contract" | "feature_spec";
			documentTitle: string;
			projectId?: string;
			ideaTaskId?: string;
			usageMode?: "individual" | "team";
			teamMemberIds?: string[];
			createTasks?: boolean;
			createMilestones?: boolean;
			selectedMilestoneTitles?: string[];
			maxTasks?: number;
			maxMilestones?: number;
			generation?: {
				provider?: string | null;
				model?: string | null;
			};
			plan: unknown;
		}) => pmAi.approveDocumentPlan(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.ai.recommendation(),
			});
		},
	});
}

export function useTaskPriorityExplain() {
	return useMutation({
		mutationFn: (taskId: string) => tasks.explainPriority(taskId),
	});
}

export function useTaskPriorityOverride() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			taskId,
			data,
		}: {
			taskId: string;
			data: TaskPriorityOverrideInput;
		}) => tasks.overridePriority(taskId, data),
		onSuccess: (_result, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.tasks.detail(variables.taskId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.ai.recommendation(),
			});
		},
	});
}

export function useTaskPriorityClearOverride() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (taskId: string) => tasks.clearPriorityOverride(taskId),
		onSuccess: (_result, taskId) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.tasks.detail(taskId),
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.ai.recommendation(),
			});
		},
	});
}

export function useTaskPriorityRecalculate() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => tasks.recalculatePriorities(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
			queryClient.invalidateQueries({
				queryKey: queryKeys.ai.recommendation(),
			});
		},
	});
}
