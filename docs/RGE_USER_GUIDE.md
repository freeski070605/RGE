# RGE User Guide

This guide explains how an operator uses ReemGrowth Engine (`RGE`) day to day.

It is written for the person actually running growth operations, not for the developer deploying the app.

## What RGE Does

RGE turns real ReemTeam gameplay activity into publishable Instagram content.

The normal flow is:

1. Sync fresh game data from the ReemTeam backend.
2. Review ranked content opportunities in the `Today Queue`.
3. Create a creative brief from the best opportunity.
4. Generate multiple content variants.
5. Create media for the best variant.
6. Schedule or publish the variant to Instagram.
7. Track post performance so future content gets smarter.

## Before You Start

Make sure these are already set up:

- RGE is deployed and reachable in the browser
- You have an operator login:
  - `OPERATOR_EMAIL`
  - `OPERATOR_PASSWORD`
- The ReemTeam backend feed is working
- Cloudinary is connected
- Instagram publishing credentials are configured
- Workers are running successfully

If those are not ready yet, use [RENDER_SETUP.md](/e:/code/ReemTeamMasterWeb/RGE/docs/RENDER_SETUP.md) first.

## Signing In

1. Open the public RGE URL.
2. Enter your operator email and password.
3. After login, the dashboard loads the current workspace:
   - dashboard summary
   - leaderboards
   - signals
   - assets
   - referrals
   - implementation metadata

If the app says your session expired, sign in again.

## Dashboard Layout

The main navigation includes:

- `Overview`
- `Today Queue`
- `Leaderboards`
- `Signals`
- `Variants`
- `Assets`
- `Referrals`

There is also a right-side detail rail that shows more information about the currently selected item.

## Recommended Daily Workflow

This is the best order for normal daily use.

### 1. Sync Backend Feed

Use the `Sync backend feed` button in the left sidebar.

What it does:

- pulls fresh gameplay intelligence from the ReemTeam backend
- updates player snapshots and leaderboards
- creates or refreshes ranked signals
- seeds content opportunities for the `Today Queue`

Use this:

- at the start of the day
- before planning content
- after a big gameplay event or promo push

If sync fails:

- check `BACKEND_API_BASE_URL`
- check `BACKEND_INTERNAL_TOKEN`
- check the ReemTeam backend logs

### 2. Review The Today Queue

The `Today Queue` is where operators decide what is worth turning into content.

Each card represents a ranked content idea based on real gameplay signals.

Each idea shows:

- its status
- the idea type
- a priority score
- a headline
- a reason it is worth posting

How to use it:

1. Click through the queue.
2. Look for the strongest combination of:
   - high priority
   - timely gameplay moment
   - clear hook angle
   - useful conversion angle
3. Select the idea you want to turn into a brief.

Good choices usually include:

- big payouts
- strong win streaks
- top earners
- unusual momentum
- content that fits current promotions or social themes

### 3. Prepare Assets

Before creating a brief, decide whether you want to include existing assets.

Open the `Assets` section to:

- upload images or videos
- auto-edit them for social use
- choose them for the next brief

#### Uploading Assets

Use the `Upload asset` form.

Fields:

- `Asset title`
- `Tags`
- file upload

Accepted asset types include common images and videos used for marketing.

Best practice:

- use clear titles
- add tags that help you find assets later
- upload high-quality source files when possible

#### Auto-Editing Assets

Each asset can be auto-edited with:

- `square`
- `story`
- `reel`

You can also add overlay text.

Use auto-edit when:

- you need quick reusable creative
- you want a cleaner crop for the selected Instagram format
- you want simple text treatment without manual design work

#### Selecting Assets For A Brief

Click `Use in brief` on any asset you want included in the next creative brief.

Selected assets appear in the `Selected for next brief` area and will carry into the brief creation step.

### 4. Create A Creative Brief

Go back to `Today Queue` after choosing an idea.

Use the `Create creative brief` form.

Fields:

- `Platform`
  - `Instagram`
  - `Story`
- `Format`
  - `Reel`
  - `Carousel`
  - `Story`
  - `Square`
- `Tone`

What this step does:

- locks in the creative direction
- defines the intended platform and format
- packages your selected assets with the idea
- creates a structured prompt for variant generation

Best practice:

- use `Instagram + Reel` for high-energy moments
- use `Story` for quick punchy updates
- use `Carousel` when the idea needs multiple beats or educational framing
- write tone in plain English, like:
  - `competitive and social-first`
  - `celebratory and high-energy`
  - `sharp and conversion-focused`

After submission, the brief is added to the system and becomes available for variant generation.

### 5. Generate Variants

Open the `Variants` section.

In the `Variant generation` card:

1. Choose how many variants to create.
2. Click the generate button for the brief you want.

This creates multiple creative directions from the same brief.

Variants usually differ in:

- hook
- caption
- hashtags
- overlay text
- CTA framing

Use this step to test angles, not just wording.

A strong workflow is:

1. Generate 2 to 4 variants.
2. Compare which one has the clearest hook.
3. Choose the one that best matches the current gameplay moment.

### 6. Review Variants

Each variant card shows:

- status
- media status
- hook text
- media preview, if available
- actions for media generation, publish now, and scheduling

Click a variant to inspect more detail in the right-side rail.

