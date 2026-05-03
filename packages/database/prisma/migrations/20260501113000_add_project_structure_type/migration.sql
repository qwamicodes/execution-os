DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ProjectStructureType'
  ) THEN
    CREATE TYPE "ProjectStructureType" AS ENUM ('SingleRepo', 'Monorepo');
  END IF;
END $$;

ALTER TABLE "projects"
ADD COLUMN IF NOT EXISTS "structureType" "ProjectStructureType" NOT NULL DEFAULT 'SingleRepo';

CREATE INDEX IF NOT EXISTS "projects_structureType_idx"
ON "projects"("structureType");
