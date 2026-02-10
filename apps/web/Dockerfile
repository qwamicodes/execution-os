# =============================================================================
# Web Dockerfile — Multi-stage build
# Bun for install/build, Node.js for runtime (Next.js standalone)
# =============================================================================

# --- Stage 1: Install dependencies ---
FROM oven/bun:1.2-debian AS base

WORKDIR /app

# Copy workspace root files
COPY package.json bun.lock ./
COPY turbo.json ./

# Copy all workspace package.json files (all required for lockfile resolution)
COPY apps/api/package.json apps/api/package.json
COPY apps/auth/package.json apps/auth/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/biome-config/package.json packages/biome-config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/tailwind-config/package.json packages/tailwind-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/ui-native/package.json packages/ui-native/package.json

# Install all dependencies
RUN bun install --frozen-lockfile

# --- Stage 2: Build ---
FROM base AS builder

WORKDIR /app

# Copy source code needed for web build
COPY packages/typescript-config packages/typescript-config
COPY packages/biome-config packages/biome-config
COPY packages/ui packages/ui
COPY packages/tailwind-config packages/tailwind-config
COPY apps/web apps/web

# Build Next.js (standalone output)
RUN bunx turbo run build --filter=web

# --- Stage 3: Production ---
FROM node:22-slim AS production

WORKDIR /app

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static apps/web/.next/static
COPY --from=builder /app/apps/web/public apps/web/public

ENV NODE_ENV=production
ENV PORT=8900
ENV HOSTNAME=0.0.0.0

EXPOSE 8900

CMD ["node", "apps/web/server.js"]
