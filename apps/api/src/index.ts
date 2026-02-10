import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { errorMiddleware } from "./middleware/error";
import { authController } from "./modules/auth/auth.controller";
import { inboxController } from "./modules/inbox/inbox.controller";
import { projectController } from "./modules/projects/project.controller";
import { searchController } from "./modules/search/search.controller";
import { sessionController } from "./modules/sessions/session.controller";
import { taskController } from "./modules/tasks/task.controller";
import { logger } from "./shared/logger";

const port = Number(process.env.PORT) || 8901;

const app = new Elysia()
	.use(
		cors({
			origin: process.env.CORS_ORIGIN || "http://localhost:8900",
			credentials: true,
		}),
	)
	.use(errorMiddleware)

	// Health check
	.get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))

	// API v1 routes
	.group("/api/v1", (app) =>
		app
			.use(authController)
			.use(taskController)
			.use(sessionController)
			.use(projectController)
			.use(inboxController)
			.use(searchController),
	)

	.listen(port);

logger.info(`API server running on port ${port}`, "server");

export type App = typeof app;
