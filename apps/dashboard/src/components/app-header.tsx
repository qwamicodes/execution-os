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
	Laptop,
	LayoutDashboard,
	Lightbulb,
	Menu,
	Moon,
	PlugZap,
	Sun,
	Timer,
} from "lucide-react";
import { useState } from "react";
import { useSessionTimer } from "@/hooks/use-session-timer";
import { useThemePreference } from "@/hooks/use-theme-preference";
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
	const { preference, setPreference } = useThemePreference();

	return (
		<header className="flex h-12 items-center justify-between gap-2 border-b border-border bg-background/95 backdrop-blur-sm px-3 sm:px-4">
			{/* Mobile menu */}
			<div className="flex items-center gap-2 md:hidden">
				<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
					<SheetTrigger asChild>
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<Menu className="h-4 w-4" />
						</Button>
					</SheetTrigger>
					<SheetContent side="left" className="w-[80vw] max-w-xs p-0 bg-sidebar border-sidebar-border">
						<SheetHeader className="border-b border-sidebar-border px-4 py-3">
							<SheetTitle className="inline-flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
								<img
									src="/favicon.svg"
									alt="Execution OS"
									className="h-5 w-5 rounded-md"
								/>
								Execution OS
							</SheetTitle>
							{user ? (
								<p className="text-xs text-sidebar-foreground/50 mt-0.5">
									{user.name} · {user.email}
								</p>
							) : null}
						</SheetHeader>
						<nav className="space-y-0.5 p-2">
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
										className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ${
											isActive
												? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
												: "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
										}`}
									>
										<span className="inline-flex items-center gap-2.5">
											<item.icon className="h-4 w-4 shrink-0" />
											{item.label}
										</span>
										{item.to === "/inbox" && inboxCount > 0 ? (
											<Badge
												variant="secondary"
												className="h-4 min-w-4 justify-center px-1 text-[10px] bg-primary/15 text-primary border-0"
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

			{/* Right side controls */}
			<div className="flex min-w-0 items-center gap-2">
				{/* Offline / syncing status */}
				{!isOnline ? (
					<Badge
						variant="secondary"
						className="border border-amber-200 bg-amber-50 text-amber-800 text-xs"
					>
						Offline{offlineQueueSize > 0 ? ` · ${offlineQueueSize}` : ""}
					</Badge>
				) : isSyncingOfflineQueue ? (
					<Badge
						variant="secondary"
						className="text-xs border-0 bg-primary/10 text-primary"
					>
						Syncing…
					</Badge>
				) : null}

				{/* Active session indicator */}
				{activeSession ? (
					<Link
						to="/sessions/$sessionId"
						params={{ sessionId: activeSession.id }}
						className="flex min-w-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 transition-colors hover:bg-accent"
					>
						<span className={`relative flex h-1.5 w-1.5 shrink-0 ${isPaused ? "" : "animate-pulse"}`}>
							<span
								className={`inline-flex h-full w-full rounded-full ${
									isPaused ? "bg-yellow-400" : "bg-green-400"
								}`}
							/>
						</span>
						<span className="font-mono text-xs text-foreground tabular-nums">
							{formattedTime}
						</span>
						{activeSession.task ? (
							<span className="hidden max-w-[160px] truncate text-xs text-muted-foreground sm:block">
								· {activeSession.task.title}
							</span>
						) : null}
					</Link>
				) : (
					<span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
						<kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] leading-none">
							<Command className="h-2 w-2" />K
						</kbd>
						<span className="opacity-50">·</span>
						<kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] leading-none">
							<Command className="h-2 w-2" />/
						</kbd>
					</span>
				)}

				{/* Theme toggle */}
				<div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
					<Button
						variant={preference === "system" ? "secondary" : "ghost"}
						size="sm"
						className="h-6 w-6 p-0"
						onClick={() => setPreference("system")}
						aria-label="System theme"
					>
						<Laptop className="h-3 w-3" />
					</Button>
					<Button
						variant={preference === "light" ? "secondary" : "ghost"}
						size="sm"
						className="h-6 w-6 p-0"
						onClick={() => setPreference("light")}
						aria-label="Light theme"
					>
						<Sun className="h-3 w-3" />
					</Button>
					<Button
						variant={preference === "dark" ? "secondary" : "ghost"}
						size="sm"
						className="h-6 w-6 p-0"
						onClick={() => setPreference("dark")}
						aria-label="Dark theme"
					>
						<Moon className="h-3 w-3" />
					</Button>
				</div>
			</div>
		</header>
	);
}
