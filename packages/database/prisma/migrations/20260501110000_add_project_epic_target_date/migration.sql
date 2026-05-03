ALTER TABLE "project_epics"
ADD COLUMN IF NOT EXISTS "targetDate" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "project_epics_targetDate_idx"
ON "project_epics"("targetDate");
