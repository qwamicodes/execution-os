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
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateIdea } from "@/hooks/use-ideas";
import { runWithPromiseToast } from "@/lib/toast";

const logIdeaSchema = z.object({
	title: z.string().min(1, "Title is required").max(500),
	description: z.string().max(10000).optional(),
});

type LogIdeaValues = z.infer<typeof logIdeaSchema>;

interface LogIdeaDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function LogIdeaDialog({ open, onOpenChange }: LogIdeaDialogProps) {
	const createIdea = useCreateIdea();

	const form = useForm<LogIdeaValues>({
		resolver: zodResolver(logIdeaSchema),
		defaultValues: {
			title: "",
			description: "",
		},
	});

	async function onSubmit(values: LogIdeaValues) {
		await runWithPromiseToast("Capture idea", () =>
			createIdea.mutateAsync({
				title: values.title.trim(),
				description: values.description?.trim() || undefined,
			}),
		);
		form.reset();
		onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Log idea</DialogTitle>
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
											placeholder="What idea do you want to capture?"
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
											placeholder="Why this idea matters and what outcome you want..."
											className="resize-none"
											rows={4}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="flex justify-end gap-2 pt-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={createIdea.isPending}>
								{createIdea.isPending ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : null}
								{createIdea.isPending ? "Saving..." : "Save idea"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
