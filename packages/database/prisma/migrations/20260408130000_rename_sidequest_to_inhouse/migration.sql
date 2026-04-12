DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ProjectType'
      AND e.enumlabel = 'SideQuest'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ProjectType'
      AND e.enumlabel = 'InHouse'
  ) THEN
    ALTER TYPE "ProjectType" RENAME VALUE 'SideQuest' TO 'InHouse';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'sideQuestState'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'inHouseState'
  ) THEN
    ALTER TABLE "projects" RENAME COLUMN "sideQuestState" TO "inHouseState";
  END IF;
END $$;
