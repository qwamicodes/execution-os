-- CreateTable
CREATE TABLE "project_parts" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "order" SMALLINT,
  "projectId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "project_parts_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "part_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "project_parts_projectId_name_key" ON "project_parts"("projectId", "name");
CREATE INDEX "project_parts_projectId_idx" ON "project_parts"("projectId");
CREATE INDEX "project_parts_userId_idx" ON "project_parts"("userId");
CREATE INDEX "project_parts_order_idx" ON "project_parts"("order");
CREATE INDEX "tasks_part_id_idx" ON "tasks"("part_id");

-- AddForeignKey
ALTER TABLE "project_parts"
ADD CONSTRAINT "project_parts_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_parts"
ADD CONSTRAINT "project_parts_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_part_id_fkey"
FOREIGN KEY ("part_id") REFERENCES "project_parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
