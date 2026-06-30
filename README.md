# ReemTeam HQ

ReemTeam HQ is the private backend/admin command center for the ReemTeam ecosystem.

This repository is the existing `RGE` git repo, but the product being created here is **ReemTeam HQ**. RGE is no longer the standalone app. The new **RGE Growth Engine** is a native HQ module that turns Game Intelligence Signals into Growth Plays.

## New Platform Structure

- `apps/hq-api`: fresh ReemTeam HQ backend/API
- `apps/hq-dashboard`: fresh HQ dashboard shell
- `packages/shared`: HQ contracts, roles, module names, tags, and product language
- `packages/game-rules`: ReemTeam gameplay constants and signal helpers
- `packages/intelligence`: brand-new Game Intelligence and RGE Growth Engine scoring
- `packages/ui`: shared UI tokens for the premium dark command-center interface

The old `src/` and `dashboard/` folders are legacy implementation material. New HQ work should happen in the `apps/` and `packages/` structure above.

## Commands

```bash
npm run build
npm run dev
```

The API defaults to `http://localhost:4010` and serves the new HQ dashboard shell from `apps/hq-dashboard`.
