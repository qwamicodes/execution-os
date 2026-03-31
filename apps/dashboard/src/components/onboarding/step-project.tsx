import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ProjectType } from "@/lib/types";

const PROJECT_COLORS = [
	"#6366f1", // indigo
	"#8b5cf6", // violet
	"#ec4899", // pink
	"#f43f5e", // rose
	"#f97316", // orange
	"#eab308", // yellow
	"#22c55e", // green
	"#06b6d4", // cyan
	"#3b82f6", // blue
	"#64748b", // slate
];

const projectSchema = z.object({
	name: z.string().min(1, "Project name is required").max(100),
	type: z.enum(["Clients", "Core", "SideQuest", "Office"]),
	color: z.string(),
});

type ProjectValues = z.infer<typeof projectSchema>;

interface StepProjectProps {
	onNext: (data: { name: string; type: ProjectType; color: string }) => void;
	onBack: () => void;
	isSubmitting: boolean;
}

export function StepProject({
	onNext,
	onBack,
	isSubmitting,
}: StepProjectProps) {
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
		{
			value: "Core",
			emoji: "🎯",
			label: "Core",
			desc: "SaaS products and company growth",
		},
		{
			value: "SideQuest",
			emoji: "🧪",
			label: "SideQuest",
			desc: "Playful experiments and learning",
		},
	] as const;

	const form = useForm<ProjectValues>({
		resolver: zodResolver(projectSchema),
		defaultValues: {
			name: "",
			type: "Core",
			color: PROJECT_COLORS[0],
		},
	});

	function onSubmit(data: ProjectValues) {
		onNext(data);
	}

	return (
		<div className="flex flex-col items-center">
			<h2 className="mb-2 text-2xl font-bold tracking-tight">
				Create your first project
			</h2>
			<p className="mb-8 max-w-md text-center text-muted-foreground">
				Projects organize your tasks by priority tier. <strong>Clients</strong>{" "}
				and <strong>Office</strong> are top priority, <strong>Core</strong> is
				important growth work, and <strong>SideQuest</strong> is for free-time
				exploration.
			</p>

			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="w-full max-w-sm space-y-6"
				>
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Project name</FormLabel>
								<FormControl>
									<Input placeholder="e.g. Work, Side Project" {...field} />
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
								<FormLabel>Project type</FormLabel>
								<FormControl>
									<div className="grid grid-cols-2 gap-2">
										{projectTypes.map((type) => (
											<button
												key={type.value}
												type="button"
												onClick={() => field.onChange(type.value)}
												className={`flex min-h-23 flex-col items-start justify-between rounded-md border px-3 py-2 text-left transition-colors ${
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
								<FormDescription>Pick a color for your project</FormDescription>
								<FormControl>
									<div className="flex flex-wrap gap-2">
										{PROJECT_COLORS.map((color) => (
											<button
												key={color}
												type="button"
												className={`h-8 w-8 rounded-full transition-all ${
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
							{isSubmitting ? "Creating..." : "Create project"}
						</Button>
					</div>
				</form>
			</Form>
		</div>
	);
}
