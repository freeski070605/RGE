# ReemGrowth Engine (RGE)

ReemGrowth Engine is a standalone TypeScript/Express service for autonomous marketing workflows around ReemTeam gameplay. It now supports both a legacy event-to-post flow and a V2 intelligence-first workflow that starts from real backend gameplay signals.

## Architecture

```text
ReemTeam Backend Feed -> Intelligence Sync -> Signal Inbox -> Today Queue
                                              -> Creative Briefs -> Variants
                                              -> Media Engine -> Publishing Jobs
                                              -> Performance Insights -> Strategy
```

## Core capabilities

- Data layer that stores gameplay events and marketing posts in MongoDB.
- Content engine powered by OpenAI with a deterministic fallback when no API key is configured.
- Media engine that renders image posts with Canvas and short videos with FFmpeg, then stores them in Cloudinary.
- Asset library that accepts uploaded images and videos, stores them in Cloudinary, auto-edits them, and lets authenticated operators attach them to posts.
- Intelligence sync that computes top earners, most reems, biggest payouts, streaks, deposit momentum, and referral momentum from real ReemTeam data.
- Planning models for `game_signals`, `content_ideas`, `creative_briefs`, `content_variants`, `publishing_jobs`, and `performance_insights`.
- Scheduler engine powered by BullMQ and Redis for delayed publishing jobs.
- Operator-authenticated dashboard sessions with secure cookies for production access.
- Live publishing integrations for Instagram Graph API and X.
- Analytics engine that stores clicks, signups, deposits, and engagement.
- Strategy engine that analyzes top performers and injects winning patterns into future prompts.
- Referral engine for code generation, invite tracking, and wallet-credit style rewards.

## Folder structure

```text
RGE/
|-- src/
|   |-- api/
|   |-- config/
|   |-- db/models/
|   |-- queues/
|   |-- services/
|   |   |-- analytics/
|   |   |-- content-engine/
|   |   |-- data-layer/
|   |   |-- media-engine/
|   |   |-- referral/
|   |   |-- scheduler/
|   |   |-- social/
|   |   `-- strategy/
|   |-- utils/
|   `-- workers/
|-- dashboard/
|   |-- src/
|   `-- package.json
|-- storage/generated/
|-- .env.example
|-- package.json
`-- render.yaml
```

## Frontend dashboard

RGE now includes a dedicated React + Vite dashboard in `RGE/dashboard`.

The dashboard is organized around the operator workflow:

- `Overview`
- `Today Queue`
- `Leaderboards`
- `Signals`
- `Brief Builder`
- `Variants`
- `Insights`
- `Assets`
- `Referrals`

### Local run commands

1. Start the API:
   `npm run dev`
2. Start the workers:
   `npm run worker:all`
3. Start the frontend:
   `npm run dashboard:dev`
4. Open:
   `http://localhost:4173`
5. Sign in with:
   `OPERATOR_EMAIL` and `OPERATOR_PASSWORD`

The Vite dev server proxies both `/api` and `/media` to the RGE API running on `http://localhost:4010`.

## V2 implementation spec

See [docs/RGE_V2_IMPLEMENTATION_SPEC.md](./docs/RGE_V2_IMPLEMENTATION_SPEC.md) for:

- exact Mongo schemas
- exact API route list
- exact dashboard screens
- exact worker and job flow
- backend integration details

### Production behavior

- Build everything with `npm run build:all`
- Start the service with `npm run start`
- The Express app will serve the built dashboard from `dashboard/dist`
- Generated media and uploaded assets are stored in Cloudinary and returned as HTTPS URLs
- Dashboard and API routes are protected by operator auth or the internal token

This means the production web service can host both the API and the frontend from the same deploy.

## API

### `POST /generate-content`

Creates an event record, creates a draft post, and queues content generation.

```json
{
  "event": {
    "eventType": "reem",
    "playerId": "user123",
    "amount": 45,
    "turns": 3,
    "streak": 2,
    "tableAmount": 200
  },
  "platforms": ["instagram", "x"]
}
```

### `POST /create-media`

Queues image and video generation for an existing post.

```json
{
  "postId": "67da1c5f1b379d08319e6d30"
}
```

### `POST /schedule-post`

Schedules a post for mock publishing.

```json
{
  "postId": "67da1c5f1b379d08319e6d30",
  "scheduledFor": "2026-03-18T17:00:00.000Z",
  "platforms": ["instagram"]
}
```

### `GET /analytics`

Returns dashboard metrics, recent post performance, and strategy recommendations.

### `GET /dashboard`

Returns a summary payload for the frontend overview screen.

### `POST /v2/intelligence/sync`

