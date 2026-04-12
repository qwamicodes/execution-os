import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { goeyToast as toast } from "goey-toast";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@repo/ui/styles/globals.css";
import "goey-toast/styles.css";
import "./dark-overrides.css";
import { ApiClientError } from "@/lib/api";
import { initializeThemePreference } from "@/lib/theme";
import { routeTree } from "./routeTree.gen";

type ErrorWithMessage = { message?: string };

const recentErrorToasts = new Map<string, number>();
const ERROR_TOAST_DEDUP_WINDOW_MS = 1500;

function normalizeErrorMessage(error: unknown) {
	if (typeof error === "string" && error.trim()) return error;
	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof (error as ErrorWithMessage).message === "string" &&
		(error as ErrorWithMessage).message?.trim()
	) {
		return (error as ErrorWithMessage).message as string;
	}
	return "Request failed. Please try again.";
}

function normalizeErrorDescription(error: unknown) {
	if (error instanceof ApiClientError) {
		if (error.details && error.suggestion) {
			return `${error.details}\n${error.suggestion}`;
		}
		return error.details ?? error.suggestion ?? undefined;
	}
	return undefined;
}

function getQueryToastKey(queryKey: unknown) {
	try {
		return JSON.stringify(queryKey);
	} catch {
		return String(queryKey);
	}
}

function shouldSkipToastForQuery(queryKey: unknown) {
	const key = getQueryToastKey(queryKey);
	const now = Date.now();
	const lastShownAt = recentErrorToasts.get(key);
	if (lastShownAt && now - lastShownAt < ERROR_TOAST_DEDUP_WINDOW_MS) {
		return true;
	}
	recentErrorToasts.set(key, now);
	return false;
}

const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			if (shouldSkipToastForQuery(query.queryKey)) return;
			toast.error(normalizeErrorMessage(error), {
				description: normalizeErrorDescription(error),
			});
		},
	}),
	defaultOptions: {
		queries: {
			retry: false,
			refetchOnWindowFocus: false,
		},
	},
});

const router = createRouter({
	routeTree,
	context: { queryClient },
});

initializeThemePreference();

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	</StrictMode>,
);
