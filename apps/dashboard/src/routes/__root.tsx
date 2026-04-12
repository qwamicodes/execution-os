import { Spinner } from "@repo/ui/components/ui/spinner";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	Outlet,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { GoeyToaster } from "goey-toast";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { KeyboardShortcutsDialog } from "@/components/shared/keyboard-shortcuts-dialog";
import { SearchPalette } from "@/components/shared/search-palette";
import { useActiveSessionReminder } from "@/hooks/use-active-session-reminder";
import { useInbox } from "@/hooks/use-inbox";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { useActiveSession } from "@/hooks/use-sessions";
import { auth, projects } from "@/lib/api";
import type { User } from "@/lib/types";

const AUTH_URL = import.meta.env.VITE_AUTH_URL || "http://localhost:8902";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	beforeLoad: async ({ location }) => {
		// Skip auth check for onboarding route
		const isOnboarding = location.pathname === "/onboarding";

		let user: User;
		try {
			user = await auth.getMe();
		} catch {
			// Not authenticated — redirect to auth app
			window.location.href = AUTH_URL;
			// Throw to prevent rendering while redirect happens
			throw redirect({ to: "/" });
		}

		// Check if user needs onboarding (no projects = new user)
		if (!isOnboarding) {
			let needsOnboarding = false;
			try {
				const projectList = await projects.list();
				if (Array.isArray(projectList) && projectList.length === 0) {
					needsOnboarding = true;
				}
			} catch {
				// Project fetch failed — continue to dashboard
			}
			if (needsOnboarding) {
				throw redirect({ to: "/onboarding" });
			}
		}

		return { user };
	},
	component: RootLayout,
	pendingComponent: LoadingScreen,
});

function RootLayout() {
	const router = useRouter();
	const { user } = Route.useRouteContext();
	const pathname = router.state.location.pathname;

	const isOnboarding = pathname === "/onboarding";
	const isDashboard = pathname === "/";
	const isSessionDetail =
		pathname.startsWith("/sessions/") && pathname !== "/sessions/history";

	const { data: activeSession } = useActiveSession();
	const { data: inboxData } = useInbox();
	const { isOnline, queueSize, isSyncing } = useOfflineSync();
	useRealtimeEvents();
	useActiveSessionReminder(activeSession ?? null, pathname);
	const inboxCount = inboxData?.meta?.total ?? 0;

	return (
		<TooltipProvider delayDuration={180}>
			{/* Onboarding — clean layout (no shell at all) */}
			{isOnboarding ? (
				<>
					<Outlet />
					<GoeyToaster />
					<TanStackRouterDevtools position="bottom-right" />
				</>
			) : isDashboard || isSessionDetail ? (
				/* Dashboard and session detail — full-screen, no sidebar/header */
				<div className="h-screen overflow-auto">
					<Outlet />
					<SearchPalette />
					<KeyboardShortcutsDialog />
					<GoeyToaster />
					<TanStackRouterDevtools position="bottom-right" />
				</div>
			) : (
				/* All other routes — sidebar + header shell */
				<div className="flex h-screen overflow-hidden">
					<div className="hidden md:block">
						<AppSidebar user={user} inboxCount={inboxCount} />
					</div>
					<div className="flex flex-1 flex-col overflow-hidden">
						<AppHeader
							activeSession={activeSession ?? null}
							isOnline={isOnline}
							offlineQueueSize={queueSize}
							isSyncingOfflineQueue={isSyncing}
							user={user}
							inboxCount={inboxCount}
						/>
						<main className="flex-1 overflow-auto p-4 sm:p-6">
							<Outlet />
						</main>
					</div>
					<SearchPalette />
					<KeyboardShortcutsDialog />
					<GoeyToaster />
					<TanStackRouterDevtools position="bottom-right" />
				</div>
			)}
		</TooltipProvider>
	);
}

function LoadingScreen() {
	return (
		<div className="flex h-screen items-center justify-center">
			<Spinner size="lg" />
		</div>
	);
}
