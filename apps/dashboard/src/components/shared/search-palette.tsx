import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@repo/ui/components/ui/command";
import { useNavigate } from "@tanstack/react-router";
import { CheckSquare, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearch } from "@/hooks/use-search";

export function SearchPalette() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const navigate = useNavigate();

	const { data } = useSearch({ q: query, scope: "all", limit: 10 });

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	function handleSelect(to: string, params?: Record<string, string>) {
		setOpen(false);
		setQuery("");
		navigate({ to, params });
	}

	const tasks = data?.tasks || [];
	const searchProjects = data?.projects || [];

	return (
		<CommandDialog open={open} onOpenChange={setOpen}>
			<CommandInput
				placeholder="Search tasks and projects..."
				value={query}
				onValueChange={setQuery}
			/>
			<CommandList>
				<CommandEmpty>
					{query.length < 2 ? "Type to search..." : "No results found."}
				</CommandEmpty>

				{tasks.length > 0 && (
					<CommandGroup heading="Tasks">
						{tasks.map((task) => (
							<CommandItem
								key={task.id}
								value={`task-${task.id}`}
								onSelect={() =>
									handleSelect("/tasks/$taskId", {
										taskId: task.id,
									})
								}
							>
								<CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />
								<span className="truncate">{task.title}</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{searchProjects.length > 0 && (
					<CommandGroup heading="Projects">
						{searchProjects.map((project) => (
							<CommandItem
								key={project.id}
								value={`project-${project.id}`}
								onSelect={() =>
									handleSelect("/projects/$projectId", {
										projectId: project.id,
									})
								}
							>
								<FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
								<span className="truncate">{project.name}</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}
			</CommandList>
		</CommandDialog>
	);
}
