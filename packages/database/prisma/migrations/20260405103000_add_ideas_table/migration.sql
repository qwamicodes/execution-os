-- CreateTable
CREATE TABLE "ideas" (
  "id" UUID NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "state" "TaskState" NOT NULL DEFAULT 'Inbox',
  "size" "TaskSize",
  "urgency" "TaskUrgency",
  "protected" BOOLEAN NOT NULL DEFAULT false,
  "protectionReason" VARCHAR(100),
  "tags" VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[],
  "deadline" TIMESTAMPTZ(6),
  "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
  "sourceMetadata" JSONB,
  "userId" UUID NOT NULL,
  "projectId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "stateChangedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ(6),
  CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ideas_userId_idx" ON "ideas"("userId");
CREATE INDEX "ideas_projectId_idx" ON "ideas"("projectId");
CREATE INDEX "ideas_state_idx" ON "ideas"("state");
CREATE INDEX "ideas_deadline_idx" ON "ideas"("deadline");
CREATE INDEX "ideas_createdAt_idx" ON "ideas"("createdAt");
CREATE INDEX "ideas_deletedAt_idx" ON "ideas"("deletedAt");
CREATE INDEX "ideas_userId_state_idx" ON "ideas"("userId", "state");
CREATE INDEX "ideas_projectId_state_idx" ON "ideas"("projectId", "state");

-- AddForeignKey
ALTER TABLE "ideas"
ADD CONSTRAINT "ideas_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ideas"
ADD CONSTRAINT "ideas_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
