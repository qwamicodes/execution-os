import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auth } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const AUTH_URL = import.meta.env.VITE_AUTH_URL || "http://localhost:8902";

export function useUser() {
	const query = useQuery({
		queryKey: queryKeys.user,
		queryFn: auth.getMe,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	return {
		user: query.data,
		isLoading: query.isLoading,
		isError: query.isError,
	};
}

export function useLogout() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: auth.logout,
		onSuccess: () => {
			queryClient.clear();
			window.location.href = AUTH_URL;
		},
	});
}
