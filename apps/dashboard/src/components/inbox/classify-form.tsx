import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import { useForm } from "react-hook-form";
import { goeyToast as toast } from "goey-toast";
import { z } from "zod";
import { useClassifyTask } from "@/hooks/use-inbox";
import { useProjects } from "@/hooks/use-projects";
import { TASK_SIZE_CONFIG, TASK_URGENCY_CONFIG } from "@/lib/constants";
import type { TaskSize, TaskUrgency } from "@/lib/types";

const classifySchema = z.object({
	projectId: z.string().optional(),
	size: z.enum(["Small", "Medium", "Large", "Huge"]).optional(),
	urgency: z.enum(["Urgent", "High", "Medium", "Low"]).optional(),
	protected: z.boolean().optional(),
	protectionReason: z
		.enum(["contract", "sla", "client", "investor"])
		.optional(),
	deadline: z.string().optional(),
	tags: z.string().optional(),
});

type ClassifyValues = z.infer<typeof classifySchema>;

interface ClassifyFormProps {
	taskId: string;
	onDone: () => void;
}

export function ClassifyForm({ taskId, onDone }: ClassifyFormProps) {
	const { data: projectList } = useProjects();
	const classifyTask = useClassifyTask();

	const form = useForm<ClassifyValues>({
		resolver: zodResolver(classifySchema),
		defaultValues: {
			projectId: "",
			protected: false,
			protectionReason: undefined,
			deadline: "",
			tags: "",
		},
	});

	function onSubmit(data: ClassifyValues) {
		const tags = data.tags
			? data.tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean)
			: undefined;

		classifyTask.mutate(
			{
				id: taskId,
				data: {
					projectId: data.projectId || undefined,
					size: data.size,
					urgency: data.urgency,
					protected: data.protected || undefined,
					protectionReason:
						data.protected && data.protectionReason
							? data.protectionReason
							: undefined,
					deadline: data.deadline
						? new Date(`${data.deadline}T23:59:59.000Z`).toISOString()
						: undefined,
					tags: tags?.length ? tags : undefined,
				},
			},
			{
				onSuccess: () => {
					toast.success("Task classified and moved to Ready");
					onDone();
				},
				onError: (error) => {
					toast.error(error.message);
				},
			},
		);
	}

	function handleSkip() {
		classifyTask.mutate(
			{ id: taskId, data: {} },
			{
				onSuccess: () => {
					toast.success("Task moved to Ready");
					onDone();
				},
				onError: (error) => {
					toast.error(error.message);
				},
			},
		);
	}

	const sizes: TaskSize[] = ["Small", "Medium", "Large", "Huge"];
	const urgencies: TaskUrgency[] = ["Urgent", "High", "Medium", "Low"];

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="space-y-4 border-t border-slate-200 pt-4"
			>
				<FormField
					control={form.control}
					name="projectId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Project</FormLabel>
							<Select onValueChange={field.onChange} defaultValue={field.value}>
								<FormControl>
									<SelectTrigger className="border-slate-300 bg-white">
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
					name="size"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Size</FormLabel>
							<FormControl>
								<RadioGroup
									onValueChange={field.onChange}
									defaultValue={field.value}
									className="grid grid-cols-2 gap-2 sm:grid-cols-4"
								>
									{sizes.map((size) => {
										const config = TASK_SIZE_CONFIG[size];
										return (
											<Label
												key={size}
												htmlFor={`size-${size}`}
												className={`flex cursor-pointer items-center justify-center rounded-md border-2 p-2 text-sm transition-colors ${
													field.value === size
														? "border-primary bg-primary/5"
														: "border-muted hover:border-muted-foreground/25"
												}`}
											>
												<RadioGroupItem
													value={size}
													id={`size-${size}`}
													className="sr-only"
												/>
												{config.label}
											</Label>
										);
									})}
								</RadioGroup>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="urgency"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Urgency</FormLabel>
							<FormControl>
								<RadioGroup
									onValueChange={field.onChange}
									defaultValue={field.value}
									className="grid grid-cols-2 gap-2 sm:grid-cols-4"
								>
									{urgencies.map((urgency) => {
										const config = TASK_URGENCY_CONFIG[urgency];
										return (
											<Label
												key={urgency}
												htmlFor={`urgency-${urgency}`}
												className={`flex cursor-pointer items-center justify-center rounded-md border-2 p-2 text-sm transition-colors ${
													field.value === urgency
														? "border-primary bg-primary/5"
														: "border-muted hover:border-muted-foreground/25"
												}`}
											>
												<RadioGroupItem
													value={urgency}
													id={`urgency-${urgency}`}
													className="sr-only"
												/>
												{config.label}
											</Label>
										);
									})}
								</RadioGroup>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="protected"
					render={({ field }) => (
						<FormItem className="flex items-center justify-between rounded-lg border p-3">
							<FormLabel className="text-sm font-normal">
								Protected task
							</FormLabel>
							<FormControl>
								<Switch
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
						</FormItem>
					)}
				/>

				{form.watch("protected") && (
					<FormField
						control={form.control}
						name="protectionReason"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Protection reason</FormLabel>
								<Select
									value={field.value || "none"}
									onValueChange={(value) =>
										field.onChange(value === "none" ? undefined : value)
									}
								>
									<FormControl>
										<SelectTrigger className="border-slate-300 bg-white">
											<SelectValue placeholder="Select reason" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value="none">None</SelectItem>
										<SelectItem value="contract">Contract</SelectItem>
										<SelectItem value="sla">SLA</SelectItem>
										<SelectItem value="client">Client</SelectItem>
										<SelectItem value="investor">Investor</SelectItem>
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
				)}

				<FormField
					control={form.control}
					name="deadline"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Deadline</FormLabel>
							<FormControl>
								<Input
									type="date"
									className="border-slate-300 bg-white"
									{...field}
								/>
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
								<Input
									placeholder="Comma-separated tags"
									className="border-slate-300 bg-white"
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="flex gap-2">
					<Button
						type="button"
						variant="ghost"
						className="flex-1"
						onClick={handleSkip}
						disabled={classifyTask.isPending}
					>
						Skip
					</Button>
					<Button
						type="submit"
						className="flex-1"
						disabled={classifyTask.isPending}
					>
						{classifyTask.isPending ? "Classifying..." : "Classify"}
					</Button>
				</div>
			</form>
		</Form>
	);
}
