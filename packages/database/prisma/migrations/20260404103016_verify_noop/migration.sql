/*
  Warnings:

  - You are about to drop the column `milestone_id` on the `tasks` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_milestone_id_fkey";

-- DropIndex
DROP INDEX "tasks_milestone_id_idx";

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "milestone_id",
ADD COLUMN     "milestoneId" UUID;

-- CreateIndex
CREATE INDEX "tasks_milestoneId_idx" ON "tasks"("milestoneId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