Pulls the ReemTeam backend feed into RGE and updates player snapshots, leaderboards, signals, and seeded content ideas.

### `GET /v2/dashboard`

Returns the V2 operator dashboard payload:

- ranked content ideas
- signal inbox
- briefs
- variants
- publishing jobs
- performance insights

### `GET /v2/leaderboards`

Returns leaderboards for `24h`, `7d`, or `30d`.

### `GET /v2/signals`

Returns scored backend moments such as `reem_moment`, `big_payout`, `high_stakes_win`, `win_streak`, `vip_win`, `deposit_momentum`, and `referral_momentum`.

### `POST /v2/content-ideas/:ideaId/briefs`

Creates a structured creative brief from a ranked content idea.

### `POST /v2/creative-briefs/:briefId/variants`

Generates multiple creative variants from one brief.

### `POST /v2/content-variants/:variantId/create-media`

Queues media rendering for a variant through the media worker.

### `POST /v2/content-variants/:variantId/schedule`

Creates one publishing job per platform and schedules it through BullMQ.

### `POST /v2/content-variants/:variantId/publish-now`

Publishes a variant immediately through the live provider integration for Instagram or X.

### `POST /v2/publishing-jobs/:publishingJobId/track`

Stores clicks, signups, deposits, and engagement against a specific publishing job.

### `GET /posts`

Returns pipeline-ready post records including linked event and analytics data.

### `GET /assets`

Returns uploaded image and video assets available to the dashboard.

### `POST /assets/upload`

Accepts multipart uploads for images and videos.

### `POST /assets/:assetId/auto-edit`

Runs the automated editor for an uploaded asset using a visual preset and overlay text.

### `POST /posts/:postId/assets`

Attaches one or more uploaded assets to a post so they can be used during media generation.

### `GET /posts/:postId`

Returns a single post with creative, media, scheduling, and analytics details.

### `POST /posts/:postId/create-media`

Queues media generation directly from the dashboard.

### `POST /posts/:postId/publish-now`

Publishes a post immediately through the live provider integration for Instagram or X.

### `POST /auth/login`

Creates an operator session cookie for the dashboard.

### `GET /auth/me`

Returns the authenticated operator profile.

### `POST /analytics/track`

Allows the dashboard to simulate clicks, conversions, and engagement updates.

### `GET /events`

Returns recent source events for the content feed.

### `GET /referrals`

Returns referral programs and invite progress for the growth loop view.

### `POST /referral`

Uses one endpoint for create, invite, or reward actions.

```json
{
  "action": "create",
  "ownerUserId": "user123"
}
```

```json
{
  "action": "invite",
  "code": "REAM-AB12CD",
  "invitedUserId": "friend456"
}
```

```json
{
  "action": "reward",
  "code": "REAM-AB12CD",
  "invitedUserId": "friend456",
  "rewardCents": 500
}
```

## Local setup

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Install dashboard dependencies with `npm --prefix dashboard install`.
4. Start MongoDB and Redis.
5. Run the API with `npm run dev`.
6. Run workers with `npm run worker:all` or split them across `worker:intelligence`, `worker:content`, `worker:media`, and `worker:scheduler`.
7. Run the dashboard with `npm run dashboard:dev`.

## Render deployment

The included `render.yaml` provisions one web service, one worker service, and one Render Key Value instance. MongoDB remains external and should be supplied through MongoDB Atlas or another managed Mongo deployment.

Suggested services:

- `rge-api`: Express API plus bundled dashboard frontend
- `rge-workers`: Combined BullMQ workers

Render environment variables:

- `MONGODB_URI`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `JWT_SECRET`
- `RGE_INTERNAL_TOKEN`
- `OPERATOR_EMAIL`
- `OPERATOR_PASSWORD`
- `BACKEND_API_BASE_URL`
- `BACKEND_INTERNAL_TOKEN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER`
- `INSTAGRAM_USER_ID`
- `INSTAGRAM_ACCESS_TOKEN`
- `X_ACCESS_TOKEN`
- `FFMPEG_PATH`
- `RGE_SYNC_DAYS`
- `REFERRAL_REWARD_CENTS`

## Notes for production

- Cloudinary is now the shared media layer for uploads, edited assets, and generated creative.
- Dashboard access is authenticated with operator credentials, and machine-to-machine calls can use `RGE_INTERNAL_TOKEN`.
- Instagram publishing requires a valid Instagram business user id and access token with content publishing permissions.
- X publishing requires a user access token with permission to upload media and create posts.
- Feed real post-back metrics into the analytics collection from webhooks or polling jobs for true closed-loop optimization.
- Point the intelligence sync at a deployed ReemTeam backend route secured by `BACKEND_INTERNAL_TOKEN`.
#   R G E  
 