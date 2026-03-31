import { useQuery } from "@tanstack/react-query";
import { search } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { SearchParams } from "@/lib/types";

export function useSearch(params: SearchParams) {
	return useQuery({
		queryKey: queryKeys.search(params.q),
		queryFn: () => search.query(params),
		enabled: params.q.length >= 2,
	});
}
