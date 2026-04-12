import { t } from "elysia";
import { z } from "zod";

export const CreateIdeaSchema = t.Object({
	title: t.String({ minLength: 1, maxLength: 500 }),
	description: t.Optional(t.String()),
	size: t.Optional(
		t.Union([
			t.Literal("Small"),
			t.Literal("Medium"),
			t.Literal("Large"),
			t.Literal("Huge"),
		]),
	),
	urgency: t.Optional(
		t.Union([
			t.Literal("Urgent"),
			t.Literal("High"),
			t.Literal("Medium"),
			t.Literal("Low"),
		]),
	),
	deadline: t.Optional(t.String({ format: "date-time" })),
	source: t.Optional(t.String()),
});

export const UpdateIdeaSchema = t.Partial(CreateIdeaSchema);
export const UpdateIdeaWithStateSchema = t.Composite([
	UpdateIdeaSchema,
	t.Object({
		state: t.Optional(
			t.Union([
				t.Literal("Captured"),
				t.Literal("Classified"),
				t.Literal("Clarified"),
				t.Literal("Planned"),
				t.Literal("Incubating"),
				t.Literal("Archived"),
			]),
		),
	}),
]);

export const IdeaQuerySchema = z.object({
	state: z
		.enum([
			"Captured",
			"Classified",
			"Clarified",
			"Planned",
			"Incubating",
			"Archived",
		])
		.optional(),
	size: z.enum(["Small", "Medium", "Large", "Huge"]).optional(),
	sortBy: z.enum(["createdAt", "updatedAt", "deadline", "title"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(-1).max(100).default(50),
	search: z.string().max(200).optional(),
	searchQuery: z.string().max(200).optional(),
});

export type CreateIdeaInput = typeof CreateIdeaSchema.static;
export type UpdateIdeaInput = typeof UpdateIdeaWithStateSchema.static;
export type IdeaQueryInput = z.infer<typeof IdeaQuerySchema>;
