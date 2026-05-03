CREATE TABLE "task_project_parts" (
  "task_id" UUID NOT NULL,
  "part_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "task_project_parts_pkey" PRIMARY KEY ("task_id", "part_id"),
  CONSTRAINT "task_project_parts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_project_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "project_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "task_project_parts_part_id_idx" ON "task_project_parts"("part_id");
CREATE INDEX "task_project_parts_task_id_idx" ON "task_project_parts"("task_id");

INSERT INTO "task_project_parts" ("task_id", "part_id")
SELECT "id", "part_id"
FROM "tasks"
WHERE "part_id" IS NOT NULL
ON CONFLICT DO NOTHING;
