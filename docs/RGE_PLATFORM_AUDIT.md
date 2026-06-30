# RGE Platform Audit

Audited: 2026-06-30  
Scope: `RGE` backend service, worker system, Mongo models, operator dashboard, and deployment/config files.

## Executive Summary

RGE is the ReemGrowth Engine: an operator-facing growth and marketing platform for ReemTeam.

It turns ReemTeam gameplay data into social content opportunities, creates briefs and caption variants, generates media, schedules/publishes posts, tracks performance, and exposes health checks for the whole pipeline.

The current platform has two generations of workflow:

- Legacy flow: `event -> post -> AI copy -> generated media -> schedule/publish -> analytics`.
- V2 operator flow: `backend feed -> stats/leaderboards/signals -> opportunities -> content items -> briefs -> variants -> media -> publishing jobs -> performance insights`.

The V2 flow is the primary product experience. The legacy routes and models still exist and are useful as compatibility/internal tools.

## What We Have

### Backend API

Location: `src/app.ts`, `src/server.ts`, `src/api/routes.ts`

The API is an Express 5 TypeScript service. It:

- Serves `/api/*` JSON routes.
- Serves generated media from `/media`.
- Serves uploaded/edited assets from `/assets`.
- Serves the built React dashboard from `dashboard/dist` when present.
- Uses Helmet, Morgan logging, cookie parsing, JSON body parsing, URL encoded parsing, and rate limiting.
- Uses a central error handler with `AppError` for expected API failures.

Core dependencies:

- MongoDB via Mongoose.
- Redis/BullMQ for jobs.
- OpenAI for copy/content generation when configured.
- Canvas and FFmpeg for image/video generation.
- Cloudinary optionally for remote storage.
- Instagram Graph API for real publishing when configured.

### Operator Dashboard

Location: `dashboard`

The dashboard is a Vite + React 19 app. It talks to the API through `dashboard/src/lib/api.ts` and renders the operator experience from `dashboard/src/components/AuthenticatedDashboard.tsx`.

Main dashboard areas:

- Command Center: daily operating overview and health snapshot.
- Opportunities: ranked gameplay/content opportunities.
- Pipeline: content item Kanban and review workspace.
- Calendar: scheduled/published content by day.
- Performance: content performance, winners, underperformers, hook/format learnings.
- Library: uploaded assets, visual presets, hooks, CTAs, templates, reusable creative blocks.
- Growth Loops: referrals, invites, and wallet-credit rewards.
- Settings: operator mode and system diagnostics.

### Authentication

Location: `src/services/auth/operatorAuthService.ts`, `src/middleware/auth.ts`

RGE has a simple operator login system:

- Operator credentials come from env vars: `OPERATOR_EMAIL`, `OPERATOR_PASSWORD`, `OPERATOR_NAME`.
- Login issues a JWT in an HTTP-only cookie.
- Protected routes require an authenticated operator session.
- Auth login has a separate rate limit.

There is no multi-user database-backed operator account system yet. It is environment-driven.

## Main Workflows

### 1. Intelligence Sync

Location: `src/services/intelligence/intelligenceService.ts`

RGE pulls gameplay intelligence from the live ReemTeam backend:

`GET {BACKEND_API_BASE_URL}/api/rge/feed?days=N`

The sync stores:

- Player stat snapshots.
- Leaderboard snapshots.
- Game signals.
- Content ideas/opportunities generated from high-priority operator-facing signals.

Important behavior:

- If `BACKEND_INTERNAL_TOKEN` exists, it sends it as `x-rge-token`.
- It upserts player snapshots and leaderboards.
- It upserts signals by unique `signalType + sourceType + sourceId`.
- It automatically creates `ContentIdea` records from top eligible signals.
- It intentionally excludes `deposit_momentum` from operator-facing opportunities.

### 2. Opportunity Ranking

Location: `src/services/operator/opportunityRules.ts`, `src/services/operator/opportunityService.ts`

Signals are translated into operator-facing opportunity cards.

Examples:

- `reem_moment`
- `big_payout`
- `high_stakes_win`
- `win_streak`
- `vip_win`
- `referral_momentum`
- leaderboard-driven opportunities such as `biggest_earner`, `most_reems`, `leaderboard_movement`, `hot_player`

Each opportunity includes:

