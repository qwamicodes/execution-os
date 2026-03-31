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
import { useForm } from "react-hook-form";
import { goeyToast as toast } from "goey-toast";
import { z } from "zod";
import { useProjects } from "@/hooks/use-projects";
import { useUpdateTask } from "@/hooks/use-tasks";
import type { Task } from "@/lib/types";

const editTaskSchema = z.object({
	title: z.string().min(1, "Title is required").max(500),
	description: z.string().max(10000).optional(),
	projectId: z.string().optional(),
	deadline: z.string().optional(),
	tags: z.string().optional(),
});

type EditTaskValues = z.infer<typeof editTaskSchema>;

interface EditTaskDialogProps {
	task: Task;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function EditTaskDialog({
	task,
	open,
	onOpenChange,
}: EditTaskDialogProps) {
	const { data: projectList } = useProjects();
	const updateTask = useUpdateTask();

	const form = useForm<EditTaskValues>({
		resolver: zodResolver(editTaskSchema),
		defaultValues: {
			title: task.title,
			description: task.description || "",
			projectId: task.projectId || "",
			deadline: task.deadline
				? new Date(task.deadline).toISOString().split("T")[0]
				: "",
			tags: task.tags.join(", "),
		},
	});

	function onSubmit(data: EditTaskValues) {
		const tags = data.tags
			? data.tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean)
			: undefined;

		updateTask.mutate(
			{
				id: task.id,
				data: {
					title: data.title,
					description: data.description || undefined,
					projectId: data.projectId || null,
					deadline: data.deadline || null,
					tags: tags?.length ? tags : undefined,
				},
			},
			{
				onSuccess: () => {
					toast.success("Task updated");
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
					<DialogTitle>Edit task</DialogTitle>
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
										<Input {...field} />
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
										<Textarea className="resize-none" rows={3} {...field} />
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
							<Button type="submit" disabled={updateTask.isPending}>
								{updateTask.isPending ? "Saving..." : "Save changes"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
