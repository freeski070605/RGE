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
npm run seed:players -w @reemteam/hq-api
```

`inspect:players` lists Mongo collections, document counts, and sample keys so you can find the legacy player collection. `seed:players` imports/upserts existing players into the new HQ `users` and `user_profiles` collections. By default it checks `hq_user_profiles`, `hq_users`, `players`, `Players`, `player`, `Player`, `users`, `Users`, `user`, and `User`. Set `MONGODB_URI` plus optional `LEGACY_MONGODB_URI`, `PLAYER_SOURCE_COLLECTIONS`, `PLAYER_IMPORT_LIMIT`, and `PLAYER_IMPORT_DRY_RUN=true` before running it.

## Product Loop

Game Activity -> HQ Intelligence -> Recommended Action -> Operator Approval -> Execution -> Performance Feedback -> Smarter Recommendations
