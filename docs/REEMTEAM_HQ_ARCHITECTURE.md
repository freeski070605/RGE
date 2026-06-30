# ReemTeam HQ Architecture

ReemTeam HQ is the private backend and admin command center for the ReemTeam ecosystem. RGE now means **RGE Growth Engine**, a native HQ module that turns gameplay and admin activity into Growth Plays.

This is a fresh HQ product direction, not a compatibility pass over the previous standalone posting workflow.

## Product Language

- Main dashboard: Command Center
- Intelligence layer: Game Intelligence
- Growth work item: Growth Play
- Content workspace: Content Studio
- RGE module name: RGE Growth Engine

Avoid old workflow framing such as treating every recommendation as a social post. A Growth Play can recommend content, promos, notifications, event boosts, table priority changes, support alerts, referral pushes, or admin action.

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

## Intelligence Pipeline

HQ Data -> Game Intelligence Signals -> Growth Plays -> Operator Action -> Content/Promo/Event/User Action -> Performance Result -> Learning Feedback

## Phase Plan

Phase 1 establishes auth/roles, the Command Center shell, Users CRUD, CRM profile, Admin action log, and System Health shell.

Phase 2 adds Crib CRUD, Table CRUD, Event CRUD, Game session viewer, and Leaderboard viewer.

Phase 3 adds GameEvent ingestion, GameIntelligenceSignal, GrowthPlay, scoring, and the required "Why this?" explanation.

Phase 4 adds the RGE Growth Plays dashboard, Campaigns, Content Studio, caption generation, visual presets, approval flow, and calendar.

Phase 5 adds referrals, in-app promo actions, push notification support, automation rules, performance learning, and recommended next actions.

## First Repo Pass

This repo now contains HQ-native domain constants in `src/hq/domain.ts`, blueprint API support in `src/services/hq/hqBlueprintService.ts`, and fresh Mongoose models under `src/db/models/hq`.

The existing standalone RGE implementation remains available while routes and UI can migrate toward the HQ module names and data contracts.
