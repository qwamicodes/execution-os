-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('Clients', 'Core', 'SideQuest');

-- CreateEnum
CREATE TYPE "TaskState" AS ENUM ('Inbox', 'Ongoing', 'Ready', 'Active', 'Blocked', 'Paused', 'Done');

-- CreateEnum
CREATE TYPE "TaskSize" AS ENUM ('Small', 'Medium', 'Large', 'Huge');

-- CreateEnum
CREATE TYPE "TaskUrgency" AS ENUM ('Urgent', 'High', 'Medium', 'Low');

-- CreateEnum
CREATE TYPE "SessionState" AS ENUM ('Active', 'Paused', 'Completed', 'Abandoned');

-- CreateEnum
CREATE TYPE "SessionOutcome" AS ENUM ('Done', 'Continue', 'Blocked', 'TooBig');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('Slack', 'Gmail', 'Linear', 'GitHub', 'GitLab', 'Bitbucket', 'Voice');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255),
    "name" VARCHAR(100) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "type" "ProjectType" NOT NULL DEFAULT 'Core',
    "color" VARCHAR(7),
    "sideQuestState" VARCHAR(20),
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "state" "TaskState" NOT NULL DEFAULT 'Inbox',
    "size" "TaskSize",
    "urgency" "TaskUrgency",
    "protected" BOOLEAN NOT NULL DEFAULT false,
    "protectionReason" VARCHAR(100),
    "tags" VARCHAR(50)[],
    "priority" INTEGER,
    "priorityOverride" INTEGER,
    "priorityOverrideUntil" TIMESTAMPTZ(6),
    "priorityOverrideReason" VARCHAR(200),
    "estimatedSessions" SMALLINT,
    "completedSessions" SMALLINT NOT NULL DEFAULT 0,
    "deadline" TIMESTAMPTZ(6),
    "parentId" UUID,
    "order" SMALLINT,
    "userId" UUID NOT NULL,
    "projectId" UUID,
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "sourceMetadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "stateChangedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "state_history" (
    "id" UUID NOT NULL,
    "fromState" "TaskState" NOT NULL,
    "toState" "TaskState" NOT NULL,
    "reason" VARCHAR(200),
    "taskId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "state_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "state" "SessionState" NOT NULL DEFAULT 'Active',
    "outcome" "SessionOutcome",
    "duration" SMALLINT NOT NULL DEFAULT 30,
    "actualDuration" SMALLINT,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMPTZ(6),
    "resumedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "scratchpad" TEXT,
    "notes" TEXT,
    "blockerNote" VARCHAR(500),
    "taskId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMPTZ(6),
    "config" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "lastSyncAt" TIMESTAMPTZ(6),

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" UUID NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "userId" UUID,
    "requestId" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "projects"("userId");

-- CreateIndex
CREATE INDEX "projects_type_idx" ON "projects"("type");

-- CreateIndex
CREATE INDEX "projects_archivedAt_idx" ON "projects"("archivedAt");

-- CreateIndex
CREATE INDEX "projects_deletedAt_idx" ON "projects"("deletedAt");

-- CreateIndex
CREATE INDEX "tasks_userId_idx" ON "tasks"("userId");

-- CreateIndex
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");

-- CreateIndex
CREATE INDEX "tasks_state_idx" ON "tasks"("state");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "tasks_priorityOverrideUntil_idx" ON "tasks"("priorityOverrideUntil");

-- CreateIndex
CREATE INDEX "tasks_deadline_idx" ON "tasks"("deadline");

-- CreateIndex
CREATE INDEX "tasks_parentId_idx" ON "tasks"("parentId");

-- CreateIndex
CREATE INDEX "tasks_createdAt_idx" ON "tasks"("createdAt");

-- CreateIndex
CREATE INDEX "tasks_deletedAt_idx" ON "tasks"("deletedAt");

-- CreateIndex
CREATE INDEX "tasks_userId_state_priority_idx" ON "tasks"("userId", "state", "priority");

-- CreateIndex
CREATE INDEX "tasks_projectId_state_idx" ON "tasks"("projectId", "state");

-- CreateIndex
CREATE INDEX "state_history_taskId_idx" ON "state_history"("taskId");

-- CreateIndex
CREATE INDEX "state_history_userId_idx" ON "state_history"("userId");

-- CreateIndex
CREATE INDEX "state_history_createdAt_idx" ON "state_history"("createdAt");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_taskId_idx" ON "sessions"("taskId");

-- CreateIndex
CREATE INDEX "sessions_state_idx" ON "sessions"("state");

-- CreateIndex
CREATE INDEX "sessions_outcome_idx" ON "sessions"("outcome");

-- CreateIndex
CREATE INDEX "sessions_startedAt_idx" ON "sessions"("startedAt");

-- CreateIndex
CREATE INDEX "sessions_completedAt_idx" ON "sessions"("completedAt");

-- CreateIndex
CREATE INDEX "sessions_userId_state_idx" ON "sessions"("userId", "state");

-- CreateIndex
CREATE INDEX "sessions_userId_completedAt_idx" ON "sessions"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "integrations_userId_idx" ON "integrations"("userId");

-- CreateIndex
CREATE INDEX "integrations_type_idx" ON "integrations"("type");

-- CreateIndex
CREATE INDEX "integrations_enabled_idx" ON "integrations"("enabled");

-- CreateIndex
CREATE INDEX "event_logs_eventType_idx" ON "event_logs"("eventType");

-- CreateIndex
CREATE INDEX "event_logs_userId_idx" ON "event_logs"("userId");

-- CreateIndex
CREATE INDEX "event_logs_createdAt_idx" ON "event_logs"("createdAt");

-- CreateIndex
CREATE INDEX "event_logs_requestId_idx" ON "event_logs"("requestId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "state_history" ADD CONSTRAINT "state_history_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "state_history" ADD CONSTRAINT "state_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
