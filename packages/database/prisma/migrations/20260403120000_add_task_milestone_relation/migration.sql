ALTER TABLE "tasks"
ADD COLUMN "milestone_id" UUID;

CREATE INDEX "tasks_milestone_id_idx" ON "tasks"("milestone_id");

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_milestone_id_fkey"
FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
