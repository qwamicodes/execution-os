import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { Link, useMatchRoute } from "@tanstack/react-router";
import {
	BrainCircuit,
	CheckSquare,
	FolderOpen,
	Inbox,
	LayoutDashboard,
	Lightbulb,
	LogOut,
	PlugZap,
	Timer,
} from "lucide-react";
import { useLogout } from "@/hooks/use-user";
import type { User } from "@/lib/types";

interface AppSidebarProps {
	user: User;
	inboxCount?: number;
}

const navItems: readonly {
	to: string;
	icon: typeof LayoutDashboard;
	label: string;
	showBadge?: boolean;
}[] = [
	{ to: "/", icon: LayoutDashboard, label: "Dashboard" },
	{ to: "/inbox", icon: Inbox, label: "Inbox", showBadge: true },
	{ to: "/tasks", icon: CheckSquare, label: "Tasks" },
	{ to: "/ideas", icon: Lightbulb, label: "Ideas" },
	{ to: "/projects", icon: FolderOpen, label: "Projects" },
	{ to: "/sessions", icon: Timer, label: "Sessions" },
	{ to: "/integrations", icon: PlugZap, label: "Integrations" },
	{ to: "/ai", icon: BrainCircuit, label: "AI" },
];

export function AppSidebar({ user, inboxCount }: AppSidebarProps) {
	const matchRoute = useMatchRoute();
	const logoutMutation = useLogout();

	const initials = user.name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	return (
		<aside className="flex h-screen w-64 flex-col border-r bg-sidebar">
			{/* Logo */}
			<div className="flex h-14 items-center gap-2 px-4">
				<img
					src="/favicon.svg"
					alt="Execution OS logo"
					className="h-8 w-8 rounded-lg"
				/>
				<span className="font-semibold text-sidebar-foreground">
					Execution OS
				</span>
			</div>

			<Separator />

			{/* Navigation */}
			<nav className="flex-1 space-y-1 p-3">
				<TooltipProvider>
					{navItems.map((item) => {
						const isActive = matchRoute({
							to: item.to,
							fuzzy: item.to !== "/",
						});

						return (
							<Tooltip key={item.to}>
								<TooltipTrigger asChild>
									<Link
										to={item.to}
										className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
											isActive
												? "bg-sidebar-accent text-sidebar-accent-foreground"
												: "text-sidebar-foreground hover:bg-sidebar-accent/50"
										}`}
									>
										<item.icon className="h-4 w-4" />
										<span className="flex-1">{item.label}</span>
										{item.showBadge && inboxCount ? (
											<Badge
												variant="secondary"
												className="h-5 min-w-5 justify-center px-1 text-xs"
											>
												{inboxCount}
											</Badge>
										) : null}
									</Link>
								</TooltipTrigger>
								<TooltipContent side="right">{item.label}</TooltipContent>
							</Tooltip>
						);
					})}
				</TooltipProvider>
			</nav>

			<Separator />

			{/* User section */}
			<div className="p-3">
				<div className="flex items-center gap-3 rounded-lg px-3 py-2">
					<Avatar className="h-8 w-8">
						<AvatarFallback className="text-xs">{initials}</AvatarFallback>
					</Avatar>
					<div className="flex-1 min-w-0">
						<p className="truncate text-sm font-medium text-sidebar-foreground">
							{user.name}
						</p>
						<p className="truncate text-xs text-sidebar-foreground/60">
							{user.email}
						</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0"
						onClick={() => logoutMutation.mutate()}
						disabled={logoutMutation.isPending}
					>
						<LogOut className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</aside>
	);
}