- A headline/title.
- Why it matters.
- Why RGE is showing it.
- Recommended angle.
- Recommended format.
- Recommended platforms.
- Urgency.
- Confidence score.
- Estimated value.
- Source signals.

### 3. Content Item Pipeline

Location: `src/services/operator/contentItemService.ts`

The `ContentItem` is the unified operator object. It ties together the source opportunity, source signals, brief, variants, selected media, publishing jobs, schedule state, and analytics summary.

Stages:

- `new_opportunity`
- `draft_ready`
- `needs_review`
- `approved`
- `scheduled`
- `published`
- `underperforming`
- `archived`
- `wont_use`

Operator actions include:

- Create content item from opportunity.
- Generate/regenerate copy.
- Generate media.
- Approve.
- Save draft.
- Select variant.
- Select visual preset.
- Schedule.
- Publish now.
- Archive.
- Save opportunity for later.
- Dismiss opportunity.

Operator modes:

- `assisted`: creates generated work but expects approval.
- `autopilot`: can auto-approve/queue media and auto-schedule when guardrails pass.
- `manual`: surfaces context and requires more explicit operator action.

### 4. Briefs And Variants

Location: `src/services/growth/opsService.ts`

RGE can create a creative brief from a content idea, then generate copy variants.

Stored objects:

- `CreativeBrief`: objective, audience, platform, format, tone, hook direction, CTA, asset requirements, notes.
- `ContentVariant`: hook, caption, hashtags, overlay text, CTA, tone, hook style, selected assets, media status.

OpenAI is used when configured. If OpenAI is not configured or output parsing fails, the system has deterministic fallback behavior for legacy post generation and local variant-generation patterns.

### 5. Media Generation

Location: `src/services/media-engine/mediaEngine.ts`, `src/services/growth/opsService.ts`, `src/workers/mediaWorker.ts`

RGE generates:

- Square/social images with Canvas.
- Optional videos using FFmpeg.
- Media for legacy `Post` records.
- Media for V2 `ContentVariant` records.

Media statuses include:

- `pending`
- `queued`
- `processing`
- `completed`
- `succeeded`
- `ready`
- `failed`

Storage behavior:

- Local media goes under `MEDIA_OUTPUT_DIR`.
- Uploaded assets go under `ASSET_UPLOAD_DIR`.
- Cloudinary is used when configured.
- Express serves local media through `/media`.

### 6. Scheduling And Publishing

Location: `src/services/scheduler/schedulerService.ts`, `src/services/social/socialPublisher.ts`, `src/workers/schedulerWorker.ts`

RGE can:

- Schedule legacy posts.
- Schedule V2 publishing jobs.
- Publish immediately.
- Execute scheduled publishing through BullMQ scheduler jobs.

Publishing currently supports:

- `instagram`
- `story`

The publisher uses Instagram Graph API when configured:

- Creates a media container.
- Polls video/story containers until publishable.
- Publishes media.
- Stores provider response and permalink data where available.

Scheduling guardrails check:

- A selected variant exists.
- Format is approved in settings.
- Platforms are approved in settings.
- Media is complete and has no stored error.
- Similar narratives have not been overused in the configured repeat window.

### 7. Performance And Learning

Location: `src/services/analytics/analyticsService.ts`, `src/services/growth/opsService.ts`, `src/services/operator/performanceService.ts`, `src/services/strategy/strategyService.ts`

RGE tracks:

- Clicks.
- Signups.
- Deposits.
- Likes.
- Comments.
- Shares.
- Saves.
- Impressions.
- Performance score.
- Conversion influence.

Performance insights feed back into strategy views:

- Best hooks.
- Best formats.
- Best story types.
- Best publish windows.
- Underperforming items.
- Recommendations for future briefs/content.

### 8. Asset Library

Location: `src/services/assets/assetService.ts`, `src/services/operator/libraryService.ts`

RGE supports:

- Uploading image/video assets.
- Tagging assets.
- Listing assets.
- Auto-editing images into presets: `square`, `story`, `reel`.
- Attaching assets to posts.
- Selecting preferred image/video assets for media generation.
- Deleting assets.

The dashboard library also exposes reusable non-database creative blocks:

- Visual presets.
- Overlays.
- Templates.
- Hook patterns.
- CTA templates.
- Brand voice presets.
- Reusable caption components.

