import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { DatePicker } from "@repo/ui/components/ui/date-picker";
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
import { Switch } from "@repo/ui/components/ui/switch";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { goeyToast as toast } from "goey-toast";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
	useProjectMilestones,
	useProjectParts,
	useProjects,
} from "@/hooks/use-projects";
import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import type { Task } from "@/lib/types";

const editTaskSchema = z.object({
	title: z.string().min(1, "Title is required").max(500),
	description: z.string().max(10000).optional(),
	projectId: z.string().optional(),
	partId: z.string().optional(),
	milestoneId: z.string().optional(),
	deadline: z.union([z.string().datetime(), z.literal("")]).optional(),
	featureBlocked: z.boolean().optional(),
	featureBlockReason: z.string().max(300).optional(),
	blockingTaskIds: z.array(z.string()).optional(),
	blocksTaskIds: z.array(z.string()).optional(),
	tags: z.string().optional(),
});

type EditTaskValues = z.infer<typeof editTaskSchema>;

interface EditTaskDialogProps {
	task: Task;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function readFeatureGate(task: Task) {
	if (!task.sourceMetadata || typeof task.sourceMetadata !== "object") {
		return { blocked: false, reason: "" };
	}
	const metadata = task.sourceMetadata as Record<string, unknown>;
	const featureGate = metadata.featureGate;
	if (!featureGate || typeof featureGate !== "object") {
		return { blocked: false, reason: "" };
	}
	const gate = featureGate as Record<string, unknown>;
	return {
		blocked: gate.blocked === true,
		reason: typeof gate.reason === "string" ? gate.reason : "",
		blockingTaskIds: Array.isArray(gate.blockingTaskIds)
			? gate.blockingTaskIds.filter(
					(id): id is string => typeof id === "string",
				)
			: typeof gate.blockingTaskId === "string"
				? [gate.blockingTaskId]
				: [],
		blocksTaskIds: Array.isArray(gate.blocksTaskIds)
			? gate.blocksTaskIds.filter((id): id is string => typeof id === "string")
			: typeof gate.blocksTaskId === "string"
				? [gate.blocksTaskId]
				: [],
	};
}

export function EditTaskDialog({
	task,
	open,
	onOpenChange,
}: EditTaskDialogProps) {
	const { data: projectList } = useProjects();
	const updateTask = useUpdateTask();
	const featureGate = readFeatureGate(task);

	const form = useForm<EditTaskValues>({
		resolver: zodResolver(editTaskSchema),
		defaultValues: {
			title: task.title,
			description: task.description || "",
			projectId: task.projectId || "",
			partId: task.partId || "",
			milestoneId: task.milestoneId || "",
			deadline: task.deadline || "",
			featureBlocked: featureGate.blocked,
			featureBlockReason: featureGate.reason,
			blockingTaskIds: featureGate.blockingTaskIds ?? [],
			blocksTaskIds: featureGate.blocksTaskIds ?? [],
			tags: task.tags.join(", "),
		},
	});
	const selectedProjectId = form.watch("projectId") || "";
	const { data: partList } = useProjectParts(selectedProjectId);
	const { data: milestoneList } = useProjectMilestones(selectedProjectId);
	const { data: allTaskData } = useTasks({
		limit: -1,
		sortBy: "updatedAt",
		sortOrder: "desc",
		...(selectedProjectId ? { projectId: selectedProjectId } : {}),
	});
	const candidateBlockingTasks =
		selectedProjectId && allTaskData?.tasks
			? allTaskData.tasks.filter((candidate) => candidate.id !== task.id)
			: [];

	useEffect(() => {
		if (selectedProjectId) return;
		form.setValue("featureBlocked", false);
		form.setValue("blockingTaskIds", []);
		form.setValue("blocksTaskIds", []);
		form.setValue("featureBlockReason", "");
		form.setValue("partId", "");
		form.setValue("milestoneId", "");
	}, [selectedProjectId, form]);

	function toggleSelection(
		field: "blockingTaskIds" | "blocksTaskIds",
		taskId: string,
		checked: boolean,
	) {
		const current = form.getValues(field) ?? [];
		const next = checked
			? Array.from(new Set([...current, taskId]))
			: current.filter((id) => id !== taskId);
		form.setValue(field, next, { shouldDirty: true, shouldTouch: true });
	}

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
					partId: data.projectId && data.partId ? data.partId : null,
					milestoneId:
						data.projectId && data.milestoneId ? data.milestoneId : null,
					deadline: data.deadline || null,
					featureBlocked: data.featureBlocked,
					featureBlockReason: data.featureBlocked
						? data.featureBlockReason?.trim() || null
						: null,
					blockingTaskIds: data.featureBlocked
						? data.blockingTaskIds?.filter(Boolean) || undefined
						: undefined,
					blocksTaskIds: data.blocksTaskIds?.filter(Boolean) || undefined,
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
			<DialogContent className="sm:max-w-lg">
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
							name="partId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Project part</FormLabel>
									<Select
										disabled={!selectedProjectId}
										value={field.value || "__none__"}
										onValueChange={(value) =>
											field.onChange(value === "__none__" ? "" : value)
										}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue
													placeholder={
														selectedProjectId
															? "No part"
															: "Select project first"
													}
												/>
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="__none__">No part</SelectItem>
											{(partList || []).map((part) => (
												<SelectItem key={part.id} value={part.id}>
													{part.name}
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
							name="milestoneId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Milestone</FormLabel>
									<Select
										disabled={!selectedProjectId}
										value={field.value || "__none__"}
										onValueChange={(value) =>
											field.onChange(value === "__none__" ? "" : value)
										}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue
													placeholder={
														selectedProjectId
															? "No milestone"
															: "Select project first"
													}
												/>
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="__none__">No milestone</SelectItem>
											{(milestoneList || []).map((milestone) => (
												<SelectItem key={milestone.id} value={milestone.id}>
													{milestone.title}
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
										<DatePicker
											value={field.value}
											onChange={(next) => field.onChange(next ?? "")}
											boundary="end"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="featureBlocked"
							render={({ field }) => (
								<FormItem className="flex items-center justify-between rounded-lg border p-3">
									<FormLabel className="text-sm font-normal">
										Block by feature readiness
									</FormLabel>
									<FormControl>
										<Switch
											checked={field.value}
											disabled={!selectedProjectId}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
						{!selectedProjectId && (
							<p className="text-xs text-muted-foreground">
								Select a project first. Only tasks from the same project can
								block this task.
							</p>
						)}

						{form.watch("featureBlocked") && (
							<>
								<FormField
									control={form.control}
									name="blockingTaskIds"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Blocking tasks</FormLabel>
											<div className="max-h-36 space-y-2 overflow-y-auto rounded-md border p-3">
												{candidateBlockingTasks.map((candidate) => (
													<label
														key={candidate.id}
														className="flex items-center gap-2 text-sm"
													>
														<Checkbox
															checked={(field.value || []).includes(
																candidate.id,
															)}
															onCheckedChange={(checked) =>
																toggleSelection(
																	"blockingTaskIds",
																	candidate.id,
																	Boolean(checked),
																)
															}
														/>
														<span className="truncate">{candidate.title}</span>
													</label>
												))}
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="featureBlockReason"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Feature block reason</FormLabel>
											<FormControl>
												<Textarea
													rows={2}
													placeholder="What feature dependency is still pending?"
													className="resize-none"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</>
						)}

						<FormField
							control={form.control}
							name="blocksTaskIds"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Tasks being blocked</FormLabel>
									<div className="max-h-36 space-y-2 overflow-y-auto rounded-md border p-3">
										{candidateBlockingTasks.map((candidate) => (
											<label
												key={candidate.id}
												className="flex items-center gap-2 text-sm"
											>
												<Checkbox
													checked={(field.value || []).includes(candidate.id)}
													onCheckedChange={(checked) =>
														toggleSelection(
															"blocksTaskIds",
															candidate.id,
															Boolean(checked),
														)
													}
												/>
												<span className="truncate">{candidate.title}</span>
											</label>
										))}
									</div>
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
