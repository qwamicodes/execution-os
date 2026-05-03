import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
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
		<aside className="flex h-screen w-56 flex-col bg-sidebar border-r border-sidebar-border">
			{/* Logo */}
			<div className="flex h-12 items-center gap-2.5 px-4">
				<img
					src="/favicon.svg"
					alt="Execution OS"
					className="h-6 w-6 rounded-md"
				/>
				<span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
					Execution OS
				</span>
			</div>

			{/* Navigation */}
			<nav className="flex-1 px-2 py-2 space-y-0.5">
				{navItems.map((item) => {
					const isActive = matchRoute({
						to: item.to,
						fuzzy: item.to !== "/",
					});

					return (
						<Link
							key={item.to}
							to={item.to}
							className={`group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ${
								isActive
									? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
									: "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
							}`}
						>
							<item.icon
								className={`h-4 w-4 shrink-0 transition-colors duration-150 ${
									isActive
										? "text-sidebar-accent-foreground"
										: "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
								}`}
							/>
							<span className="flex-1 truncate">{item.label}</span>
							{item.showBadge && inboxCount ? (
								<Badge
									variant="secondary"
									className="h-4 min-w-4 justify-center px-1 text-[10px] font-medium bg-primary/15 text-primary border-0"
								>
									{inboxCount}
								</Badge>
							) : null}
						</Link>
					);
				})}
			</nav>

			{/* User section */}
			<div className="border-t border-sidebar-border p-2">
				<div className="flex items-center gap-2.5 rounded-md px-2.5 py-2">
					<Avatar className="h-7 w-7 shrink-0">
						<AvatarFallback className="text-[10px] font-semibold bg-primary/15 text-primary">
							{initials}
						</AvatarFallback>
					</Avatar>
					<div className="flex-1 min-w-0">
						<p className="truncate text-xs font-medium text-sidebar-foreground leading-tight">
							{user.name}
						</p>
						<p className="truncate text-[10px] text-sidebar-foreground/50 leading-tight mt-0.5">
							{user.email}
						</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
						onClick={() => logoutMutation.mutate()}
						disabled={logoutMutation.isPending}
						aria-label="Sign out"
					>
						<LogOut className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>
		</aside>
	);
}
