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
npm run hq:players:sync -w @reemteam/hq-api
```

`inspect:players` lists Mongo collections, document counts, and sample keys so you can verify the live ReemTeam data source. `inspect:player` shows one player's original `users` record, real wallet, recent transactions, completed-match rollup, legacy HQ profile if present, and daily stat rollup; set `PLAYER_LOOKUP=username` before running it. ReemTeamHQ reads original `users`, `wallets`, `matches`, and `transactions` first so balances and lifetime stats match the main ReemTeam app. HQ no longer creates player overlay records.

## Product Loop

Game Activity -> HQ Intelligence -> Recommended Action -> Operator Approval -> Execution -> Performance Feedback -> Smarter Recommendations
