# =============================================================================
# Dashboard Dockerfile — Vite SPA served by vite preview (no nginx)
# Multi-stage: Bun install/build → Bun runtime preview
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

# Copy source code needed for dashboard build
COPY packages/typescript-config packages/typescript-config
COPY packages/biome-config packages/biome-config
COPY packages/ui packages/ui
COPY packages/tailwind-config packages/tailwind-config
COPY apps/dashboard apps/dashboard

# Build Vite SPA
RUN bunx turbo run build --filter=dashboard

# --- Stage 3: Production ---
FROM builder AS production

WORKDIR /app

EXPOSE 8903

CMD ["vite", "preview"]
