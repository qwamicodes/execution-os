import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { useEffect, useMemo, useState } from "react";

interface ShortcutItem {
	combination: string;
	description: string;
}

const SHORTCUTS: ShortcutItem[] = [
	{ combination: "Cmd/Ctrl + K", description: "Open search and command palette" },
	{ combination: "Cmd/Ctrl + /", description: "Open keyboard shortcuts help" },
	{ combination: "Esc", description: "Close dialogs and overlays" },
];

export function KeyboardShortcutsDialog() {
	const [open, setOpen] = useState(false);
	const osKey = useMemo(
		() =>
			typeof navigator !== "undefined" &&
			navigator.platform.toLowerCase().includes("mac")
				? "Cmd"
				: "Ctrl",
		[],
	);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key === "/") {
				event.preventDefault();
				setOpen((prev) => !prev);
			}
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Keyboard Shortcuts</DialogTitle>
				</DialogHeader>
				<div className="space-y-2">
					{SHORTCUTS.map((shortcut) => (
						<div
							key={shortcut.combination}
							className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2"
						>
							<p className="text-sm text-muted-foreground">{shortcut.description}</p>
							<kbd className="rounded-md border bg-card px-2 py-1 font-mono text-xs">
								{shortcut.combination
									.replace("Cmd", osKey)
									.replace("Ctrl", osKey)}
							</kbd>
						</div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