### 9. Referrals And Growth Loops

Location: `src/services/referral/referralService.ts`, `src/services/operator/growthLoopsService.ts`

RGE includes referral operations:

- Create a referral code for a user.
- Record invited users.
- Reward invited users.
- Track invite/reward counts.
- Track total wallet credits awarded.

This is intentionally separate from the daily content approval flow.

### 10. System Health And Integrity

Location: `src/services/system/*`

RGE has health/integrity endpoints and dashboard views for:

- Live ReemTeam backend feed connectivity.
- Mongo connection state.
- Redis ping.
- Worker heartbeats.
- Media queue state.
- Publishing queue state.
- Media output directory access.
- Asset directory access.
- FFmpeg availability.
- Canvas rendering availability.
- Last sync time.
- Last successful/failed media job.
- Broken media artifacts.
- Stalled media jobs.
- Scheduled/published items missing selected variants.
- Publishing jobs missing media snapshots.

This is one of the stronger parts of the platform. It gives the operator a practical way to know whether the machine is healthy before relying on automation.

## Data Model Inventory

### `Analytics`

Tracks metrics for legacy `Post` records:

- Clicks, signups, deposits.
- Engagement: likes, comments, shares, saves, impressions.
- Latest platform metrics.

### `Asset`

Uploaded or edited image/video assets:

- Original filename and stored filename.
- Kind: image/video.
- MIME type and file size.
- Title and tags.
- Original/edited file paths.
- Editor status.
- Last edit preset/overlay.

### `ContentIdea`

Operator-facing opportunity generated from gameplay signals:

- Signal IDs.
- Idea/opportunity type.
- Goal, audience, priority score.
- Headline, reason, hook angle, CTA angle.
- Recommended content angle, format, platforms.
- Urgency, confidence, estimated value.
- Operator status: open/saved/dismissed/converted.
- Legacy status: proposed/approved/briefed/variant_ready/scheduled/published/archived.

### `ContentItem`

Unified V2 workflow object:

- Source opportunity and signals.
- Title, opportunity type, strategy angle, recommendation reason.
- Recommended format/platforms.
- Operator mode.
- Pipeline stage.
- Brief, variant, selected variant, selected assets, publishing jobs.
- Schedule state.
- Analytics summary.
- Review notes and attention flags.

### `ContentVariant`

Generated copy/media option:

- Creative brief and optional content item link.
- Hook, caption, hashtags, overlay text, CTA.
- Tone and hook style.
- Assets.
- Media status and media paths/URLs.
- AI metadata.
- Status: draft/ready/scheduled/published/archived.

### `CreativeBrief`

Strategic content brief:

- Content idea and optional content item link.
- Objective, audience, platform, format, tone.
- Hook direction and CTA.
- Required asset kinds and selected assets.
- Notes and generation prompt.

### `Event`

Legacy raw event input:

- Event type: reem/win/streak/table_amount/deposit/signup/custom.
- Player, amount, turns, streak, table amount.
- Source and processing status.

### `GameSignal`

Normalized gameplay signal:

- Signal type and source identity.
- Player/table/match context.
- Mode, stake, amount, window.
- Occurred time.
- Scores for novelty, performance potential, brand fit, urgency, priority.
- Recommended platforms.
- Status.

### `LeaderboardSnapshot`

Saved leaderboard state:

- Metric and window.
- Title/description.
- Generated time.
- Rankings with rank/player/value/secondary value.

### `OperatorSetting`

Operator automation preferences:

- Mode: autopilot/assisted/manual.
- Approved platforms.
- Approved formats.
- Narrative repeat avoidance window.

### `PerformanceInsight`

Performance results for V2 publishing jobs:

- Publishing job and content variant.
- Platform.
- Clicks/signups/deposits.
- Engagement metrics.
- Hook style, content type, asset type, variant label.
- Performance score.

### `PlayerStatsDaily`

Windowed gameplay stats:

- Date, window, player.
- Matches, wins, reems, win types.
- Payouts, average/highest stakes.
- Deposits and invites.
- Current/best streak.

### `Post`

Legacy post object:

- Event link.
- Assets.
- Platforms.
- Caption/caption options, hook, hashtags, CTA, overlay.
- AI metadata.
- Media status/paths/URLs.
- Schedule status/provider response.

