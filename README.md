# ReemTeam HQ

ReemTeam HQ is the private backend/admin command center for the ReemTeam ecosystem.

This repository is the existing `RGE` git repo, but the product being created here is **ReemTeam HQ**. RGE is no longer the standalone app. The new **RGE Growth Engine** is a native HQ module that turns Game Intelligence Signals into Growth Plays.

## Platform Structure

- `src`: ReemTeam HQ backend/API, workers, services, and database-backed module routes
- `dashboard`: React/Vite command-center dashboard served by the API in production
- `apps/hq-api`: phase-one static API shell kept as reference material
- `apps/hq-dashboard`: phase-one static dashboard shell kept as reference material
- `packages/shared`: HQ contracts, roles, module names, tags, and product language
- `packages/game-rules`: ReemTeam gameplay constants and signal helpers
- `packages/intelligence`: brand-new Game Intelligence and RGE Growth Engine scoring
- `packages/ui`: shared UI tokens for the premium dark command-center interface

The production runtime uses `src` for the API/workers and `dashboard` for the operator UI. The older `apps/` shell is intentionally not the build/start target.

## Commands

```bash
npm run build
npm run build:all
npm run dev
npm run worker:dev
npm run test:integration
```

The API defaults to `http://localhost:4010`, serves the built dashboard from `dashboard/dist`, and exposes the core HQ modules under `/api/hq/...`.
