import type { Prisma } from "@repo/database";
import { env } from "../../config";
import { prisma } from "../../shared/database";
import { ConflictError, NotFoundError } from "../../shared/errors";
import { logger } from "../../shared/logger";
import type { RequestLogger } from "../../shared/wide-event";
import { classifyTaskWithAI } from "../ai/ai.service";
import type {
	CreateIdeaInput,
	IdeaQueryInput,
	UpdateIdeaInput,
} from "./idea.schema";

const prismaAny = prisma as any;
let ideaStateNormalizationPromise: Promise<void> | null = null;

async function ensureIdeaStateCompatibility() {
	if (ideaStateNormalizationPromise) {
		await ideaStateNormalizationPromise;
		return;
	}

	ideaStateNormalizationPromise = (async () => {
		try {
			await prisma.$executeRawUnsafe(`
DO $$
DECLARE
  state_type text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'IdeaState'
  ) THEN
    CREATE TYPE "IdeaState" AS ENUM ('Captured', 'Classified', 'Clarified', 'Planned', 'Incubating', 'Archived');
  END IF;

  SELECT t.typname
  INTO state_type
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_type t ON a.atttypid = t.oid
  WHERE c.relname = 'ideas'
    AND a.attname = 'state'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF state_type IS NULL THEN
    RETURN;
  END IF;

  IF state_type = 'TaskState' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ideas'
        AND column_name = 'state_new'
    ) THEN
      ALTER TABLE "ideas" ADD COLUMN "state_new" "IdeaState" NOT NULL DEFAULT 'Captured';
    END IF;

    UPDATE "ideas"
    SET "state_new" = CASE "state"::text
      WHEN 'Inbox' THEN 'Captured'::"IdeaState"
      WHEN 'Ongoing' THEN 'Classified'::"IdeaState"
      WHEN 'Ready' THEN 'Clarified'::"IdeaState"
      WHEN 'Active' THEN 'Planned'::"IdeaState"
      WHEN 'Blocked' THEN 'Incubating'::"IdeaState"
      WHEN 'Paused' THEN 'Incubating'::"IdeaState"
      WHEN 'Done' THEN 'Archived'::"IdeaState"
      WHEN 'Clarifying' THEN 'Classified'::"IdeaState"
      WHEN 'Validated' THEN 'Clarified'::"IdeaState"
      WHEN 'Captured' THEN 'Captured'::"IdeaState"
      WHEN 'Classified' THEN 'Classified'::"IdeaState"
      WHEN 'Clarified' THEN 'Clarified'::"IdeaState"
      WHEN 'Planned' THEN 'Planned'::"IdeaState"
      WHEN 'Incubating' THEN 'Incubating'::"IdeaState"
      WHEN 'Archived' THEN 'Archived'::"IdeaState"
      ELSE 'Captured'::"IdeaState"
    END;

    ALTER TABLE "ideas" DROP COLUMN "state";
    ALTER TABLE "ideas" RENAME COLUMN "state_new" TO "state";
  ELSIF state_type IN ('text', 'varchar', 'bpchar') THEN
    ALTER TABLE "ideas"
    ALTER COLUMN "state" TYPE "IdeaState"
    USING (
      CASE "state"::text
        WHEN 'Inbox' THEN 'Captured'
        WHEN 'Ongoing' THEN 'Classified'
        WHEN 'Ready' THEN 'Clarified'
        WHEN 'Active' THEN 'Planned'
        WHEN 'Blocked' THEN 'Incubating'
        WHEN 'Paused' THEN 'Incubating'
        WHEN 'Done' THEN 'Archived'
        WHEN 'Clarifying' THEN 'Classified'
        WHEN 'Validated' THEN 'Clarified'
        WHEN 'Captured' THEN 'Captured'
        WHEN 'Classified' THEN 'Classified'
        WHEN 'Clarified' THEN 'Clarified'
        WHEN 'Planned' THEN 'Planned'
        WHEN 'Incubating' THEN 'Incubating'
        WHEN 'Archived' THEN 'Archived'
        ELSE 'Captured'
      END
    )::"IdeaState";
  ELSE
    UPDATE "ideas"
    SET "state" = CASE "state"::text
      WHEN 'Clarifying' THEN 'Classified'::"IdeaState"
      WHEN 'Validated' THEN 'Clarified'::"IdeaState"
      ELSE "state"
    END
    WHERE "state"::text IN ('Clarifying', 'Validated');
  END IF;
END $$;
      `);
		} catch (error) {
			logger.warn({
				event: "idea_state_compatibility_check_failed",
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	})();

	await ideaStateNormalizationPromise;
}

function mapIdeaStateToTaskState(state: string) {
	if (state === "Captured") return "Inbox";
	if (state === "Classified") return "Ongoing";
	if (state === "Clarified") return "Ready";
	if (state === "Planned") return "Active";
	if (state === "Incubating") return "Paused";
	return "Done";
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function toDateOnly(value: string | null | undefined): Date | null {
	if (!value) return null;
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function buildAgentInterviewPrompt(params: {
	title: string;
	description: string | null;
	size?: string | null;
	urgency?: string | null;
	reason?: string | null;
}) {
	const sections = [
		"You are my product discovery partner for this project.",
		"",
		"Use my existing project instructions in this chat/workspace as the primary source of truth.",
		"The idea below is delta context, not a full spec.",
		"",
		`Idea: ${params.title}`,
		`Idea context: ${params.description ?? "No additional context provided."}`,
		`Planning hints: size=${params.size ?? "unknown"}, urgency=${params.urgency ?? "unknown"}`,
		`AI notes: ${params.reason ?? "None"}`,
		"",
		"Goal:",
		"Interview me until you have at least 95% confidence about what should be built.",
		"Focus on what I actually want, not what sounds generally correct.",
		"",
		"Operating rules:",
		"1) Ask 3-5 high-impact clarifying questions per round (no fluff).",
		"2) After each round, provide:",
		"   - Confidence score (0-100)",
		"   - What is known",
		"   - Open questions",
		"   - Key assumptions and risks",
		"3) Challenge weak assumptions and ambiguous scope directly.",
		"4) Keep questions decision-oriented (users, success metrics, constraints, sequencing, risks).",
		"",
		"When confidence >= 95%, output:",
		"- Final project brief",
		"- PRD-ready scope",
		"- TSD-ready technical constraints",
		"- Milestone breakdown",
		"- First implementation slice",
		"",
		"Start now with the first question set.",
	];

	return sections.join("\n");
}

async function classifyIdeaWithRetry(
	idea: {
		id: string;
		title: string;
		description: string | null;
		source: string;
	},
	userId: string,
) {
	let classification: Awaited<ReturnType<typeof classifyTaskWithAI>> | null = null;
	for (
		let attempt = 1;
		attempt <= env.AI_CLASSIFICATION_RETRY_ATTEMPTS;
		attempt++
	) {
		try {
			classification = await classifyTaskWithAI({
				title: idea.title,
				description: idea.description,
				source: idea.source,
			});
			break;
		} catch (error) {
			logger.warn({
				event: "idea_classification_attempt_failed",
				idea_id: idea.id,
				user_id: userId,
				attempt,
				error: error instanceof Error ? error.message : "Unknown error",
			});
			if (attempt < env.AI_CLASSIFICATION_RETRY_ATTEMPTS) {
				await sleep(400 * 2 ** (attempt - 1));
			}
		}
	}
	return classification;
}

function mergeIdeaMetadata(
	existing: Prisma.JsonValue | null | undefined,
	patch: Record<string, unknown>,
) {
	const base = asRecord(existing) ?? {};
	return {
		...base,
		...patch,
	} as Prisma.InputJsonValue;
}

export async function classifyAndClarifyIdea(
	userId: string,
	id: string,
	requestLogger?: RequestLogger,
) {
	await ensureIdeaStateCompatibility();
	requestLogger?.set("idea_service", {
		operation: "classify_and_clarify",
		idea_id: id,
		user_id: userId,
	});
	const idea = await prismaAny.idea.findFirst({
		where: { id, userId, deletedAt: null },
	});
	if (!idea) throw new NotFoundError("Idea");

	const classification = await classifyIdeaWithRetry(
		{
			id: idea.id,
			title: idea.title,
			description: idea.description,
			source: idea.source,
		},
		userId,
	);

	if (!classification) {
		return prismaAny.idea.update({
			where: { id: idea.id },
			data: {
				sourceMetadata: mergeIdeaMetadata(idea.sourceMetadata, {
					aiClassification: {
						status: "failed",
						attempts: env.AI_CLASSIFICATION_RETRY_ATTEMPTS,
						failedAt: new Date().toISOString(),
					},
				}),
			},
		});
	}

	const parsedDeadline = toDateOnly(classification.deadline) ?? idea.deadline;
	const rewrittenTitle = classification.rewrittenTitle || idea.title;
	const rewrittenDescription =
		classification.rewrittenDescription || idea.description;
	const agentInterviewPrompt = buildAgentInterviewPrompt({
		title: rewrittenTitle,
		description: rewrittenDescription,
		size: classification.size,
		urgency: classification.urgency,
		reason: classification.reason ?? null,
	});
	const nowIso = new Date().toISOString();

	await prismaAny.idea.update({
		where: { id: idea.id },
		data: {
			state: "Classified",
			stateChangedAt: new Date(),
			size: classification.size,
			urgency: classification.urgency,
			deadline: parsedDeadline,
			sourceMetadata: mergeIdeaMetadata(idea.sourceMetadata, {
				aiClassification: {
					status: "classified",
					confidence: classification.confidence ?? 0.75,
					provider: classification.provider,
					model: classification.model,
					reason: classification.reason ?? null,
					classifiedAt: nowIso,
				},
			}),
		},
	});

	return prismaAny.idea.update({
		where: { id: idea.id },
		data: {
			state: "Clarified",
			stateChangedAt: new Date(),
			title: rewrittenTitle,
			description: rewrittenDescription,
			sourceMetadata: mergeIdeaMetadata(idea.sourceMetadata, {
				aiClassification: {
					status: "clarified",
					confidence: classification.confidence ?? 0.75,
					provider: classification.provider,
					model: classification.model,
					reason: classification.reason ?? null,
					classifiedAt: nowIso,
					clarifiedAt: new Date().toISOString(),
				},
				agentInterviewPrompt,
			}),
		},
	});
}

export async function listIdeas(
	userId: string,
	query: IdeaQueryInput,
	logger?: RequestLogger,
) {
	await ensureIdeaStateCompatibility();
	logger?.set("idea_service", { operation: "list", user_id: userId });
	const where: any = {
		userId,
		deletedAt: null,
	};

	if (query.state) where.state = query.state;
	if (query.size) where.size = query.size;
	const searchQuery = query.searchQuery ?? query.search;
	if (searchQuery) {
		where.OR = [
			{ title: { contains: searchQuery, mode: "insensitive" } },
			{ description: { contains: searchQuery, mode: "insensitive" } },
		];
	}

	const orderBy: any = {
		[query.sortBy]: query.sortOrder,
	};

	const skip = query.limit === -1 ? undefined : (query.page - 1) * query.limit;
	const take = query.limit === -1 ? undefined : query.limit;

	const [ideas, total] = await Promise.all([
		prismaAny.idea.findMany({ where, orderBy, skip, take }),
		prismaAny.idea.count({ where }),
	]);

	return { ideas, total };
}

export async function getIdea(userId: string, id: string, logger?: RequestLogger) {
	await ensureIdeaStateCompatibility();
	logger?.set("idea_service", { operation: "get", idea_id: id, user_id: userId });
	const idea = await prismaAny.idea.findFirst({
		where: { id, userId, deletedAt: null },
	});
	if (!idea) throw new NotFoundError("Idea");
	return idea;
}

export async function createIdea(
	userId: string,
	input: CreateIdeaInput,
	logger?: RequestLogger,
) {
	await ensureIdeaStateCompatibility();
	logger?.set("idea_service", { operation: "create", user_id: userId });

	const created = await prismaAny.idea.create({
		data: {
			title: input.title,
			description: input.description,
			size: input.size,
			urgency: input.urgency,
			deadline: input.deadline ? new Date(input.deadline) : undefined,
			source: input.source ?? "manual",
			userId,
		},
	});

	try {
		return await classifyAndClarifyIdea(userId, created.id, logger);
	} catch (error) {
		logger?.set("idea_ai_pipeline", {
			status: "failed_after_create",
			error: error instanceof Error ? error.message : "Unknown error",
		});
		return created;
	}
}

export async function updateIdea(
	userId: string,
	id: string,
	input: UpdateIdeaInput,
	logger?: RequestLogger,
) {
	await ensureIdeaStateCompatibility();
	logger?.set("idea_service", { operation: "update", idea_id: id, user_id: userId });
	const existing = await prismaAny.idea.findFirst({
		where: { id, userId, deletedAt: null },
		select: { id: true, title: true, description: true },
	});
	if (!existing) throw new NotFoundError("Idea");

	const updated = await prismaAny.idea.update({
		where: { id },
		data: {
			title: input.title,
			description: input.description,
			size: input.size,
			urgency: input.urgency,
			deadline:
				input.deadline === undefined
					? undefined
					: input.deadline
						? new Date(input.deadline)
						: null,
			state: input.state,
			stateChangedAt: input.state ? new Date() : undefined,
		},
	});

	const titleChanged =
		input.title !== undefined && input.title !== existing.title;
	const descriptionChanged =
		input.description !== undefined &&
		(input.description ?? null) !== (existing.description ?? null);

	if (titleChanged || descriptionChanged) {
		try {
			return await classifyAndClarifyIdea(userId, id, logger);
		} catch (error) {
			logger?.set("idea_ai_pipeline", {
				status: "failed_after_update",
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	return updated;
}

export async function deleteIdea(userId: string, id: string, logger?: RequestLogger) {
	await ensureIdeaStateCompatibility();
	logger?.set("idea_service", { operation: "delete", idea_id: id, user_id: userId });
	const existing = await prismaAny.idea.findFirst({
		where: { id, userId, deletedAt: null },
		select: { id: true },
	});
	if (!existing) throw new NotFoundError("Idea");
	await prismaAny.idea.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function convertIdeaToTask(
	userId: string,
	id: string,
	logger?: RequestLogger,
) {
	await ensureIdeaStateCompatibility();
	logger?.set("idea_service", {
		operation: "convert_to_task",
		idea_id: id,
		user_id: userId,
	});
	const idea = await prismaAny.idea.findFirst({
		where: { id, userId, deletedAt: null },
	});
	if (!idea) throw new NotFoundError("Idea");

	const task = await prisma.$transaction(async (tx) => {
		const createdTask = await tx.task.create({
			data: {
				title: idea.title,
				description: idea.description,
				state: mapIdeaStateToTaskState(idea.state),
				size: idea.size,
				urgency: idea.urgency,
				deadline: idea.deadline,
				source: "idea_conversion",
				sourceMetadata: {
					fromIdeaId: idea.id,
					fromIdeaSource: idea.source,
				},
				userId,
			},
		});
		await (tx as any).idea.update({
			where: { id: idea.id },
			data: { deletedAt: new Date(), state: "Archived", stateChangedAt: new Date() },
		});
		return createdTask;
	});

	return task;
}

export async function convertIdeaToProject(
	userId: string,
	id: string,
	logger?: RequestLogger,
) {
	await ensureIdeaStateCompatibility();
	logger?.set("idea_service", {
		operation: "convert_to_project",
		idea_id: id,
		user_id: userId,
	});
	const idea = await prismaAny.idea.findFirst({
		where: { id, userId, deletedAt: null },
	});
	if (!idea) throw new NotFoundError("Idea");
	if (idea.state === "Archived") {
		throw new ConflictError("Archived ideas cannot be converted to projects");
	}

	const project = await prisma.$transaction(async (tx) => {
		const created = await tx.project.create({
			data: {
				name: idea.title,
				description: idea.description,
				type: "Core",
				userId,
			},
		});
		await (tx as any).idea.update({
			where: { id: idea.id },
			data: {
				state: "Archived",
				stateChangedAt: new Date(),
				sourceMetadata: {
					...(idea.sourceMetadata ?? {}),
					conversion: {
						convertedToProjectId: created.id,
						convertedAt: new Date().toISOString(),
					},
				},
			},
		});
		return created;
	});

	return {
		project,
		migration: {
			applied: ["title -> project.name", "description -> project.description"],
			suggestion:
				"Define milestones and create execution tasks from this new project.",
		},
	};
}