### `PublishingJob`

Scheduled or immediate publishing unit:

- Content variant and optional content item.
- Platform.
- Scheduled/published timestamps.
- Status.
- Caption snapshot.
- Media snapshot.
- Provider response/error.

### `Referral`

Referral code and invite ledger:

- Owner user.
- Code.
- Invites and reward status.
- Wallet credits awarded.

### `WorkerHeartbeat`

Worker liveness record:

- Worker name.
- Queue name.
- Last heartbeat.
- Status and metadata.

## API Surface

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Operator V2

- `GET /api/settings`
- `PATCH /api/settings`
- `GET /api/command-center`
- `GET /api/opportunities`
- `POST /api/opportunities/:id/create-content-item`
- `POST /api/opportunities/:id/save-for-later`
- `POST /api/opportunities/:id/dismiss`
- `GET /api/pipeline`
- `GET /api/content-items/:id`
- `POST /api/content-items/:id/generate-copy`
- `POST /api/content-items/:id/generate-media`
- `POST /api/content-items/:id/approve`
- `POST /api/content-items/:id/save-draft`
- `POST /api/content-items/:id/select-variant`
- `POST /api/content-items/:id/select-visual-preset`
- `POST /api/content-items/:id/schedule`
- `POST /api/content-items/:id/publish-now`
- `POST /api/content-items/:id/archive`
- `GET /api/calendar`
- `GET /api/performance`
- `GET /api/library`
- `GET /api/growth-loops`

### Health And Diagnostics

- `GET /api/health`
- `GET /api/system-health`
- `GET /api/system-integrity`
- `GET /api/workers/status`
- `GET /api/media/diagnostics`

### V2 Internal/Legacy-Compatible Routes

- `GET /api/v2/spec`
- `POST /api/v2/intelligence/sync`
- `GET /api/v2/intelligence/overview`
- `GET /api/v2/player-snapshots`
- `GET /api/v2/leaderboards`
- `GET /api/v2/signals`
- `GET /api/v2/content-ideas`
- `POST /api/v2/content-ideas/:ideaId/briefs`
- `GET /api/v2/creative-briefs`
- `POST /api/v2/creative-briefs/:briefId/variants`
- `GET /api/v2/content-variants`
- `POST /api/v2/content-variants/:variantId/create-media`
- `POST /api/v2/content-variants/:variantId/schedule`
- `POST /api/v2/content-variants/:variantId/publish-now`
- `GET /api/v2/publishing-jobs`
- `POST /api/v2/publishing-jobs/:publishingJobId/track`
- `GET /api/v2/insights`
- `GET /api/v2/dashboard`

### Legacy Content Routes

- `POST /api/generate-content`
- `GET /api/posts`
- `GET /api/posts/:postId`
- `POST /api/posts/:postId/assets`
- `POST /api/create-media`
- `POST /api/posts/:postId/create-media`
- `POST /api/schedule-post`
- `POST /api/posts/:postId/publish-now`
- `GET /api/analytics`
- `POST /api/analytics/track`
- `GET /api/events`

### Assets And Referrals

- `GET /api/assets`
- `POST /api/assets/upload`
- `POST /api/assets/:assetId/auto-edit`
- `DELETE /api/assets/:assetId`
- `POST /api/referral`
- `GET /api/referrals`

## Worker System

Location: `src/queues/index.ts`, `src/workers/*`

RGE uses four BullMQ queues:

- `rge-intelligence`
- `rge-content`
- `rge-media`
- `rge-scheduler`

Workers:

- Intelligence worker: syncs backend feed.
- Content worker: generates legacy post content.
- Media worker: renders media for posts or variants.
- Scheduler worker: publishes posts or V2 publishing jobs at scheduled times.

`src/workers/index.ts` forks all worker processes and shuts down if any child worker exits unexpectedly.

In `NODE_ENV=test`, queues use an inline fake driver to avoid Redis.

## Deployment And Runtime

Location: `render.yaml`, `.env.example`, `package.json`

Runtime requirements:

- Node 20+.
- MongoDB.
- Redis.
- FFmpeg available at `FFMPEG_PATH`.
- Writable media and asset directories.
- Optional Cloudinary credentials.
- Optional Instagram Graph credentials.
- Optional OpenAI API key.

Important env vars:

