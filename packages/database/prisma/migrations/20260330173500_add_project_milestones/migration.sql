DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MilestoneStatus') THEN
        CREATE TYPE "MilestoneStatus" AS ENUM ('Pending', 'Completed', 'AtRisk');
    END IF;
END $$;

ALTER TYPE "MilestoneStatus" ADD VALUE IF NOT EXISTS 'Pending';
ALTER TYPE "MilestoneStatus" ADD VALUE IF NOT EXISTS 'Completed';
ALTER TYPE "MilestoneStatus" ADD VALUE IF NOT EXISTS 'AtRisk';

ALTER TABLE "projects"
ADD COLUMN IF NOT EXISTS "targetCompletionDate" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "project_milestones" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "targetDate" TIMESTAMPTZ(6),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'Pending',
    "order" SMALLINT,
    "completedAt" TIMESTAMPTZ(6),
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "projects_targetCompletionDate_idx" ON "projects"("targetCompletionDate");
CREATE INDEX IF NOT EXISTS "project_milestones_projectId_idx" ON "project_milestones"("projectId");
CREATE INDEX IF NOT EXISTS "project_milestones_userId_idx" ON "project_milestones"("userId");
CREATE INDEX IF NOT EXISTS "project_milestones_targetDate_idx" ON "project_milestones"("targetDate");
CREATE INDEX IF NOT EXISTS "project_milestones_status_idx" ON "project_milestones"("status");
CREATE INDEX IF NOT EXISTS "project_milestones_createdAt_idx" ON "project_milestones"("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_milestones_projectId_fkey'
    ) THEN
        ALTER TABLE "project_milestones"
        ADD CONSTRAINT "project_milestones_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_milestones_userId_fkey'
    ) THEN
        ALTER TABLE "project_milestones"
        ADD CONSTRAINT "project_milestones_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
