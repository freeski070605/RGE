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
```

## Product Loop

Game Activity -> HQ Intelligence -> Recommended Action -> Operator Approval -> Execution -> Performance Feedback -> Smarter Recommendations
