import { useQuery } from "@tanstack/react-query";
import { ai } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useTaskRecommendation(forceRefresh?: boolean) {
	return useQuery({
		queryKey: queryKeys.ai.recommendation(forceRefresh),
		queryFn: () => ai.getRecommendation(forceRefresh),
	});
}

export function useAIProviders() {
	return useQuery({
		queryKey: queryKeys.ai.providers,
		queryFn: () => ai.getProviders(),
	});
}
