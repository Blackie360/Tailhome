# TailHome dashboard

Vite + React UI for the installed TailHome board. It is built into `apps/tailhome/internal/dashboard/web/static` and served by `tailhome serve`.

```bash
pnpm --filter @tailhome/dashboard dev
pnpm --filter @tailhome/dashboard build
apps/tailhome/scripts/sync-dashboard-ui.sh
```

Point the Vite proxy at a local `tailhome serve` process for `/api` data.
