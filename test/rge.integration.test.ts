import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';

const PORT = 4411;
const baseUrl = `http://127.0.0.1:${PORT}`;
const testOutputDir = path.resolve(process.cwd(), 'test-output');
const originalFetch = global.fetch;

type ModuleBag = {
  env: any;
  createApp: () => any;
  connectDatabase: () => Promise<void>;
  disconnectDatabase: () => Promise<void>;
  closeQueues: () => Promise<void>;
  processMediaJobData: (job: { id?: string; data: { targetType: 'variant'; variantId: string } }) => Promise<void>;
  ContentVariantModel: any;
  ContentItemModel: any;
  CreativeBriefModel: any;
  ContentIdeaModel: any;
  OpportunityCandidateModel: any;
  DerivedIndicatorModel: any;
  NormalizedEventModel: any;
  OperatorSettingModel: any;
  AssetModel: any;
  WorkerHeartbeatModel: any;
  HQUserModel: any;
  UserProfileModel: any;
  AdminNoteModel: any;
  CribModel: any;
  TableModel: any;
  HQEventModel: any;
  GameIntelligenceSignalModel: any;
  syncRgeFeedV3: (input?: { days?: number; preloadedFeed?: any }) => Promise<any>;
  mongoose: typeof import('mongoose');
};

let mongoServer: MongoMemoryServer;
let server: any;
let modules: ModuleBag;

const apiJson = async (pathname: string, init?: { method?: string; body?: unknown }) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: init?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-rge-internal-token': process.env.RGE_INTERNAL_TOKEN || 'test-token'
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body)
  });

  const payload = response.status === 204 ? null : await response.json();
  return {
    status: response.status,
    payload
  };
};

const buildMockFeed = () => ({
  generatedAt: new Date().toISOString(),
  statsDate: new Date().toISOString().slice(0, 10),
  windows: ['24h', '7d', '30d'],
  summary: {
    totalPlayers: 2,
    totalCompletedMatches: 2,
    totalSignals: 4
  },
  players: [
    {
      playerId: 'player-1',
      username: 'ReemAce',
      vipStatus: 'ACTIVE',
      vipSince: new Date().toISOString(),
      windows: {
        '24h': { matchesPlayed: 4, wins: 3, reems: 1, regularWins: 2, autoTripleWins: 0, caughtDropWins: 0, netPayout: 110, grossPayout: 130, biggestPayout: 88, avgStake: 18, highestStakeWin: 25, depositCount: 0, depositAmount: 0, inviteCount: 2, rewardedInvites: 1, currentWinStreak: 3, bestWinStreak: 3 },
        '7d': { matchesPlayed: 9, wins: 5, reems: 2, regularWins: 3, autoTripleWins: 0, caughtDropWins: 0, netPayout: 180, grossPayout: 230, biggestPayout: 88, avgStake: 17, highestStakeWin: 25, depositCount: 1, depositAmount: 40, inviteCount: 4, rewardedInvites: 2, currentWinStreak: 3, bestWinStreak: 4 },
        '30d': { matchesPlayed: 20, wins: 11, reems: 4, regularWins: 7, autoTripleWins: 0, caughtDropWins: 0, netPayout: 320, grossPayout: 410, biggestPayout: 88, avgStake: 16, highestStakeWin: 25, depositCount: 3, depositAmount: 110, inviteCount: 6, rewardedInvites: 3, currentWinStreak: 3, bestWinStreak: 5 }
      }
    }
  ],
  leaderboards: [
    {
      metric: 'most_reems',
      window: '24h',
      title: 'Most Reems',
      description: 'Players landing the most reems',
      rankings: [{ rank: 1, playerId: 'player-1', username: 'ReemAce', value: 3 }]
    }
  ],
  signals: [
    {
      signalType: 'reem_moment',
      sourceType: 'match',
      sourceId: 'match-1',
      playerId: 'player-1',
      username: 'ReemAce',
      occurredAt: new Date().toISOString(),
      window: '24h',
      amount: 88,
      metadata: {},
      scores: { noveltyScore: 72, performancePotentialScore: 84, brandFitScore: 79, urgencyScore: 93, overallPriorityScore: 86 },
      recommendedPlatforms: ['instagram', 'story']
    },
    {
      signalType: 'big_payout',
      sourceType: 'match',
      sourceId: 'match-2',
      playerId: 'player-1',
      username: 'ReemAce',
      occurredAt: new Date().toISOString(),
      window: '24h',
      amount: 120,
      metadata: {},
      scores: { noveltyScore: 75, performancePotentialScore: 91, brandFitScore: 82, urgencyScore: 90, overallPriorityScore: 89 },
      recommendedPlatforms: ['instagram']
    },
    {
      signalType: 'deposit_momentum',
      sourceType: 'transaction',
      sourceId: 'tx-1',
      playerId: 'player-1',
      username: 'ReemAce',
      occurredAt: new Date().toISOString(),
      window: '24h',
      amount: 60,
      metadata: {},
      scores: { noveltyScore: 60, performancePotentialScore: 70, brandFitScore: 50, urgencyScore: 80, overallPriorityScore: 66 },
      recommendedPlatforms: ['instagram']
    },
    {
      signalType: 'leaderboard_most_reems',
      sourceType: 'leaderboard',
      sourceId: 'leaderboard:most_reems',
      playerId: 'player-1',
      username: 'ReemAce',
      occurredAt: new Date().toISOString(),
      window: '24h',
      amount: 3,
      metadata: { metric: 'most_reems' },
      scores: { noveltyScore: 68, performancePotentialScore: 72, brandFitScore: 82, urgencyScore: 76, overallPriorityScore: 74 },
      recommendedPlatforms: ['instagram', 'story']
    }
  ]
});

