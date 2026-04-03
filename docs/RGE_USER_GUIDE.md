# RGE User Guide

This guide explains how an operator uses ReemGrowth Engine (`RGE`) day to day.

RGE is now organized around a single operator workflow:

detect -> recommend -> create -> approve -> publish -> learn

The goal is to make RGE feel like an assistant instead of a toolbox.

## What RGE Does

RGE turns live ReemTeam gameplay activity into operator-ready social content.

The normal flow is:

1. Sync live gameplay intelligence from the ReemTeam backend.
2. Review ranked `Opportunities`.
3. Create a `Content Item` from the best opportunity.
4. Review the generated brief, copy variants, and media in one place.
5. Approve, schedule, or publish the content item.
6. Track performance so future recommendations get smarter.

## Before You Start

Make sure these are already set up:

- RGE is deployed and reachable in the browser
- You have an operator login:
  - `OPERATOR_EMAIL`
  - `OPERATOR_PASSWORD`
- The live ReemTeam backend feed is reachable through `BACKEND_API_BASE_URL`
- `BACKEND_INTERNAL_TOKEN` is correct if the feed is protected
- Mongo and Redis are healthy
- Workers are running
- Media output and asset directories are writable
- Instagram publishing credentials are configured if you plan to publish

If those are not ready yet, use [RENDER_SETUP.md](/e:/code/ReemTeamMasterWeb/RGE/docs/RENDER_SETUP.md) first.

## Signing In

1. Open the public RGE URL.
2. Enter your operator email and password.
3. After login, RGE opens in `Command Center`.

If your session expires, sign in again.

## Top Navigation

The main navigation is now:

- `Command Center`
- `Opportunities`
- `Pipeline`
- `Calendar`
- `Performance`
- `Library`
- `Growth Loops`
- `Settings`

Advanced and legacy internal routes still exist, but they are no longer the main operator experience.

## Operator Modes

RGE supports three operator modes.

### Assisted

This is the default and recommended mode.

RGE will:

- sync
- rank opportunities
- generate briefs and copy
- recommend presets, platforms, and timing

You will:

- approve each content item before it goes live

### Autopilot

RGE will:

- sync
- detect opportunities
- draft content items
- generate media
- auto-schedule safe content when guardrails allow

You will:

- review failures, degraded health, and exceptions

### Manual

RGE will:

- surface opportunities and internal context

You will:

- trigger more steps yourself
- use deeper controls when you want power-user behavior

Change modes in `Settings`.

## Recommended Daily Workflow

### 1. Start In Command Center

Use `Command Center` as your home page.

It answers:

- what happened recently
- what matters most
- what needs review
- what is ready to schedule or publish
- what is scheduled next
- what is underperforming
- whether the machine is healthy

Check:

- `Top Opportunities Today`
- `Needs Review`
- `Ready to Schedule / Publish`
- `Upcoming Scheduled Content`
- `System Health`

If health looks degraded, fix that first.

### 2. Sync Live Intelligence

Use `Sync backend feed` in the sidebar.

This pulls fresh gameplay intelligence from the live ReemTeam backend and updates:

- player snapshots
- leaderboards
- ranked signals
- operator-facing opportunities

If sync fails, check:

- `BACKEND_API_BASE_URL`
- `BACKEND_INTERNAL_TOKEN`
- live backend availability

### 3. Review Opportunities

Open `Opportunities`.

Each card now tells you:

- the headline
- why it matters
- why you are seeing it
- recommended angle
- recommended format
- recommended platforms
- urgency
- confidence
- estimated value
- source gameplay signals

Operator-facing opportunities prioritize moments like:

- `Reem Moment`
- `Big Payout`
- `High Stakes Win`
- `Win Streak`
- `VIP Win`
- `Referral Momentum`
- `Hot Player`
- `Biggest Earner`
- `Most Reems`
- `Community Moment`
- `Leaderboard Movement`

RGE does not surface deposit momentum as an operator-facing recommended opportunity.

Actions:

- `Create Post`
- `Save for Later`
- `Dismiss`