The detail rail helps you review:

- full caption
- overlay text
- hashtags
- selected publishing job details

Choose variants that are:

- easy to understand quickly
- visually strong
- aligned with the platform format
- likely to drive clicks, signups, or deposits

### 7. Create Media

Click `Create media` on the selected variant.

This sends the variant to the media worker so the system can render:

- image creative
- video creative

What happens next:

- the worker processes the request
- generated media is uploaded to Cloudinary
- the variant card updates with preview media when ready

If media does not appear:

- check worker health
- check Cloudinary credentials
- check `FFMPEG_PATH`
- review worker logs

### 8. Publish Immediately Or Schedule

Once the media is ready, you have two choices.

#### Publish Now

Click `Publish now` when the content should go live immediately.

Use this for:

- breaking gameplay moments
- timely wins
- high-performing live momentum

#### Schedule

Use the datetime field on the variant card and click `Schedule`.

Use scheduling when:

- you want content spaced throughout the day
- you are planning ahead for a campaign
- you want to queue content during off-hours

Scheduling creates publishing jobs and sends them through the worker pipeline.

### 9. Track Performance

Use the `Track job metrics` form in the `Variants` section.

You can manually record:

- clicks
- signups
- deposits
- likes
- comments
- shares
- saves
- impressions

This step matters because RGE uses performance feedback to improve future recommendations and creative direction.

Best practice:

- update metrics after the post has had enough time to accumulate signal
- keep your metric entry consistent
- prioritize meaningful business outcomes, not vanity metrics alone

## How To Read Each Section

### Overview

Use this as your quick health check.

It summarizes:

- ideas in queue
- active variants
- publishing job count
- tracked clicks

If these numbers look stale, run a backend sync first.

### Leaderboards

This section shows high-performing players and moments over:

- `24h`
- `7d`
- `30d`

Use it to spot:

- consistent winners
- short-term spikes
- players worth featuring
- trends that can become recurring content formats

### Signals

Signals are scored gameplay moments with post-worthiness attached to them.

Use this section when:

- you want more raw context than the `Today Queue`
- you need to understand why ideas were created
- you want to identify high-value moments earlier

### Variants

This is the main execution area for:

- generating variants
- creating media
- publishing
- scheduling
- tracking performance

If you only remember one section, remember this one.

### Assets

Use this as your reusable media library.

Good uses:

- creator photos
- gameplay screenshots
- promo art
- branded visuals
- short clips

### Referrals

This section supports the referral growth loop alongside content operations.

You can:

- create referral codes
- record invites
- apply rewards

This is useful when your content strategy overlaps with acquisition campaigns.

## Suggested Operating Rhythm

### Daily

1. Sign in.
2. Sync backend feed.
3. Review `Today Queue`.
4. Create 1 to 3 briefs.
5. Generate variants.
6. Publish or schedule the strongest content.

### Weekly

1. Review performance trends.
2. Compare which hooks and formats worked best.
3. Refresh asset library.
4. Clean up underused approaches.
5. Build next week’s content rhythm around top-performing signal types.

## Common Best Practices

- Work from the highest-priority gameplay moments first.
- Use assets intentionally rather than attaching them to every brief.
- Generate multiple variants before publishing.
- Prefer strong, simple hooks over overloaded captions.
- Track business outcomes after posts go live.
- Use scheduling to smooth out publishing cadence.
- Re-sync the backend feed before making major content decisions.

## Common Mistakes To Avoid

- Publishing without reviewing the generated caption
- Ignoring media status before scheduling
- Creating too many low-quality variants
- Forgetting to record outcomes after publishing
- Using stale assets that no longer match the brand or moment
- Treating every signal as equally important

## Troubleshooting

### I cannot sign in

Check:

- `OPERATOR_EMAIL`
- `OPERATOR_PASSWORD`
- whether your session cookie is blocked
- whether the API is healthy

### Sync backend feed fails

Check:

- `BACKEND_API_BASE_URL`
- `BACKEND_INTERNAL_TOKEN`
- ReemTeam backend route availability

### Asset upload fails

Check:

- file type
- file size
- Cloudinary credentials
- API logs

### Auto-edit fails

Check:

- worker status
- image or video compatibility
- media processing logs

### Media creation stays pending

Check:

- worker service health
- Redis connection
- FFmpeg availability
- Cloudinary upload success

### Instagram publish fails

Check:

- `INSTAGRAM_USER_ID`
- `INSTAGRAM_ACCESS_TOKEN`
- Instagram account permissions
- asset format compatibility
- job logs in the worker service

## Quick Start Version

If you want the short version, do this:

1. Sign in.
2. Click `Sync backend feed`.
3. Pick the best idea in `Today Queue`.
4. Upload or select assets if needed.
5. Create a brief.
6. Generate variants.
7. Create media for the best variant.
8. Publish now or schedule it.
9. Track results later.

## Related Docs

- Render deployment guide: [RENDER_SETUP.md](/e:/code/ReemTeamMasterWeb/RGE/docs/RENDER_SETUP.md)
- Technical implementation spec: [RGE_V2_IMPLEMENTATION_SPEC.md](/e:/code/ReemTeamMasterWeb/RGE/docs/RGE_V2_IMPLEMENTATION_SPEC.md)