const withMockedBackendFetch = (handler: (url: string) => Response | Promise<Response>) => {
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith(process.env.BACKEND_API_BASE_URL || '')) {
      return handler(url);
    }

    return originalFetch(input as any, init);
  }) as typeof fetch;
};

const seedOpportunityAndCreateItem = async () => {
  withMockedBackendFetch(async () => new Response(JSON.stringify(buildMockFeed()), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  await apiJson('/api/v2/intelligence/sync', { method: 'POST', body: { days: 1 } });
  await apiJson('/api/settings', { method: 'PATCH', body: { mode: 'manual' } });
  const opportunities = await apiJson('/api/opportunities');
  const opportunity = (opportunities.payload as any[])[0];
  const item = await apiJson(`/api/opportunities/${opportunity.id}/create-content-item`, { method: 'POST' });
  return { opportunity, item: item.payload as any };
};

before(async () => {
  mongoServer = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.PORT = String(PORT);
  process.env.APP_BASE_URL = baseUrl;
  process.env.MONGODB_URI = mongoServer.getUri('rge-integration');
  process.env.REDIS_URL = 'redis://127.0.0.1:1';
  process.env.RGE_INTERNAL_TOKEN = 'test-token';
  process.env.BACKEND_API_BASE_URL = 'https://backend.invalid';
  process.env.BACKEND_INTERNAL_TOKEN = 'backend-token';
  process.env.OPERATOR_EMAIL = 'operator@test.local';
  process.env.OPERATOR_PASSWORD = 'password';
  process.env.JWT_SECRET = 'test-secret';
  process.env.OPENAI_API_KEY = '';
  process.env.OPENAI_ORGANIZATION = '';
  process.env.OPENAI_MODEL = 'gpt-4o-mini';
  process.env.CLOUDINARY_CLOUD_NAME = '';
  process.env.CLOUDINARY_API_KEY = '';
  process.env.CLOUDINARY_API_SECRET = '';
  process.env.FFMPEG_PATH = 'missing-ffmpeg';
  process.env.ENABLE_VIDEO_GENERATION = 'false';
  process.env.MEDIA_OUTPUT_DIR = 'test-output/generated';
  process.env.ASSET_UPLOAD_DIR = 'test-output/assets';
  process.env.DEFAULT_POST_PLATFORMS = 'instagram';

  const mongoose = await import('mongoose');
  const { env } = await import('../src/config/env');
  const { createApp } = await import('../src/app');
  const { connectDatabase, disconnectDatabase } = await import('../src/config/db');
  const { closeQueues } = await import('../src/queues');
  const { processMediaJobData } = await import('../src/workers/mediaWorker');
  const { ContentVariantModel } = await import('../src/db/models/ContentVariant');
  const { ContentItemModel } = await import('../src/db/models/ContentItem');
  const { CreativeBriefModel } = await import('../src/db/models/CreativeBrief');
  const { ContentIdeaModel } = await import('../src/db/models/ContentIdea');
  const { OpportunityCandidateModel } = await import('../src/db/models/OpportunityCandidate');
  const { DerivedIndicatorModel } = await import('../src/db/models/DerivedIndicator');
  const { NormalizedEventModel } = await import('../src/db/models/NormalizedEvent');
  const { OperatorSettingModel } = await import('../src/db/models/OperatorSetting');
  const { AssetModel } = await import('../src/db/models/Asset');
  const { WorkerHeartbeatModel } = await import('../src/db/models/WorkerHeartbeat');
  const { HQUserModel, UserProfileModel, AdminNoteModel } = await import('../src/db/models/hq/User');
  const { CribModel, TableModel } = await import('../src/db/models/hq/GameOperations');
  const { GameIntelligenceSignalModel } = await import('../src/db/models/hq/GrowthIntelligence');
  const { HQEventModel } = await import('../src/db/models/hq/Operations');
  const { syncRgeFeedV3 } = await import('../src/services/intelligence/rgeFeedV3Service');

  modules = {
    env,
    createApp,
    connectDatabase,
    disconnectDatabase,
    closeQueues,
    processMediaJobData,
    ContentVariantModel,
    ContentItemModel,
    CreativeBriefModel,
    ContentIdeaModel,
    OpportunityCandidateModel,
    DerivedIndicatorModel,
    NormalizedEventModel,
    OperatorSettingModel,
    AssetModel,
    WorkerHeartbeatModel,
    HQUserModel,
    UserProfileModel,
    AdminNoteModel,
    CribModel,
    TableModel,
    HQEventModel,
    GameIntelligenceSignalModel,
    syncRgeFeedV3,
    mongoose: mongoose.default
  };

  await modules.connectDatabase();
  await fs.mkdir(modules.env.imageOutputDir, { recursive: true });
  await fs.mkdir(modules.env.videoOutputDir, { recursive: true });
  await fs.mkdir(modules.env.assetOriginalDir, { recursive: true });
  await fs.mkdir(modules.env.assetEditedDir, { recursive: true });
  server = modules.createApp().listen(PORT);
});

beforeEach(async () => {
  global.fetch = originalFetch;
  await modules.mongoose.connection.db.dropDatabase();
  await fs.rm(testOutputDir, { recursive: true, force: true });
  await fs.mkdir(modules.env.imageOutputDir, { recursive: true });
  await fs.mkdir(modules.env.videoOutputDir, { recursive: true });
  await fs.mkdir(modules.env.assetOriginalDir, { recursive: true });
  await fs.mkdir(modules.env.assetEditedDir, { recursive: true });
});

after(async () => {
  global.fetch = originalFetch;
  await new Promise<void>((resolve, reject) => server.close((error: Error | null) => (error ? reject(error) : resolve())));
  await modules.closeQueues();
  await modules.disconnectDatabase();
  await mongoServer.stop();
  await fs.rm(testOutputDir, { recursive: true, force: true });
});

test('HQ core module APIs are database-backed and support operator actions', async () => {
  const userId = new modules.mongoose.Types.ObjectId();
  const cribId = new modules.mongoose.Types.ObjectId();
  const tableId = new modules.mongoose.Types.ObjectId();
  const eventId = new modules.mongoose.Types.ObjectId();

  await modules.HQUserModel.create({
    _id: userId,
    username: 'crownmaya',
    displayName: 'Crown Maya',
    email: 'maya@example.com',
    role: 'player',
    status: 'active'
  });
  await modules.UserProfileModel.create({
    userId,
    displayName: 'Crown Maya',
    tags: ['vip', 'hot_player', 'content_safe'],
    gamesPlayed: 188,
    wins: 104,
    losses: 84,
    reems: 9,
    averageStake: 50,
    walletSummary: {
      balanceCents: 13800,
      pendingCents: 0,
      lifetimeCreditsCents: 42000
    }
  });
  await modules.CribModel.create({
    _id: cribId,
    cribName: 'Da Crown Room',
    description: 'High-stakes tables for VIPs and big Reem moments.',
    stakeTier: 'high',
    theme: 'crown',
    status: 'active',
    featured: true,
    growthPriority: 94
  });
  await modules.TableModel.create({
    _id: tableId,
    tableName: 'Crown Room 4',
    cribId,
    stake: 100,
    maxSeats: 4,
    status: 'open',
    visibility: 'public',
    priority: 90
  });
  await modules.HQEventModel.create({
    _id: eventId,
    eventName: 'Friday Night Reem',
    eventType: 'reem_chase',
    startTime: new Date(Date.now() + 60 * 60 * 1000),
    endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
    eligibleCribs: [cribId],
    eligibleTables: [tableId],
    stakeRange: { min: 10, max: 250 },
    rewardRules: { bonusCents: 500 },
    leaderboardRules: { metric: 'reems' },
    contentGoal: 'Generate social proof and in-app table joins.',
    growthGoal: 'Increase Friday table activity.',
    status: 'scheduled'
  });
  await modules.GameIntelligenceSignalModel.create({
    signalType: 'reem_detected',
    source: 'gameplay',
    sourceId: 'round-1',
    targetUserId: userId,
    targetCribId: cribId,
    targetTableId: tableId,
    targetEventId: eventId,
    summary: 'Crown Maya hit a Reem in Da Crown Room.',
    details: { amountCents: 24500 },
    confidence: 96,
    occurredAt: new Date(),
    status: 'new'
  });

  const readiness = await apiJson('/api/hq/modules/readiness');
  assert.equal(readiness.status, 200);
  assert.equal((readiness.payload as any).modules.find((row: any) => row.id === 'crm').counts.users, 1);
  assert.equal((readiness.payload as any).modules.find((row: any) => row.id === 'game_intelligence').counts.hqSignals, 1);

  const users = await apiJson('/api/hq/users?search=maya');
  assert.equal(users.status, 200);
  assert.equal((users.payload as any[]).length, 1);
  assert.equal((users.payload as any[])[0].profile.reems, 9);

  const suspended = await apiJson(`/api/hq/users/${userId}`, {
    method: 'PATCH',
    body: { status: 'suspended' }
  });
  assert.equal(suspended.status, 200);
  assert.equal((suspended.payload as any).status, 'suspended');

  const note = await apiJson(`/api/hq/users/${userId}/notes`, {
    method: 'POST',
    body: { note: 'Watch for VIP follow-up after event.', visibility: 'internal' }
  });
  assert.equal(note.status, 201);
  assert.equal(await modules.AdminNoteModel.countDocuments({ userId }), 1);

  const profile = await apiJson(`/api/hq/users/${userId}/profile`);
  assert.equal(profile.status, 200);
  assert.equal((profile.payload as any).notes[0].note, 'Watch for VIP follow-up after event.');

  const cribs = await apiJson('/api/hq/cribs');
  assert.equal(cribs.status, 200);
  assert.equal((cribs.payload as any[])[0].tableCount, 1);

  const updatedCrib = await apiJson(`/api/hq/cribs/${cribId}`, {
    method: 'PATCH',
    body: { growthPriority: 99, featured: false }
  });
  assert.equal((updatedCrib.payload as any).growthPriority, 99);
  assert.equal((updatedCrib.payload as any).featured, false);

  const tables = await apiJson(`/api/hq/tables?cribId=${cribId}`);
  assert.equal(tables.status, 200);
  assert.equal((tables.payload as any[])[0].cribName, 'Da Crown Room');

  const updatedTable = await apiJson(`/api/hq/tables/${tableId}`, {
    method: 'PATCH',
    body: { status: 'active', priority: 98 }
  });
  assert.equal((updatedTable.payload as any).status, 'active');

  const createdEvent = await apiJson('/api/hq/events', {
    method: 'POST',
    body: {
      eventName: 'Lowball Ladder',
      eventType: 'leaderboard',
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      eligibleCribs: [String(cribId)],
      eligibleTables: [String(tableId)],
      status: 'draft'
    }
  });
  assert.equal(createdEvent.status, 201);
  assert.equal((createdEvent.payload as any).eventName, 'Lowball Ladder');

  const updatedEvent = await apiJson(`/api/hq/events/${eventId}`, {
    method: 'PATCH',
    body: { status: 'running' }
  });
  assert.equal(updatedEvent.status, 200);
  assert.equal((updatedEvent.payload as any).status, 'running');

  const signals = await apiJson('/api/hq/game-intelligence/signals?status=new');
  assert.equal(signals.status, 200);
  assert.equal((signals.payload as any[])[0].summary, 'Crown Maya hit a Reem in Da Crown Room.');
});

test('sync creates operator-facing opportunities and the content item lifecycle reaches the calendar', async () => {
  const { item } = await seedOpportunityAndCreateItem();

  const opportunities = await apiJson('/api/opportunities');
  assert.equal((opportunities.payload as any[]).some((entry) => entry.opportunityType === 'deposit_momentum'), false);
  assert.ok((opportunities.payload as any[]).length >= 2);

  assert.equal(item.stage, 'draft_ready');
  assert.ok(item.selectedVariantId);

  await modules.processMediaJobData({
    id: 'media-job-1',
    data: {
      targetType: 'variant',
      variantId: item.selectedVariantId
    }
  });

  const refreshed = await apiJson(`/api/content-items/${item.id}`);
  assert.equal((refreshed.payload as any).selectedVariant.media.status, 'completed');
  assert.ok((refreshed.payload as any).selectedVariant.media.imageUrl);

  const approved = await apiJson(`/api/content-items/${item.id}/approve`, { method: 'POST' });
  assert.equal((approved.payload as any).stage, 'approved');

  const scheduledFor = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const scheduled = await apiJson(`/api/content-items/${item.id}/schedule`, {
    method: 'POST',
    body: { scheduledFor }
  });
  assert.equal((scheduled.payload as any).stage, 'scheduled');

  const calendar = await apiJson('/api/calendar');
  assert.ok((calendar.payload as any).entries.some((entry: any) => entry.id === item.id));

  const imageUrl = (refreshed.payload as any).selectedVariant.media.imageUrl;
  const mediaResponse = await fetch(imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`);
  assert.equal(mediaResponse.status, 200);

  const integrity = await apiJson('/api/system-integrity');
  assert.equal((integrity.payload as any).mediaPipeline.output, 'ok');
  assert.equal((integrity.payload as any).mediaPipeline.serving, 'ok');
  assert.ok((integrity.payload as any).lastSuccessfulMediaJob);
});

test('v3 opportunity detection ranks explainable ReemTeam moments and filters weak/internal opportunities', async () => {
  const now = new Date();
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000).toISOString();
  const feed = {
    generatedAt: now.toISOString(),
    nextCursor: 'cursor-after-v3',
    events: [
      {
        eventId: 'reem-1',
        eventType: 'reem_achieved',
        occurredAt: minutesAgo(10),
        playerId: 'jay',
        playerDisplayName: 'Jay',
        cribId: 'back-room',
        cribName: 'Back Room',
        tableId: 'table-1',
        stake: 20,
        matchId: 'match-reem-1',
        amountWon: 95,
        winType: 'reem',
        visibilitySafe: true
      },
      {
        eventId: 'normal-1',
        eventType: 'round_completed',
        occurredAt: minutesAgo(12),
        playerId: 'sam',
        playerDisplayName: 'Sam',
        stake: 1,
        amountWon: 4,
        winType: 'normal_low_hand',
        visibilitySafe: true
      },
      {
        eventId: 'payout-1',
        eventType: 'high_stakes_win',
        occurredAt: minutesAgo(9),
        playerId: 'nina',
        playerDisplayName: 'Nina',
        cribId: 'crown-room',
        cribName: 'Crown Room',
        stake: 50,
        amountWon: 260,
        winType: 'normal_low_hand',
        visibilitySafe: true
      },
      {
        eventId: 'drop-1',
        eventType: 'drop_caught',
        occurredAt: minutesAgo(8),
        playerId: 'mo',
        playerDisplayName: 'Mo',
        cribId: 'back-room',
        cribName: 'Back Room',
        stake: 10,
        amountWon: 35,
        winType: 'caught_drop',
        visibilitySafe: true
      },
      {
        eventId: 'leader-1',
        eventType: 'leaderboard_changed',
        occurredAt: minutesAgo(7),
        playerId: 'jay',
        playerDisplayName: 'Jay',
        leaderboardMovement: { metric: 'daily_reems', previousRank: 8, currentRank: 3 },
        visibilitySafe: true
      },
      {
        eventId: 'crib-1',
        eventType: 'event_table_active',
        occurredAt: minutesAgo(6),
        cribId: 'quick-smoke',
        cribName: 'Quick Smoke',
        tableId: 'table-2',
        stake: 5,
        visibilitySafe: true
      },
      {
        eventId: 'crib-2',
        eventType: 'table_filled',
        occurredAt: minutesAgo(5),
        cribId: 'quick-smoke',
        cribName: 'Quick Smoke',
        tableId: 'table-2',
        stake: 5,
        visibilitySafe: true
      },
      {
        eventId: 'wallet-1',
        eventType: 'wallet_credit_awarded',
        occurredAt: minutesAgo(4),
        playerId: 'jay',
        playerDisplayName: 'Jay',
        amountWon: 25,
        visibilitySafe: false
      }
    ]
  };

  await modules.syncRgeFeedV3({ preloadedFeed: feed });
  await modules.syncRgeFeedV3({ preloadedFeed: feed });

  let opportunities = await apiJson('/api/opportunities');
  const rows = opportunities.payload as any[];
  const types = rows.map((row) => row.opportunityType);

  assert.equal(await modules.OpportunityCandidateModel.countDocuments({ sourceEventIds: 'reem-1' }), 1);
  assert.equal(types.includes('reem_moment'), true);
  assert.equal(types.includes('caught_drop'), true);
  assert.equal(types.includes('leaderboard_jump'), true);
  assert.equal(types.includes('hot_crib'), true);
  assert.equal(types.includes('wallet_credit_momentum'), false);
  assert.equal(types.includes('deposit_momentum'), false);

  const reem = rows.find((row) => row.opportunityType === 'reem_moment');
  const payout = rows.find((row) => row.opportunityType === 'high_stakes_win');
  const normal = rows.find((row) => row.opportunityType === 'normal_low_hand');
  assert.ok(reem.finalScore > 60);
  assert.ok(payout.finalScore > (normal?.finalScore ?? 0));
  assert.ok(reem.explanation.summary.includes('RGE is showing this'));
  assert.ok(Object.keys(reem.scoreParts).includes('gameplayIntensity'));

  await modules.OperatorSettingModel.findOneAndUpdate(
    { operatorEmail: process.env.OPERATOR_EMAIL },
    { $set: { activeCampaign: 'high_stakes_promo' } },
    { upsert: true }
  );
  await modules.syncRgeFeedV3({ preloadedFeed: feed });
  opportunities = await apiJson('/api/opportunities');
  const boostedPayout = (opportunities.payload as any[]).find((row) => row.opportunityType === 'high_stakes_win');
  assert.ok(boostedPayout.scoreParts.campaignFit > reem.scoreParts.campaignFit);

  const fatigueFeed = {
    generatedAt: now.toISOString(),
    events: [1, 2, 3, 4].map((index) => ({
      eventId: `reem-fatigue-${index}`,
      eventType: 'reem_achieved',
      occurredAt: minutesAgo(index),
      playerId: `player-fatigue-${index}`,
      playerDisplayName: `Player ${index}`,
      cribId: 'back-room',
      cribName: 'Back Room',
      stake: 5,
      amountWon: 40,
      winType: 'reem',
      visibilitySafe: true
    }))
  };
  await modules.syncRgeFeedV3({ preloadedFeed: fatigueFeed });
  const fatigued = await modules.OpportunityCandidateModel.findOne({ candidateKey: 'reem_moment:reem-fatigue-4' }).lean();
  assert.ok(fatigued.penalties.fatiguePenalty > 0);
});

test('media worker persists failure details when an attached asset path is invalid', async () => {
  const { item } = await seedOpportunityAndCreateItem();

  const brokenAsset = await modules.AssetModel.create({
    originalName: 'broken.png',
    storedFilename: 'broken.png',
    kind: 'image',
    mimeType: 'image/png',
    fileSize: 8,
    title: 'Broken asset',
    tags: [],
    originalPath: path.join(process.cwd(), 'missing-assets', 'broken.png')
  });

  await modules.ContentVariantModel.findByIdAndUpdate(item.selectedVariantId, {
    $set: {
      assetIds: [brokenAsset._id]
    }
  });

  await assert.rejects(() =>
    modules.processMediaJobData({
      id: 'media-job-broken',
      data: {
        targetType: 'variant',
        variantId: item.selectedVariantId
      }
    })
  );

  const failedVariant = await modules.ContentVariantModel.findById(item.selectedVariantId).lean();
  assert.equal(failedVariant.media.status, 'failed');
  assert.ok(failedVariant.media.errorMessage);

  const integrity = await apiJson('/api/system-integrity');
  assert.equal((integrity.payload as any).lastFailedMediaJob !== null, true);
  assert.equal(
    (integrity.payload as any).issues.some((issue: any) =>
      ['media_failure_missing_reason', 'media_processing_unhealthy'].includes(issue.code) || issue.summary.includes('media')
    ),
    true
  );
});

test('asset deletion removes library files and linked references safely', async () => {
  const { item } = await seedOpportunityAndCreateItem();

  const originalPath = path.join(modules.env.assetOriginalDir, 'delete-me.png');
  const editedPath = path.join(modules.env.assetEditedDir, 'delete-me-edited.png');
  await fs.writeFile(originalPath, 'original-file');
  await fs.writeFile(editedPath, 'edited-file');

  const asset = await modules.AssetModel.create({
    originalName: 'delete-me.png',
    storedFilename: 'delete-me.png',
    kind: 'image',
    mimeType: 'image/png',
    fileSize: 12,
    title: 'Delete Me',
    tags: ['cleanup'],
    originalPath,
    editedPath,
    editorStatus: 'edited'
  });

  const contentItem = await modules.ContentItemModel.findById(item.id);
  const variant = await modules.ContentVariantModel.findById(item.selectedVariantId);
  const brief = await modules.CreativeBriefModel.findById(contentItem.briefId);
  const idea = await modules.ContentIdeaModel.findById(contentItem.sourceOpportunityId);

  await Promise.all([
    modules.ContentItemModel.findByIdAndUpdate(item.id, { $set: { selectedMediaAssetIds: [asset._id] } }),
    modules.ContentVariantModel.findByIdAndUpdate(item.selectedVariantId, { $set: { assetIds: [asset._id] } }),
    modules.CreativeBriefModel.findByIdAndUpdate(brief._id, { $set: { assetIds: [asset._id] } }),
    modules.ContentIdeaModel.findByIdAndUpdate(idea._id, { $set: { linkedAssets: [asset._id] } })
  ]);

  const response = await apiJson(`/api/assets/${asset._id}`, { method: 'DELETE' });
  assert.equal(response.status, 200);
  assert.equal((response.payload as any).id, String(asset._id));

  const [deletedAsset, updatedItem, updatedVariant, updatedBrief, updatedIdea] = await Promise.all([
    modules.AssetModel.findById(asset._id).lean(),
    modules.ContentItemModel.findById(item.id).lean(),
    modules.ContentVariantModel.findById(item.selectedVariantId).lean(),
    modules.CreativeBriefModel.findById(brief._id).lean(),
    modules.ContentIdeaModel.findById(idea._id).lean()
  ]);

  assert.equal(deletedAsset, null);
  assert.equal((updatedItem.selectedMediaAssetIds ?? []).length, 0);
  assert.equal((updatedVariant.assetIds ?? []).length, 0);
  assert.equal((updatedBrief.assetIds ?? []).length, 0);
  assert.equal((updatedIdea.linkedAssets ?? []).length, 0);
  assert.equal(await fs.stat(originalPath).catch(() => null), null);
  assert.equal(await fs.stat(editedPath).catch(() => null), null);
});

test('system health and diagnostics surface backend, redis, ffmpeg, and stale worker failures clearly', async () => {
  withMockedBackendFetch(async () => {
    throw new Error('backend offline');
  });

  await modules.WorkerHeartbeatModel.create({
    workerName: 'media-worker',
    queueName: 'rge-media',
    status: 'healthy',
    lastHeartbeatAt: new Date(Date.now() - 10 * 60 * 1000)
  });

  const response = await apiJson('/api/system-health');
  const health = response.payload as any;

  assert.equal(health.backendConnectivity.status, 'down');
  assert.equal(health.redis.status, 'down');
  assert.equal(health.mediaDiagnostics.ffmpeg.status, 'down');
  assert.equal(health.workerHealth[0].status, 'down');

  const workers = await apiJson('/api/workers/status');
  assert.equal((workers.payload as any).summary.status, 'error');
  assert.equal((workers.payload as any).workers.media.status, 'error');

  const integrity = await apiJson('/api/system-integrity');
  assert.equal((integrity.payload as any).backendConnection, 'error');
  assert.equal((integrity.payload as any).redis, 'error');
  assert.equal((integrity.payload as any).workers.media, 'error');
  assert.equal((integrity.payload as any).issues.some((issue: any) => issue.code === 'backend_connection_down'), true);
});