- `MONGODB_URI`
- `REDIS_URL`
- `JWT_SECRET`
- `OPERATOR_EMAIL`
- `OPERATOR_PASSWORD`
- `BACKEND_API_BASE_URL`
- `BACKEND_INTERNAL_TOKEN`
- `RGE_INTERNAL_TOKEN`
- `OPENAI_API_KEY`
- `CLOUDINARY_*`
- `INSTAGRAM_*`
- `MEDIA_OUTPUT_DIR`
- `ASSET_UPLOAD_DIR`

Production validation requires several sensitive/configuration values to be present, including JWT secret, operator password, RGE token, and Cloudinary credentials.

## Testing

Location: `test/rge.integration.test.ts`

The project includes an integration test suite using `tsx --test`.

The test setup uses:

- `mongodb-memory-server`.
- The inline test queue driver.
- API-level route testing through the app.

The test appears aimed at validating core RGE integration behavior across the API and data flow, not just isolated units.

## Strengths

- Clear V2 growth workflow from gameplay data to operator-ready content.
- Practical operator UI organized around Command Center, Opportunities, Pipeline, Calendar, Performance, Library, Growth Loops, and Settings.
- Strong health/integrity coverage for backend feed, Mongo, Redis, workers, media pipeline, directories, FFmpeg, Canvas, and broken artifacts.
- Good separation of concerns across services: intelligence, operator pipeline, media, publishing, assets, referrals, analytics.
- BullMQ worker architecture is appropriate for sync/render/publishing workloads.
- Uses fallback behavior when OpenAI is unavailable for legacy generation, which keeps local/dev flows viable.
- Guardrails exist before scheduling/publishing.
- Local and Cloudinary storage paths are both represented.
- Instagram publishing is real-provider oriented rather than only mocked.

## Gaps And Risks

- Operator auth is env-var based, not user/account/database based. This is fine for a single operator but limited for teams, roles, audit trails, or password rotation.
- The codebase carries both legacy `Post` flow and V2 `ContentItem` flow. That is useful, but it increases complexity and can confuse future maintenance unless the legacy surface is explicitly documented as compatibility/internal.
- Several statuses have overlapping names: `completed`, `succeeded`, `ready`, etc. Utilities normalize them, but the schema still allows many synonyms.
- OpenAI fallback is stronger in the legacy post generator than in every V2 path. V2 generation should be verified for behavior when `OPENAI_API_KEY` is missing.
- Instagram publishing depends on public media URLs. Local `/media` URLs may not work for Graph API unless the deployment URL is publicly reachable and media URLs are absolute.
- Production env validation requires Cloudinary credentials, which means production currently assumes Cloudinary-backed media/storage.
- There is no obvious database-backed operator audit log for manual approvals, schedule changes, publishes, dismissals, or archives beyond timestamps and selected fields on records.
- Social publishing support is currently Instagram/story only.
- The dashboard appears large and centralized in `AuthenticatedDashboard.tsx`; future UI changes may benefit from splitting the main dashboard into feature modules.
- There is no README content at `RGE/README.md`; the existing deeper docs are good, but the project entrypoint is blank.

## Recommended Next Steps

1. Fill `RGE/README.md` with a short entrypoint: what RGE is, how to run API/dashboard/workers, required services, and links to this audit/user guide.
2. Mark legacy routes/models clearly in docs and UI as compatibility/internal so the V2 operator workflow remains the obvious path.
3. Add an operator action audit log model for approvals, publishing, archives, dismissals, settings changes, and manual retries.
4. Confirm V2 copy generation behavior without OpenAI credentials and add deterministic fallback if missing.
5. Normalize media status values at the schema/API boundary to reduce synonym drift.
6. Add a deployment checklist focused on public media URL correctness for Instagram publishing.
7. Split the dashboard into route/view components when the next UI pass happens.
8. Keep expanding integration tests around the V2 content item lifecycle: opportunity -> content item -> copy -> media -> approve -> schedule -> publish -> insight.

## Bottom Line

RGE is not just a posting tool. It is a gameplay-aware marketing operations platform.

The strongest parts are the V2 operator workflow, the signal-to-opportunity pipeline, the unified content item model, and the health/integrity system. The main cleanup areas are documentation entrypoints, legacy/V2 boundary clarity, auth/audit maturity, and provider/media deployment hardening.
