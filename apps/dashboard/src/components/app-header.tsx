import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { Link, useMatchRoute } from "@tanstack/react-router";
import {
	BrainCircuit,
	CheckSquare,
	Command,
	FolderOpen,
	Inbox,
	LayoutDashboard,
	Lightbulb,
	Menu,
	PlugZap,
	Timer,
} from "lucide-react";
import { useState } from "react";
import { useSessionTimer } from "@/hooks/use-session-timer";
import type { Session, User } from "@/lib/types";

interface AppHeaderProps {
	activeSession?: Session | null;
	isOnline?: boolean;
	offlineQueueSize?: number;
	isSyncingOfflineQueue?: boolean;
	user?: User;
	inboxCount?: number;
}

const navItems: Array<{
	to: string;
	label: string;
	icon: typeof LayoutDashboard;
}> = [
	{ to: "/", label: "Dashboard", icon: LayoutDashboard },
	{ to: "/inbox", label: "Inbox", icon: Inbox },
	{ to: "/tasks", label: "Tasks", icon: CheckSquare },
	{ to: "/ideas", label: "Ideas", icon: Lightbulb },
	{ to: "/projects", label: "Projects", icon: FolderOpen },
	{ to: "/sessions", label: "Sessions", icon: Timer },
	{ to: "/integrations", label: "Integrations", icon: PlugZap },
	{ to: "/ai", label: "AI", icon: BrainCircuit },
];

export function AppHeader({
	activeSession,
	isOnline = true,
	offlineQueueSize = 0,
	isSyncingOfflineQueue = false,
	user,
	inboxCount = 0,
}: AppHeaderProps) {
	const { formattedTime } = useSessionTimer(activeSession ?? null);
	const isPaused = activeSession?.state === "Paused";
	const [mobileOpen, setMobileOpen] = useState(false);
	const matchRoute = useMatchRoute();

	return (
		<header className="flex h-14 items-center justify-between gap-2 border-b px-3 sm:px-6">
			<div className="flex items-center gap-2 md:hidden">
				<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
					<SheetTrigger asChild>
						<Button variant="outline" size="icon" className="h-9 w-9">
							<Menu className="h-4 w-4" />
						</Button>
					</SheetTrigger>
					<SheetContent side="left" className="w-[84vw] max-w-sm p-0">
						<SheetHeader className="border-b border-slate-200 p-4">
							<SheetTitle>Execution OS</SheetTitle>
							{user ? (
								<p className="text-sm text-slate-500">
									{user.name} · {user.email}
								</p>
							) : null}
						</SheetHeader>
						<nav className="space-y-1 p-3">
							{navItems.map((item) => {
								const isActive = matchRoute({
									to: item.to,
									fuzzy: item.to !== "/",
								});
								return (
									<Link
										key={item.to}
										to={item.to}
										onClick={() => setMobileOpen(false)}
										className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
											isActive
												? "bg-slate-900 text-white"
												: "text-slate-700 hover:bg-slate-100"
										}`}
									>
										<span className="inline-flex items-center gap-2">
											<item.icon className="h-4 w-4" />
											{item.label}
										</span>
										{item.to === "/inbox" && inboxCount > 0 ? (
											<Badge
												variant="secondary"
												className="h-5 min-w-5 justify-center px-1 text-xs"
											>
												{inboxCount}
											</Badge>
										) : null}
									</Link>
								);
							})}
						</nav>
					</SheetContent>
				</Sheet>
			</div>

			<div className="hidden md:block" />

			<div className="flex min-w-0 items-center gap-2 sm:gap-3">
				{!isOnline ? (
					<Badge
						variant="secondary"
						className="border border-amber-200 bg-amber-50 text-amber-800"
					>
						Offline
						{offlineQueueSize > 0 ? ` · ${offlineQueueSize} queued` : ""}
					</Badge>
				) : isSyncingOfflineQueue ? (
					<Badge
						variant="secondary"
						className="border border-sky-200 bg-sky-50 text-sky-800"
					>
						Syncing queued changes
					</Badge>
				) : null}

				{activeSession ? (
					<Link to="/" className="flex min-w-0 items-center gap-2">
						<span
							className={`relative flex h-2 w-2 ${isPaused ? "" : "animate-pulse"}`}
						>
							<span
								className={`inline-flex h-full w-full rounded-full ${
									isPaused ? "bg-yellow-500" : "bg-green-500"
								}`}
							/>
						</span>
						<Badge
							variant="secondary"
							className={`gap-1.5 font-mono text-xs ${
								isPaused
									? "bg-yellow-50 text-yellow-700"
									: "bg-green-50 text-green-700"
							}`}
						>
							<Timer className="h-3 w-3" />
							{formattedTime}
						</Badge>
						{activeSession.task ? (
							<span className="max-w-[120px] truncate text-sm text-muted-foreground sm:max-w-[220px]">
								{activeSession.task.title}
							</span>
						) : null}
					</Link>
				) : (
					<span className="hidden text-xs text-muted-foreground sm:inline-flex sm:items-center sm:gap-1">
						<kbd className="inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
							<Command className="h-2.5 w-2.5" />K
						</kbd>
						to search ·
						<kbd className="inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
							<Command className="h-2.5 w-2.5" />/
						</kbd>
						for shortcuts
					</span>
				)}
			</div>
		</header>
	);
}
