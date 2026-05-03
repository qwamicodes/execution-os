CREATE TABLE "project_epics" (
  "id" UUID NOT NULL,
  "key" VARCHAR(40),
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(1000),
  "order" SMALLINT,
  "projectId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "project_epics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_epics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_epics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "project_epics_projectId_name_key" ON "project_epics"("projectId", "name");
CREATE INDEX "project_epics_projectId_idx" ON "project_epics"("projectId");
CREATE INDEX "project_epics_userId_idx" ON "project_epics"("userId");
CREATE INDEX "project_epics_order_idx" ON "project_epics"("order");

CREATE TABLE "task_project_epics" (
  "task_id" UUID NOT NULL,
  "epic_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "task_project_epics_pkey" PRIMARY KEY ("task_id", "epic_id"),
  CONSTRAINT "task_project_epics_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_project_epics_epic_id_fkey" FOREIGN KEY ("epic_id") REFERENCES "project_epics"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "task_project_epics_epic_id_idx" ON "task_project_epics"("epic_id");
CREATE INDEX "task_project_epics_task_id_idx" ON "task_project_epics"("task_id");
