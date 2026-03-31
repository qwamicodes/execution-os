import { PrismaClient } from "../generated/prisma/client";

import { config } from "dotenv";

config({ path: ".env.local" });

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "../generated/prisma/client";
