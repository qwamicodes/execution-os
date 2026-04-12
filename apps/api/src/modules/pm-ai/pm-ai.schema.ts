import { z } from "zod";

export const PMAIVideoSourceSchema = z.enum([
	"jam.dev",
	"loom",
	"upload",
	"youtube",
]);

export const AnalyzeVideoSchema = z
	.object({
		videoSource: PMAIVideoSourceSchema,
		videoUrl: z.string().url().nullable().optional(),
		videoFile: z.string().min(1).nullable().optional(),
		additionalContext: z.string().max(4000).optional(),
	})
	.refine((value) => Boolean(value.videoUrl || value.videoFile), {
		message: "Provide either videoUrl or videoFile",
		path: ["videoUrl"],
	});

export const AnalyzeImagesSchema = z.object({
	images: z
		.array(
			z.object({
				source: z.enum(["upload", "figma", "url", "clipboard"]),
				url: z.string().url().nullable().optional(),
				base64: z.string().min(1).nullable().optional(),
			}),
		)
		.min(1)
		.max(10),
	context: z.string().max(5000).optional(),
	requestType: z.enum(["feature", "bug"]).default("feature"),
});

export const PMAIDecomposeTaskSchema = z.object({
	taskId: z.string().min(1),
	decompositionStrategy: z
		.enum(["auto", "architectural", "feature", "sequential"])
		.default("auto"),
});

export const PMAISuggestAssigneeSchema = z.object({
	taskId: z.string().min(1).optional(),
	requiredSkills: z.array(z.string().min(1).max(80)).min(1).max(30),
	currentSprint: z.string().max(100).nullable().optional(),
	teamMemberIds: z.array(z.string().uuid()).min(1).max(50).optional(),
});

export const PMAIPlanSprintSchema = z.object({
	sprintId: z.string().min(1).max(120),
	durationWeeks: z.number().int().min(1).max(8),
	teamMemberIds: z.array(z.string().uuid()).min(1).max(50),
	backlogTaskIds: z.array(z.string().uuid()).min(1).max(300),
	goalType: z.enum(["max_completion", "balanced", "specific_tasks"]),
});

export const PMAIRebalanceSprintSchema = z.object({
	sprintId: z.string().min(1).max(120),
	currentDay: z.number().int().min(1).max(60),
	progressData: z
		.array(
			z.object({
				userId: z.string().uuid(),
				completedSessions: z.number().int().min(0),
				expectedSessions: z.number().int().min(0),
				remainingTasks: z.array(z.string().uuid()).max(200),
			}),
		)
		.min(1)
		.max(100),
});

export const PMAIDocumentTypeSchema = z.enum([
	"tsd",
	"prd",
	"contract",
	"feature_spec",
]);

export const PMAIIngestDocumentSchema = z
	.object({
		documentType: PMAIDocumentTypeSchema,
		title: z.string().min(1).max(200).optional(),
		documentText: z.string().min(1).max(500_000).optional(),
		documentBase64: z.string().min(1).max(1_500_000).optional(),
		feedbackInstructions: z.string().max(2000).optional(),
		projectId: z.string().uuid().optional(),
		ideaTaskId: z.string().uuid().optional(),
		usageMode: z.enum(["individual", "team"]).default("individual"),
		teamMemberIds: z.array(z.string().uuid()).max(50).optional(),
		createTasks: z.boolean().default(false),
		createMilestones: z.boolean().default(false),
		selectedMilestoneTitles: z
			.array(z.string().min(1).max(200))
			.max(50)
			.optional(),
		maxTasks: z.number().int().min(1).max(300).optional(),
		maxMilestones: z.number().int().min(1).max(120).optional(),
	})
	.refine((value) => Boolean(value.documentText || value.documentBase64), {
		message: "Provide either documentText or documentBase64",
		path: ["documentText"],
	});

export const PMAIIngestDocumentUploadSchema = z.object({
	documentType: PMAIDocumentTypeSchema,
	title: z.string().min(1).max(200).optional(),
	feedbackInstructions: z.string().max(2000).optional(),
	projectId: z.string().uuid().optional(),
	ideaTaskId: z.string().uuid().optional(),
	usageMode: z.enum(["individual", "team"]).default("individual"),
	teamMemberIds: z.array(z.string().uuid()).min(1).max(50).optional(),
	createTasks: z.coerce.boolean().default(false),
	createMilestones: z.coerce.boolean().default(false),
	selectedMilestoneTitles: z
		.array(z.string().min(1).max(200))
		.max(50)
		.optional(),
	maxTasks: z.coerce.number().int().min(1).max(300).optional(),
	maxMilestones: z.coerce.number().int().min(1).max(120).optional(),
});

export const PMAIApproveDocumentPlanSchema = z.object({
	analysisId: z.string().min(1).max(120),
	documentType: PMAIDocumentTypeSchema,
	documentTitle: z.string().min(1).max(200),
	projectId: z.string().uuid().optional(),
	ideaTaskId: z.string().uuid().optional(),
	usageMode: z.enum(["individual", "team"]).default("individual"),
	teamMemberIds: z.array(z.string().uuid()).max(50).optional(),
	createTasks: z.boolean().default(true),
	createMilestones: z.boolean().default(true),
	selectedMilestoneTitles: z
		.array(z.string().min(1).max(200))
		.max(50)
		.optional(),
	maxTasks: z.number().int().min(1).max(300).optional(),
	maxMilestones: z.number().int().min(1).max(120).optional(),
	generation: z
		.object({
			provider: z.string().nullable().optional(),
			model: z.string().nullable().optional(),
		})
		.optional(),
	plan: z.unknown(),
});

export type AnalyzeVideoInput = z.infer<typeof AnalyzeVideoSchema>;
export type AnalyzeImagesInput = z.infer<typeof AnalyzeImagesSchema>;
export type PMAIDecomposeTaskInput = z.infer<typeof PMAIDecomposeTaskSchema>;
export type PMAISuggestAssigneeInput = z.infer<
	typeof PMAISuggestAssigneeSchema
>;
export type PMAIPlanSprintInput = z.infer<typeof PMAIPlanSprintSchema>;
export type PMAIRebalanceSprintInput = z.infer<
	typeof PMAIRebalanceSprintSchema
>;
export type PMAIDocumentType = z.infer<typeof PMAIDocumentTypeSchema>;
export type PMAIIngestDocumentInput = z.infer<typeof PMAIIngestDocumentSchema>;
export type PMAIIngestDocumentUploadInput = z.infer<
	typeof PMAIIngestDocumentUploadSchema
>;
export type PMAIApproveDocumentPlanInput = z.infer<
	typeof PMAIApproveDocumentPlanSchema
>;
