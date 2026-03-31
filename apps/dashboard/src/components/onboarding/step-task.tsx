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
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";

const taskSchema = z.object({
	title: z.string().min(1, "Task title is required").max(500),
	description: z.string().max(10000).optional(),
});

type TaskValues = z.infer<typeof taskSchema>;

interface StepTaskProps {
	projectName: string;
	onNext: (data: { title: string; description?: string }) => void;
	onSkip: () => void;
	onBack: () => void;
	isSubmitting: boolean;
}

export function StepTask({
	projectName,
	onNext,
	onSkip,
	onBack,
	isSubmitting,
}: StepTaskProps) {
	const form = useForm<TaskValues>({
		resolver: zodResolver(taskSchema),
		defaultValues: { title: "", description: "" },
	});

	function onSubmit(data: TaskValues) {
		onNext({
			title: data.title,
			description: data.description || undefined,
		});
	}

	return (
		<div className="flex flex-col items-center">
			<h2 className="mb-2 text-2xl font-bold tracking-tight">
				Add your first task
			</h2>
			<p className="mb-8 max-w-md text-center text-muted-foreground">
				What&apos;s something you need to work on in{" "}
				<strong>{projectName}</strong>? This task will be added to your inbox
				for processing.
			</p>

			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="w-full max-w-sm space-y-4"
				>
					<FormField
						control={form.control}
						name="title"
						render={({ field }) => (
							<FormItem>
								<FormLabel>What needs to be done?</FormLabel>
								<FormControl>
									<Input
										placeholder="e.g. Design login page, Fix database migration"
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
								<FormLabel>
									Description{" "}
									<span className="text-muted-foreground">(optional)</span>
								</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Add any extra context or details..."
										className="resize-none"
										rows={3}
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="flex gap-3">
						<Button
							type="button"
							variant="outline"
							className="flex-1"
							onClick={onBack}
						>
							Back
						</Button>
						<Button type="submit" className="flex-1" disabled={isSubmitting}>
							{isSubmitting ? "Adding..." : "Add task"}
						</Button>
					</div>

					<Button
						type="button"
						variant="ghost"
						className="w-full text-muted-foreground"
						onClick={onSkip}
					>
						Skip for now
					</Button>
				</form>
			</Form>
		</div>
	);
}
