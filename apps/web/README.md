# Web App (Legacy/Auxiliary)

`apps/web` is a Next.js app kept in this monorepo for auxiliary web flows.

Primary product surfaces currently live in:
- `apps/dashboard` (main UI)
- `apps/api` (backend)
- `apps/auth` (auth flows)

## Run this app

```bash
bun --filter web run dev
```

## Notes

- If you are working on core execution features (tasks, ideas, projects, sessions, PM-AI), use `apps/dashboard` + `apps/api`.
- Route and feature docs are maintained at the repository root `README.md`.
