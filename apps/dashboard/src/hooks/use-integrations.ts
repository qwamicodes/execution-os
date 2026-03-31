import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { integrations } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type {
	GitConnectInput,
	GitImportCommitInput,
	VoiceConnectInput,
	VoiceTranscribeInput,
} from "@/lib/types";

export function useIntegrations() {
	return useQuery({
		queryKey: queryKeys.integrations,
		queryFn: () => integrations.list(),
	});
}

export function useConnectSlackIntegration() {
	return useMutation({
		mutationFn: () => integrations.connectSlack(),
	});
}

export function useConnectGmailIntegration() {
	return useMutation({
		mutationFn: () => integrations.connectGmail(),
	});
}

export function useConnectLinearIntegration() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: {
			apiKey: string;
			workspaceId?: string;
			workspaceName?: string;
		}) => integrations.connectLinear(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
		},
	});
}

export function useConnectGitIntegration() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: GitConnectInput) => integrations.connectGit(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
		},
	});
}

export function useConnectVoiceIntegration() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: VoiceConnectInput) => integrations.connectVoice(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
		},
	});
}

export function useDisconnectIntegration() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (type: "slack" | "gmail" | "linear" | "git" | "voice") =>
			integrations.disconnect(type),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
		},
	});
}

export function useImportGitCommit() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: GitImportCommitInput) => integrations.importGitCommit(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
		},
	});
}

export function useTranscribeVoice() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (
			data:
				| (VoiceTranscribeInput & { audio?: undefined })
				| (VoiceTranscribeInput & { audio: File }),
		) => integrations.transcribeVoice(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.integrations });
		},
	});
}

export function useVoiceTranscriptionJob(jobId?: string) {
	return useQuery({
		queryKey: ["integrations", "voice", "job", jobId] as const,
		queryFn: () => integrations.getVoiceTranscriptionJob(jobId as string),
		enabled: Boolean(jobId),
		refetchInterval: (query) =>
			query.state.data?.status === "processing" ? 2_000 : false,
	});
}
