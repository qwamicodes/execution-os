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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { goeyToast as toast } from "goey-toast";
import { z } from "zod";
import { useProjects } from "@/hooks/use-projects";
import { useCreateTask } from "@/hooks/use-tasks";
import moment from "moment";

const createTaskSchema = z.object({
	title: z.string().min(1, "Title is required").max(500),
	description: z.string().max(10000).optional(),
	projectId: z.string().optional(),
	deadline: z.string().transform(val => moment(val).toISOString()).optional(),
	tags: z.string().optional(),
});

type CreateTaskValues = z.infer<typeof createTaskSchema>;

interface CreateTaskDialogProps {
	defaultProjectId?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode?: "task" | "idea";
	defaultTags?: string[];
	defaultTitle?: string;
}

export function CreateTaskDialog({
	defaultProjectId,
	open,
	onOpenChange,
	mode = "task",
	defaultTags = [],
	defaultTitle = "",
}: CreateTaskDialogProps) {
	const { data: projectList } = useProjects();
	const createTask = useCreateTask();
	const defaultTagsValue = defaultTags.join(", ");

	const form = useForm<CreateTaskValues>({
		resolver: zodResolver(createTaskSchema),
		defaultValues: {
			title: defaultTitle,
			description: "",
			projectId: defaultProjectId || "",
			deadline: "",
			tags: defaultTagsValue,
		},
	});

	useEffect(() => {
		if (!open) return;
		form.reset({
			title: defaultTitle,
			description: "",
			projectId: defaultProjectId || "",
			deadline: "",
			tags: defaultTagsValue,
		});
	}, [open, defaultProjectId, defaultTagsValue, defaultTitle, form]);

	function onSubmit(data: CreateTaskValues) {
		const tags = data.tags
			? data.tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean)
			: undefined;

		createTask.mutate(
			{
				title: data.title,
				description: data.description || undefined,
				projectId: data.projectId || undefined,
				deadline: data.deadline || undefined,
				tags: tags?.length ? tags : undefined,
			},
			{
				onSuccess: () => {
					toast.success(mode === "idea" ? "Idea captured" : "Task created");
					form.reset();
					onOpenChange(false);
				},
				onError: (error) => {
					toast.error(error.message);
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{mode === "idea" ? "Log idea" : "Create task"}
					</DialogTitle>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="title"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Title</FormLabel>
									<FormControl>
										<Input
											placeholder={
												mode === "idea"
													? "What idea do you want to capture?"
													: "What needs to be done?"
											}
											{...field}
										/>
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
											placeholder={
												mode === "idea"
													? "Why this idea matters, target user, and expected outcome..."
													: "Add details..."
											}
											className="resize-none"
											rows={3}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="projectId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Project</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="No project" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{Array.isArray(projectList) &&
												projectList.map((project) => (
													<SelectItem key={project.id} value={project.id}>
														{project.name}
													</SelectItem>
												))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="deadline"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Deadline</FormLabel>
									<FormControl>
										<Input type="date" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="tags"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Tags</FormLabel>
									<FormControl>
										<Input placeholder="Comma-separated tags" {...field} />
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
							<Button type="submit" disabled={createTask.isPending}>
								{createTask.isPending
									? mode === "idea"
										? "Saving..."
										: "Creating..."
									: mode === "idea"
										? "Save idea"
										: "Create task"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
