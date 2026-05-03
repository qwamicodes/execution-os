import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { goeyToast as toast } from "goey-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useUpdateProject } from "@/hooks/use-projects";
import { PROJECT_COLORS } from "@/lib/constants";
import type { Project } from "@/lib/types";

const editProjectSchema = z.object({
	name: z.string().min(1, "Name is required").max(100),
	description: z.string().max(500).optional(),
	structureType: z.enum(["SingleRepo", "Monorepo"]),
	color: z.string(),
});

type EditProjectValues = z.infer<typeof editProjectSchema>;

interface EditProjectDialogProps {
	project: Project;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function EditProjectDialog({
	project,
	open,
	onOpenChange,
}: EditProjectDialogProps) {
	const updateProject = useUpdateProject();

	const form = useForm<EditProjectValues>({
		resolver: zodResolver(editProjectSchema),
		defaultValues: {
			name: project.name,
			description: project.description || "",
			structureType: project.structureType || "SingleRepo",
			color: project.color || PROJECT_COLORS[0],
		},
	});

	const projectStructures = [
		{
			value: "SingleRepo",
			label: "Single repo",
			desc: "Hide technical parts for a simple project structure",
		},
		{
			value: "Monorepo",
			label: "Monorepo",
			desc: "Use parts to track which app or service owns the work",
		},
	] as const;

	function onSubmit(data: EditProjectValues) {
		updateProject.mutate(
			{
				id: project.id,
				data: {
					name: data.name,
					description: data.description || undefined,
					structureType: data.structureType,
					color: data.color,
				},
			},
			{
				onSuccess: () => {
					toast.success("Project updated");
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
					<DialogTitle>Edit project</DialogTitle>
					<DialogDescription>
						Update the project details that affect planning and task grouping.
					</DialogDescription>
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
										<Textarea className="resize-none" rows={2} {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="structureType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Structure</FormLabel>
									<FormControl>
										<div className="grid grid-cols-2 gap-2">
											{projectStructures.map((structure) => (
												<button
													key={structure.value}
													type="button"
													onClick={() => field.onChange(structure.value)}
													className={`flex min-h-[76px] flex-col items-start justify-between rounded-md border px-3 py-2 text-left transition-colors ${
														field.value === structure.value
															? "border-primary bg-primary/5"
															: "border-border hover:border-primary/40"
													}`}
												>
													<div className="text-sm font-medium">
														{structure.label}
													</div>
													<div className="text-xs text-muted-foreground">
														{structure.desc}
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

						<div className="flex justify-end gap-2 border-t pt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								className="bg-primary text-primary-foreground hover:bg-primary/90"
								disabled={updateProject.isPending}
							>
								{updateProject.isPending ? "Saving..." : "Save changes"}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
