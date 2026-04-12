import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { AuthLayout } from "../components/auth-layout";
import { getMe } from "../lib/api";
import { redirectToDashboard } from "../lib/auth-store";

export const Route = createRootRoute({
	beforeLoad: async () => {
		try {
			await getMe();
			// Session is valid — user is already logged in, redirect to dashboard
			redirectToDashboard();
		} catch {
			// No valid session — continue to render auth routes
		}
	},
	component: RootLayout,
});

function RootLayout() {
	return (
		<AuthLayout>
			<Outlet />
			<TanStackRouterDevtools />
		</AuthLayout>
	);
}
