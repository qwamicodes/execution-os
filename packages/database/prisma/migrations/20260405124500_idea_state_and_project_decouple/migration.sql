-- Create idea state enum
DO $$ BEGIN
  CREATE TYPE "IdeaState" AS ENUM ('Captured', 'Classified', 'Clarified', 'Planned', 'Incubating', 'Archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new state column and map existing values
ALTER TABLE "ideas" ADD COLUMN IF NOT EXISTS "state_new" "IdeaState" NOT NULL DEFAULT 'Captured';

UPDATE "ideas"
SET "state_new" = CASE "state"::text
  WHEN 'Inbox' THEN 'Captured'::"IdeaState"
  WHEN 'Ongoing' THEN 'Classified'::"IdeaState"
  WHEN 'Ready' THEN 'Clarified'::"IdeaState"
  WHEN 'Active' THEN 'Clarified'::"IdeaState"
  WHEN 'Blocked' THEN 'Incubating'::"IdeaState"
  WHEN 'Paused' THEN 'Incubating'::"IdeaState"
  WHEN 'Done' THEN 'Archived'::"IdeaState"
  ELSE 'Captured'::"IdeaState"
END;

ALTER TABLE "ideas" DROP COLUMN IF EXISTS "state";
ALTER TABLE "ideas" RENAME COLUMN "state_new" TO "state";

-- Remove optional project link from ideas
ALTER TABLE "ideas" DROP CONSTRAINT IF EXISTS "ideas_projectId_fkey";
DROP INDEX IF EXISTS "ideas_projectId_idx";
DROP INDEX IF EXISTS "ideas_projectId_state_idx";
ALTER TABLE "ideas" DROP COLUMN IF EXISTS "projectId";
