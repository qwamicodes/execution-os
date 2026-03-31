import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useForm } from "react-hook-form";
import { goeyToast as toast } from "goey-toast";
import { z } from "zod";
import { useCreateProject } from "@/hooks/use-projects";
import { PROJECT_COLORS } from "@/lib/constants";
import type { ProjectType } from "@/lib/types";

const createProjectSchema = z.object({
	name: z.string().min(1, "Name is required").max(100),
	description: z.string().max(500).optional(),
	type: z.enum(["Clients", "Core", "SideQuest", "Office"]),
	color: z.string(),
});

type CreateProjectValues = z.infer<typeof createProjectSchema>;

interface CreateProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({
	open,
	onOpenChange,
}: CreateProjectDialogProps) {
	const createProject = useCreateProject();

	const form = useForm<CreateProjectValues>({
		resolver: zodResolver(createProjectSchema),
		defaultValues: {
			name: "",
			description: "",
			type: "Core",
			color: PROJECT_COLORS[0],
		},
	});

	function onSubmit(data: CreateProjectValues) {
		createProject.mutate(
			{
				name: data.name,
				description: data.description || undefined,
				type: data.type as ProjectType,
				color: data.color,
			},
			{
				onSuccess: () => {
					toast.success("Project created");
					form.reset();
					onOpenChange(false);
				},
				onError: (error) => {
					toast.error(error.message);
				},
			},
		);
	}

	const projectTypes = [
		{
			value: "Clients",
			emoji: "👥",
			label: "Clients",
			desc: "Agency milestones and deadlines",
		},
		{
			value: "Office",
			emoji: "🏢",
			label: "Office",
			desc: "9-5 work timelines and issues",
		},
		{ value: "Core", emoji: "🎯", label: "Core", desc: "SaaS growth work" },
		{
			value: "SideQuest",
			emoji: "🧪",
			label: "SideQuest",
			desc: "Free-time experiments",
		},
	] as const;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create project</DialogTitle>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="Project name" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="What is this project about?"
											className="resize-none"
											rows={2}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="type"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Type</FormLabel>
									<FormControl>
										<div className="grid grid-cols-2 gap-2">
											{projectTypes.map((type) => (
												<button
													key={type.value}
													type="button"
													onClick={() => field.onChange(type.value)}
													className={`flex min-h-[84px] flex-col items-start justify-between rounded-md border px-3 py-2 text-left transition-colors ${
														field.value === type.value
															? "border-primary bg-primary/5"
															: "border-border hover:border-primary/40"
													}`}
												>
													<div className="text-sm font-medium">
														{type.emoji} {type.label}
													</div>
													<div className="text-xs text-muted-foreground">
														{type.desc}
													</div>
												</button>
											))}
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="color"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Color</FormLabel>
									<FormControl>
										<div className="flex flex-wrap gap-2">
											{PROJECT_COLORS.map((color) => (
												<button
													key={color}
													type="button"
													className={`h-7 w-7 rounded-full transition-all ${
														field.value === color
															? "ring-2 ring-primary ring-offset-2"
															: "hover:scale-110"
													}`}
													style={{ backgroundColor: color }}
													onClick={() => field.onChange(color)}
												/>
											))}
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={createProject.isPending}>
								{createProject.isPending ? "Creating..." : "Create project"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