### 4. Turn The Best Opportunity Into A Content Item

When you click `Create Post`, RGE creates a unified `Content Item`.

A content item contains:

- source opportunity
- source signals
- brief
- caption variants
- selected visual preset
- media status and preview
- publish state
- schedule details
- performance summary once live

This replaces the old need to bounce between ideas, briefs, variants, and jobs.

### 5. Work The Pipeline

Open `Pipeline`.

Use the Kanban board and detail rail together.

Content item stages are:

- `New Opportunity`
- `Draft Ready`
- `Needs Review`
- `Approved`
- `Scheduled`
- `Published`
- `Underperforming`
- `Archived`
- `Won't Use`

The right-side review rail is the main operator workspace.

From one place you can:

- approve
- regenerate copy
- regenerate media
- swap variant
- swap visual preset
- save draft
- schedule
- publish now
- archive

### 6. Review Media Carefully

Media generation is now tracked with explicit statuses:

- `queued`
- `processing`
- `succeeded`
- `failed`

If media fails, the content item and diagnostics panel should show the failure reason.

Media previews appear in:

- the content item review rail
- the pipeline
- the library

### 7. Use Calendar To Manage Cadence

Open `Calendar` to review scheduled and published content by day.

Use it to confirm:

- content spacing
- publish windows
- platform mix
- what is going live next

### 8. Learn From Performance

Open `Performance`.

This view answers:

- what posts performed best
- what hooks worked best
- what formats worked best
- what story types worked best
- what publish windows worked best
- what is underperforming

Tracked metrics include:

- engagement
- clicks
- signups
- deposits if available internally
- conversion influence

Deposits may be tracked analytically, but they do not drive operator-facing opportunity promotion.

### 9. Use Library To Move Faster

Open `Library` for reusable assets and creative building blocks.

Use it for:

- uploaded images and videos
- visual presets
- overlay patterns
- hook patterns
- CTA templates
- brand voice presets

You can also upload and auto-edit assets here.

### 10. Keep Growth Loops Separate

Open `Growth Loops` for:

- referral codes
- invite tracking
- reward application

This keeps referral operations available without mixing them into the daily content-approval flow.

## Settings And Confidence Checks

Open `Settings` to manage:

- operator mode
- system health
- media diagnostics
- advanced and legacy route access

Watch these carefully:

- ReemTeam backend connectivity
- intelligence sync health
- Mongo health
- Redis health
- worker heartbeat health
- media queue health
- publishing queue health
- media output directory health
- asset directory health
- FFmpeg availability
- Canvas render health
- last sync time
- last successful media render time

## Best Practices

- Start in `Command Center`, not raw internal routes.
- Work the highest-confidence fresh opportunities first.
- Review one content item end-to-end before moving on.
- Use the recommendation explanation to move faster, not to second-guess blindly.
- Regenerate copy or media when the item is close but not right.
- Keep an eye on `System Health` before scheduling a heavy batch.
- Use `Manual` mode only when you truly need deeper control.

## Troubleshooting

### Opportunities are stale

Check:

- last sync time in `Settings`
- `BACKEND_API_BASE_URL`
- `BACKEND_INTERNAL_TOKEN`
- backend availability

### Media is stuck or failed

Check:

- media diagnostics
- worker heartbeat status
- media queue health
- FFmpeg availability
- Canvas render health
- asset path validity
- media output directory health

### Scheduling or publishing is blocked

Check:

- whether the content item is approved
- whether media succeeded
- whether guardrails blocked a repeated narrative
- platform approvals in settings
- publishing queue health

### Health shows Redis down

Expect:

- scheduling and queue-backed workflows to degrade
- diagnostics to surface failures quickly

Restore Redis before relying on automated execution.

## Quick Start

If you want the shortest version:

1. Sign in.
2. Check `Command Center`.
3. Click `Sync backend feed`.
4. Open `Opportunities`.
5. Click `Create Post` on the best opportunity.
6. Review the content item in the right rail.
7. Approve it.
8. Schedule or publish it.
9. Watch `Performance` and `Settings`.
