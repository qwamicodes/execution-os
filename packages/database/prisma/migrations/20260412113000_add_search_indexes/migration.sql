CREATE INDEX IF NOT EXISTS "projects_name_idx" ON "projects"("name");
CREATE INDEX IF NOT EXISTS "projects_userId_name_idx" ON "projects"("userId", "name");

CREATE INDEX IF NOT EXISTS "tasks_title_idx" ON "tasks"("title");
CREATE INDEX IF NOT EXISTS "tasks_userId_title_idx" ON "tasks"("userId", "title");

CREATE INDEX IF NOT EXISTS "ideas_title_idx" ON "ideas"("title");
CREATE INDEX IF NOT EXISTS "ideas_userId_title_idx" ON "ideas"("userId", "title");
