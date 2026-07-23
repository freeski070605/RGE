# ReemTeamHQ

ReemTeamHQ is the private command center that turns ReemTeam activity into smarter operations, stronger player management, and real growth moves.

This repository was reset from the old RGE application into a fresh ReemTeamHQ product surface. The old app code is intentionally gone.

## Structure

- `apps/hq-api`: Node, TypeScript, Express, MongoDB, Redis/BullMQ-ready HQ API
- `apps/hq-dashboard`: React and Vite command-center dashboard
- `packages/shared`: product language, roles, enums, and shared types
- `packages/intelligence`: Growth Play scoring and explanation logic
- `packages/ui`: shared dashboard tokens

## Commands

```bash
npm install
npm run dev
npm run dev:dashboard
npm run build
npm test
npm run inspect:players -w @reemteam/hq-api
npm run inspect:player -w @reemteam/hq-api
npm run seed:players -w @reemteam/hq-api
npm run hq:players:sync -w @reemteam/hq-api
```

`inspect:players` lists Mongo collections, document counts, and sample keys so you can find the legacy player collection. `inspect:player` shows one player's raw legacy profile, real wallet, recent transactions, completed-match rollup, current HQ overlay, and daily stat rollup; set `PLAYER_LOOKUP=username` before running it. `hq:players:sync` creates missing HQ overlay records for original ReemTeam players without overwriting original balances or stats. `seed:players` remains available for explicit migration/backfill work, but ReemTeamHQ reads original `hq_users`, `hq_user_profiles`, `wallets`, `matches`, and `transactions` first.

## Product Loop

Game Activity -> HQ Intelligence -> Recommended Action -> Operator Approval -> Execution -> Performance Feedback -> Smarter Recommendations
