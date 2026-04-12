import Elysia from "elysia";
import { requestLogger } from "../middleware/request-logger";

export const basePlugin = new Elysia({ name: "base-plugin" }).use(
	requestLogger,
);
