# =============================================================================
# API Dockerfile — Multi-stage Bun build
# Uses Debian because argon2 has native C bindings that require glibc
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

# Copy source code
COPY packages/database packages/database
COPY packages/typescript-config packages/typescript-config
COPY packages/biome-config packages/biome-config
COPY apps/api apps/api

# Generate Prisma client
RUN bunx prisma generate --schema packages/database/prisma/schema.prisma

# Build the API
RUN bun build apps/api/src/index.ts --outdir apps/api/dist --target bun

# --- Stage 3: Production ---
FROM oven/bun:1.2-debian AS production

WORKDIR /app

# Copy workspace root for module resolution
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

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Copy built output
COPY --from=builder /app/apps/api/dist apps/api/dist

# Copy Prisma schema and generated client
COPY --from=builder /app/packages/database/prisma packages/database/prisma
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma node_modules/@prisma

ENV NODE_ENV=production
ENV PORT=8901

EXPOSE 8901

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:8901/health || exit 1

CMD ["bun", "apps/api/dist/index.js"]
