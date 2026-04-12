import { existsSync } from "node:fs";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

if (process.env.NODE_ENV !== "production" && existsSync(".env.local")) {
	config({ path: ".env.local", quiet: true });
}

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
		seed: "bun prisma/seed.ts",
	},
	datasource: {
		url: process.env.DATABASE_URL,
	},
});
