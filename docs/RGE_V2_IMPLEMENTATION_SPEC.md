# RGE V2 Implementation Spec

## Goal

RGE V2 turns ReemTeam gameplay data into an operator workflow:

`backend feed -> player stats -> leaderboards -> signals -> content ideas -> briefs -> variants -> media -> publishing jobs -> performance insights`

This replaces the older `raw event -> post` flow as the primary marketing operating model.

## Mongo Schemas

### `player_stats_daily`

- `date`: string `YYYY-MM-DD`
- `window`: `24h | 7d | 30d`
- `playerId`: string
- `username`: string
- `vipStatus`: string
- `matchesPlayed`: number
- `wins`: number
- `reems`: number
- `regularWins`: number
- `autoTripleWins`: number
- `caughtDropWins`: number
- `netPayout`: number
- `grossPayout`: number
- `biggestPayout`: number
- `avgStake`: number
- `highestStakeWin`: number
- `depositCount`: number
- `depositAmount`: number
- `inviteCount`: number
- `rewardedInvites`: number
- `currentWinStreak`: number
- `bestWinStreak`: number
- `metadata`: object

### `leaderboard_snapshots`

- `metric`: `top_earners | most_reems | biggest_payouts | best_win_rate | longest_streak`
- `window`: `24h | 7d | 30d`
- `title`: string
- `description`: string
- `generatedAt`: date
- `rankings[]`:
  - `rank`
  - `playerId`
  - `username`
  - `value`
  - `secondaryValue`
  - `metadata`

### `game_signals`

- `signalType`: string
- `sourceType`: `match | transaction | invite | leaderboard`
- `sourceId`: string
- `playerId`: string
- `username`: string
- `tableId`: string
- `tableName`: string
- `matchId`: string
- `mode`: string
- `stake`: number
- `amount`: number
- `window`: `24h | 7d | 30d`
- `metadata`: object
- `occurredAt`: date
- `scores`:
  - `noveltyScore`
  - `performancePotentialScore`
  - `brandFitScore`
  - `urgencyScore`
  - `overallPriorityScore`
- `recommendedPlatforms`: string[]
- `status`: `new | ranked | idea_created | dismissed`

### `content_ideas`

- `signalIds`: ObjectId[]
- `ideaType`: string
- `goal`: `engagement | conversion | referral`
- `audience`: string
- `platformRecommendation`: string[]
- `priorityScore`: number
- `headline`: string
- `reason`: string
- `hookAngle`: string
- `ctaAngle`: string
- `linkedPlayers`: string[]
- `linkedAssets`: ObjectId[]
- `campaignTags`: string[]
- `status`: `proposed | approved | briefed | variant_ready | scheduled | published | archived`

### `creative_briefs`

- `contentIdeaId`: ObjectId
- `objective`: string
- `audience`: string
- `platform`: string
- `format`: string
- `tone`: string
- `hookDirection`: string
- `cta`: string
- `requiredAssetKinds`: string[]
- `assetIds`: ObjectId[]
- `notes`: string[]
- `generationPrompt`: string
- `status`: `draft | approved | variants_generated | archived`

### `content_variants`

- `creativeBriefId`: ObjectId
- `variantLabel`: string
- `hook`: string
- `caption`: string
- `hashtags`: string[]
- `overlayText`: string
- `cta`: string
- `tone`: string
- `hookStyle`: string
- `assetIds`: ObjectId[]
- `media`:
  - `status`: `pending | ready | failed`
  - `imagePath`
  - `videoPath`
- `aiMetadata`
- `status`: `draft | ready | scheduled | published | archived`

### `publishing_jobs`

- `contentVariantId`: ObjectId
- `platform`: string
- `scheduledFor`: date
- `publishedAt`: date
- `status`: `draft | scheduled | processing | published | failed`
- `captionSnapshot`: string
- `mediaSnapshot`: object
- `providerResponse`: object
- `errorMessage`: string

### `performance_insights`

- `publishingJobId`: ObjectId
- `contentVariantId`: ObjectId
- `platform`: string
- `clicks`: number
- `signups`: number
- `deposits`: number
- `likes`: number
- `comments`: number
- `shares`: number
- `saves`: number
- `impressions`: number
- `hookStyle`: string
- `contentType`: string
- `assetType`: string
- `variantLabel`: string
- `performanceScore`: number

## API Routes

### Backend integration

- `GET /backend/api/rge/feed`
  - returns player snapshots, leaderboards, and scored signals from real ReemTeam data
  - protected by `RGE_INTERNAL_TOKEN` when configured

### RGE V2 routes

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

## Dashboard Screens

- `Overview`
- `Today Queue`
- `Leaderboards`
- `Signals`
- `Brief Builder`
- `Variants`
- `Insights`
- `Assets`
- `Referrals`

## Worker And Job Flow

### Intelligence

- backend route builds the feed from `Match`, `User`, `Table`, `Transaction`, and `Invite`
- `intelligenceWorker` syncs feed data into RGE collections
- sync seeds `content_ideas` automatically from the highest priority signals

### Content and media

- operator creates a `creative_brief` from a `content_idea`
- operator or automation generates `content_variants`
- `mediaWorker` renders image and optional video assets for a variant

### Publishing

- operator schedules a variant or publishes immediately
- RGE creates one `publishing_job` per platform
- `schedulerWorker` executes publishing jobs through the mock social publisher

### Learning loop

- operator or future webhook jobs record platform metrics against a `publishing_job`
- `performance_insights` update the strategy snapshot
- future briefs and variants reuse winning hook styles, content types, and asset patterns
