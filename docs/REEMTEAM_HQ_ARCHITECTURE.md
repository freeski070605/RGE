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

- `src`: production ReemTeam HQ API, workers, services, and backend module surface
- `dashboard`: production React/Vite premium dark command-center dashboard
- `apps/hq-api`: phase-one HQ API shell kept as reference material
- `apps/hq-dashboard`: phase-one dashboard shell kept as reference material
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

## Current Runtime Scope Now In Repo

- Production build/start targets the real `src` API, workers, and `dashboard` UI.
- Command Center, RGE Growth Engine, Content Studio, Library/assets, Referrals, Performance, System Health, System Integrity, and Workers routes are connected to services.
- Users/CRM, Cribs, Tables, Events, and HQ Game Intelligence now have database-backed `/api/hq/...` routes for listing, inspection, creation where applicable, and operator updates.
- `/api/hq/modules/readiness` reports connected module surfaces with live collection counts so shells are easy to spot.
- Integration tests cover the core HQ module APIs plus the RGE intelligence-to-content lifecycle.

## Guardrails

- Current production code lives in `src/`, `dashboard/`, and `packages/`; `apps/` is phase-one reference material unless it is intentionally promoted again.
- The RGE Growth Engine inside HQ is new code in `packages/intelligence`.
- Do not import the previous standalone RGE services into the new HQ module.
- Do not use "opportunities" as product language for new work; use Growth Plays.
- Do not make RGE the product shell; ReemTeam HQ is the product shell.
