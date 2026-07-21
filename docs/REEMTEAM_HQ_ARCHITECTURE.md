# ReemTeamHQ Architecture

ReemTeamHQ is the private command center for running, understanding, managing, and growing ReemTeam.

This repository is now a clean slate. The previous RGE product structure was removed, and the product shell is ReemTeamHQ from the root down.

## Modules

1. Command Center
2. Players / CRM
3. Users
4. Tables
5. Cribs
6. Events
7. Game Intelligence
8. Growth Plays
9. Content Studio
10. Referrals / Rewards
11. Wallet / Ops
12. Support
13. Analytics / What Worked
14. System Health
15. Settings

## Runtime Shape

- API: `apps/hq-api`
- Dashboard: `apps/hq-dashboard`
- Shared contracts: `packages/shared`
- Scoring and recommendation logic: `packages/intelligence`
- Visual tokens: `packages/ui`

## Guardrails

- Do not make RGE the product shell.
- Do not use "opportunity" product language in new user-facing surfaces.
- Use Growth Plays for recommended moves.
- Use Content Studio for content creation, approval, scheduling, and result tracking.
- Keep MongoDB and Render deployment practical for the existing repository.
