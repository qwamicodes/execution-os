DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IdeaState') THEN
    CREATE TYPE "IdeaState_v2" AS ENUM ('Captured', 'Classified', 'Clarified', 'Planned', 'Incubating', 'Archived');

    ALTER TABLE "ideas" ADD COLUMN IF NOT EXISTS "state_v2" "IdeaState_v2";

    UPDATE "ideas"
    SET "state_v2" = CASE "state"::text
      WHEN 'Captured' THEN 'Captured'::"IdeaState_v2"
      WHEN 'Clarifying' THEN 'Classified'::"IdeaState_v2"
      WHEN 'Validated' THEN 'Clarified'::"IdeaState_v2"
      WHEN 'Classified' THEN 'Classified'::"IdeaState_v2"
      WHEN 'Clarified' THEN 'Clarified'::"IdeaState_v2"
      WHEN 'Planned' THEN 'Planned'::"IdeaState_v2"
      WHEN 'Incubating' THEN 'Incubating'::"IdeaState_v2"
      WHEN 'Archived' THEN 'Archived'::"IdeaState_v2"
      ELSE 'Captured'::"IdeaState_v2"
    END;

    ALTER TABLE "ideas" ALTER COLUMN "state_v2" SET NOT NULL;
    ALTER TABLE "ideas" ALTER COLUMN "state_v2" SET DEFAULT 'Captured';

    ALTER TABLE "ideas" DROP COLUMN "state";
    ALTER TABLE "ideas" RENAME COLUMN "state_v2" TO "state";

    DROP TYPE "IdeaState";
    ALTER TYPE "IdeaState_v2" RENAME TO "IdeaState";
  END IF;
END $$;
