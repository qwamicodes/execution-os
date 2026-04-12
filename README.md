# Execution OS

Execution OS is a monorepo for planning and execution workflows with:
- AI-assisted document planning (PRD/TSD/contract -> phases/tasks/milestones)
- Separate Ideas and Tasks domains (mutually exclusive)
- Session-based focus execution with scratchpad and history
- Projects with parts and milestones

## Monorepo structure

### Apps
- `apps/api`: Bun + Elysia backend API
- `apps/dashboard`: React + Vite dashboard (TanStack Router/Query)
- `apps/auth`: auth app
- `apps/mobile`: mobile app
- `apps/desktop`: desktop app
- `apps/web`: legacy/auxiliary web app

### Packages
- `packages/database`: Prisma schema, migrations, generated client
- `packages/ui`: shared UI components
- `packages/ui-native`: shared native UI
- `packages/biome-config`, `packages/tailwind-config`, `packages/typescript-config`

## Current system highlights

- PM AI planner now uses a draft -> review -> approve flow.
- Planner output is document-driven by default (no required task/milestone count caps).
- If full-plan JSON fails, segmented generation fallback is used instead of truncation.
- Approving a draft without a selected project prompts creation of a destination project.
- Ideas have a separate lifecycle from tasks.
- Task/Idea title+description edits trigger AI reclassification flows where implemented.
- Session focus page (`/sessions/$sessionId`) supports custom timer extension input.
- Search query filtering is available on Tasks, Ideas, and Projects lists.

## Prerequisites

- Bun `1.2.x`
- Node `>=18`
- PostgreSQL + Redis (see `infrastructure/`)

## Install

```bash
bun install
```

## Run (common local setup)

```bash
# Starts API + dashboard + auth (repo default)
bun run dev
```

You can also run one app:

```bash
bun --filter @repo/api run dev
bun --filter dashboard run dev
```

## Deployment

Deployment is Docker Compose based and split into:
- infrastructure services (`postgres`, `redis`)
- application services (`migrate`, `api`, `web`, `auth`, `dashboard`)

### 1. Prepare env file

Use one of:
- `infrastructure/docker/.env.staging`
- `infrastructure/docker/.env.production`

Or copy from `infrastructure/docker/.env.example` and fill values.

### 2. Start infrastructure

```bash
docker compose \
  --env-file infrastructure/docker/.env.staging \
  -f infrastructure/docker/infra.compose.yml \
  up -d
```

### 3. Start app services (includes migrate job)

```bash
docker compose \
  --env-file infrastructure/docker/.env.staging \
  -f infrastructure/docker/app.compose.yml \
  up -d --build
```

### 4. Verify

```bash
docker compose \
  --env-file infrastructure/docker/.env.staging \
  -f infrastructure/docker/app.compose.yml \
  ps
```

### 5. Rollout updates

```bash
docker compose \
  --env-file infrastructure/docker/.env.staging \
  -f infrastructure/docker/app.compose.yml \
  up -d --build
```

### 6. Stop

```bash
docker compose \
  --env-file infrastructure/docker/.env.staging \
  -f infrastructure/docker/app.compose.yml \
  down
```

To also remove data volumes:

```bash
docker compose \
  --env-file infrastructure/docker/.env.staging \
  -f infrastructure/docker/infra.compose.yml \
  down -v
```

### Production

Use the production env file in the same commands:

```bash
--env-file infrastructure/docker/.env.production
```

## Database (Prisma 7)

```bash
# generate prisma client
bun --filter @repo/database run db:generate

# apply local migrations
bun --filter @repo/database run db:migrate:dev

# deploy migrations (staging/prod style)
bun --filter @repo/database run db:migrate:deploy
```

## Type checks

```bash
bun run check-types

# scoped
bun run check-types --filter=@repo/api
bun run check-types --filter=dashboard
```

## Key routes

- `/tasks` and `/tasks/$taskId`
- `/ideas` and `/ideas/$ideaId`
- `/projects` and `/projects/$projectId`
- `/sessions`, `/sessions/$sessionId`, `/sessions/history`
- `/ai` (planner + PM AI operations)

## Notes

- Project type enum uses `Clients | Core | InHouse | Office`.
- Search filters use `searchQuery` end-to-end; backend also supports legacy `search`.
- Keep migrations committed in `packages/database/prisma/migrations`.
