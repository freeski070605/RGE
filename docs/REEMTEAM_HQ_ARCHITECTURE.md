# ReemTeam HQ Architecture

ReemTeam HQ is the private backend/admin command center for the ReemTeam ecosystem.

This is not a patch of the previous standalone RGE platform. The product root is **ReemTeam HQ**. The RGE module inside it is a completely new **RGE Growth Engine** that turns Game Intelligence Signals into Growth Plays.

## Product Language

- Main dashboard: Command Center
- Intelligence layer: Game Intelligence
- Growth work item: Growth Play
- Content workspace: Content Studio
- Growth module: RGE Growth Engine

Avoid old workflow language. A Growth Play is not always a social post. It can recommend creating content, promoting a crib, filling a table, boosting an event, sending notifications, pushing referrals, reactivating users, alerting admins, or changing table promotion priority.

## Monorepo Structure

- `apps/hq-api`: ReemTeam HQ API and backend module surface
- `apps/hq-dashboard`: premium dark command-center dashboard shell
- `packages/shared`: HQ contracts and product language
- `packages/game-rules`: ReemTeam gameplay concepts, special wins, and signal definitions
- `packages/intelligence`: Game Intelligence and the new RGE Growth Engine scoring logic
- `packages/ui`: shared visual tokens

## Core Modules

1. Command Center
2. CRM
3. Users
4. Tables
5. Cribs
6. Events
7. Game Intelligence
8. RGE Growth Engine
9. Content Studio
10. Referrals
11. Wallet/Ops
12. Support
13. Analytics
14. System Health

## Pipeline

HQ Data -> Game Intelligence Signals -> Growth Plays -> Operator Action -> Content/Promo/Event/User Action -> Performance Result -> Learning Feedback

## Phase 1 Scope Now In Repo

- Fresh HQ repo structure inside the existing `RGE` git repo
- Command Center API shell
- Users/CRM profile shell
- Cribs, Tables, Events shell
- Game Intelligence signal API
- New RGE Growth Engine package and Growth Plays API
- Content Studio shell
- System Health shell
- Dashboard shell that presents ReemTeam HQ as the product

## Guardrails

- New platform code lives in `apps/` and `packages/`.
- The RGE Growth Engine inside HQ is new code in `packages/intelligence`.
- Do not import the previous standalone RGE services into the new HQ module.
- Do not use "opportunities" as product language for new work; use Growth Plays.
- Do not make RGE the product shell; ReemTeam HQ is the product shell.
