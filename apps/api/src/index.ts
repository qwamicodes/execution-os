import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { prisma } from "@repo/database";
import { Elysia } from "elysia";
import { env } from "./config";
import { errorMiddleware } from "./middleware/error";
import { aiController } from "./modules/ai/ai.controller";
import { authController } from "./modules/auth/auth.controller";
import { realtimeController } from "./modules/events/realtime.controller";
import { ideaController } from "./modules/ideas/idea.controller";
import { inboxController } from "./modules/inbox/inbox.controller";
import { integrationController } from "./modules/integrations/integration.controller";
import { pmAIController } from "./modules/pm-ai/pm-ai.controller";
import { projectController } from "./modules/projects/project.controller";
import { searchController } from "./modules/search/search.controller";
import { sessionController } from "./modules/sessions/session.controller";
import { startPriorityRecalculationScheduler } from "./modules/tasks/priority.scheduler";
import { taskController } from "./modules/tasks/task.controller";
import { basePlugin } from "./plugins/base";
import { logger } from "./shared/logger";

const port = Number(env.PORT);

prisma
	.$connect()
	.then(() => {
		logger.info({ event: "prisma_connected" });
	})
	.catch((error) => {
		logger.error({ event: "prisma_connection_failed", error });
	});

startPriorityRecalculationScheduler();

const app = new Elysia()
	.use(
		cors({
			origin: env.CORS_ORIGIN,
			credentials: true,
		}),
	)
	.use(openapi())
	.use(basePlugin)
	.use(errorMiddleware)

	// health check
	.get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))

	// api v1 routes
	.group("/api/v1", (app) =>
		app
			.use(authController)
			.use(aiController)
			.use(pmAIController)
			.use(integrationController)
			.use(ideaController)
			.use(realtimeController)
			.use(taskController)
			.use(sessionController)
			.use(projectController)
			.use(inboxController)
			.use(searchController),
	)

	.listen(port);

logger.info({ event: "server_started", port }, "Execution OS server running");

export type App = typeof app;
