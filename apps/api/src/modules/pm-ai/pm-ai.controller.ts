import Elysia from "elysia";
import { authMiddleware } from "../../middleware/auth";
import { basePlugin } from "../../plugins/base";
import { ValidationError } from "../../shared/errors";
import { success } from "../../shared/response";
import {
	AnalyzeImagesSchema,
	AnalyzeVideoSchema,
	PMAIDecomposeTaskSchema,
	PMAIIngestDocumentSchema,
	PMAIIngestDocumentUploadSchema,
	PMAIPlanSprintSchema,
	PMAIRebalanceSprintSchema,
	PMAISuggestAssigneeSchema,
} from "./pm-ai.schema";
import {
	analyzeImagesInput,
	analyzeVideoInput,
	decomposeTaskForPMAI,
	ingestDocumentAndGeneratePlan,
	ingestUploadedDocumentAndGeneratePlan,
	planSprint,
	rebalanceSprint,
	suggestAssignee,
} from "./pm-ai.service";

export const pmAIController = new Elysia({ prefix: "/pm-ai" })
	.use(basePlugin)
	.use(authMiddleware)

	.post("/analyze-video", async ({ body, userId, internal_logger }) => {
		internal_logger.set("flow", "pm_ai_analyze_video");
		const parsed = AnalyzeVideoSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("pm_ai_input", {
			user_id: userId,
			mode: "video",
			video_source: parsed.data.videoSource,
			has_video_url: Boolean(parsed.data.videoUrl),
			has_video_file: Boolean(parsed.data.videoFile),
		});

		const result = await analyzeVideoInput(
			userId,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", {
			analysis_id: result.analysisId,
			confidence: result.confidence,
		});
		return success(result);
	})

	.post("/analyze-images", async ({ body, userId, internal_logger }) => {
		internal_logger.set("flow", "pm_ai_analyze_images");
		const parsed = AnalyzeImagesSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("pm_ai_input", {
			user_id: userId,
			mode: "images",
			image_count: parsed.data.images.length,
			request_type: parsed.data.requestType,
		});

		const result = await analyzeImagesInput(
			userId,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", {
			analysis_id: result.analysisId,
			confidence: result.confidence,
		});
		return success(result);
	})

	.post("/decompose-task", async ({ body, userId, internal_logger }) => {
		internal_logger.set("flow", "pm_ai_decompose_task");
		const parsed = PMAIDecomposeTaskSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const result = await decomposeTaskForPMAI(
			userId,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", { subtask_count: result.subtasks.length });
		return success(result);
	})

	.post("/suggest-assignee", async ({ body, userId, internal_logger }) => {
		internal_logger.set("flow", "pm_ai_suggest_assignee");
		const parsed = PMAISuggestAssigneeSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const result = await suggestAssignee(userId, parsed.data, internal_logger);
		internal_logger.set("result", {
			has_assignee: Boolean(result.recommended),
			recommended_user_id: result.recommended?.userId ?? null,
		});
		return success(result);
	})

	.post("/plan-sprint", async ({ body, userId, internal_logger }) => {
		internal_logger.set("flow", "pm_ai_plan_sprint");
		const parsed = PMAIPlanSprintSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const result = await planSprint(userId, parsed.data, internal_logger);
		internal_logger.set("result", {
			sprint_id: result.sprintId,
			not_fitting_count: result.tasksNotFitting.length,
		});
		return success(result);
	})

	.post("/rebalance-sprint", async ({ body, userId, internal_logger }) => {
		internal_logger.set("flow", "pm_ai_rebalance_sprint");
		const parsed = PMAIRebalanceSprintSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}

		const result = await rebalanceSprint(userId, parsed.data, internal_logger);
		internal_logger.set("result", {
			rebalance_needed: result.rebalanceNeeded,
			action_count: result.actions.length,
		});
		return success(result);
	})

	.post("/ingest-document", async ({ body, userId, internal_logger }) => {
		internal_logger.set("flow", "pm_ai_ingest_document");
		const parsed = PMAIIngestDocumentSchema.safeParse(body);
		if (!parsed.success) {
			throw new ValidationError(parsed.error.flatten().fieldErrors);
		}
		internal_logger.set("pm_ai_input", {
			user_id: userId,
			document_type: parsed.data.documentType,
			usage_mode: parsed.data.usageMode,
			create_tasks: parsed.data.createTasks,
			create_milestones: parsed.data.createMilestones,
		});

		const result = await ingestDocumentAndGeneratePlan(
			userId,
			parsed.data,
			internal_logger,
		);
		internal_logger.set("result", {
			analysis_id: result.analysisId,
			document_type: result.documentType,
			confidence: result.confidence,
		});
		return success(result);
	})

	.post(
		"/ingest-document/upload",
		async ({ userId, request, internal_logger }) => {
			internal_logger.set("flow", "pm_ai_ingest_document_upload");
			const formData = await request.formData();
			const filePart = formData.get("file");

			if (!(filePart instanceof File)) {
				throw new ValidationError({
					file: ["A valid file is required"],
				});
			}

			const readString = (key: string) => {
				const value = formData.get(key);
				return typeof value === "string" ? value : undefined;
			};

			const teamMemberIdsRaw = formData.get("teamMemberIds");
			let parsedTeamMemberIds: string[] | undefined;
			if (typeof teamMemberIdsRaw === "string" && teamMemberIdsRaw.trim()) {
				try {
					const asJson = JSON.parse(teamMemberIdsRaw);
					if (Array.isArray(asJson)) {
						parsedTeamMemberIds = asJson.map((value) => String(value));
					} else {
						parsedTeamMemberIds = teamMemberIdsRaw
							.split(",")
							.map((entry) => entry.trim())
							.filter(Boolean);
					}
				} catch {
					parsedTeamMemberIds = teamMemberIdsRaw
						.split(",")
						.map((entry) => entry.trim())
						.filter(Boolean);
				}
			}

			const selectedMilestonesRaw = formData.get("selectedMilestoneTitles");
			let parsedSelectedMilestones: string[] | undefined;
			if (
				typeof selectedMilestonesRaw === "string" &&
				selectedMilestonesRaw.trim()
			) {
				try {
					const asJson = JSON.parse(selectedMilestonesRaw);
					if (Array.isArray(asJson)) {
						parsedSelectedMilestones = asJson.map((value) => String(value));
					} else {
						parsedSelectedMilestones = selectedMilestonesRaw
							.split(",")
							.map((entry) => entry.trim())
							.filter(Boolean);
					}
				} catch {
					parsedSelectedMilestones = selectedMilestonesRaw
						.split(",")
						.map((entry) => entry.trim())
						.filter(Boolean);
				}
			}

			const parsed = PMAIIngestDocumentUploadSchema.safeParse({
				documentType: readString("documentType"),
				title: readString("title"),
				projectId: readString("projectId"),
				ideaTaskId: readString("ideaTaskId"),
				usageMode: readString("usageMode"),
				teamMemberIds: parsedTeamMemberIds,
				createTasks: readString("createTasks"),
				createMilestones: readString("createMilestones"),
				selectedMilestoneTitles: parsedSelectedMilestones,
				maxTasks: readString("maxTasks"),
				maxMilestones: readString("maxMilestones"),
			});

			if (!parsed.success) {
				throw new ValidationError(parsed.error.flatten().fieldErrors);
			}
			internal_logger.set("pm_ai_input", {
				user_id: userId,
				filename: filePart.name,
				mime_type: filePart.type,
				size_bytes: filePart.size,
				document_type: parsed.data.documentType,
				usage_mode: parsed.data.usageMode,
				idea_task_id: parsed.data.ideaTaskId ?? null,
				create_milestones: parsed.data.createMilestones,
			});

			const bytes = Buffer.from(await filePart.arrayBuffer());
			const result = await ingestUploadedDocumentAndGeneratePlan(
				userId,
				parsed.data,
				{
					filename: filePart.name,
					mimeType: filePart.type,
					bytes,
				},
				internal_logger,
			);
			internal_logger.set("result", {
				analysis_id: result.analysisId,
				document_type: result.documentType,
				confidence: result.confidence,
			});
			return success(result);
		},
	);
