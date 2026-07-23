import assert from 'node:assert/strict';
import test from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';

const port = 4545;
const baseUrl = `http://127.0.0.1:${port}`;

const api = async (path: string, init?: { method?: string; body?: unknown }) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-hq-internal-token': 'test-token'
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body)
  });
  const payload = response.status === 204 ? null : await response.json();
  return { status: response.status, payload };
};

test('ReemTeamHQ CRUD, Growth Plays, Content Studio, and audit log are clean-slate native', async (t) => {
  let mongo: MongoMemoryServer | null = null;
  let server: { close: (callback: (error?: Error) => void) => void } | null = null;
  let disconnectDatabase: (() => Promise<void>) | null = null;

  try {
    mongo = await MongoMemoryServer.create();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    t.skip(`MongoDB memory server binary unavailable: ${message}`);
    return;
  }

  try {
    process.env.MONGODB_URI = mongo.getUri('reemteam-hq-test');
    process.env.HQ_INTERNAL_TOKEN = 'test-token';
    process.env.JWT_SECRET = 'test-secret';
    process.env.OPERATOR_EMAIL = 'owner@test.local';
    process.env.OPERATOR_PASSWORD = 'password';
    process.env.OPERATOR_NAME = 'Owner';
    const mongoose = await import('mongoose');
    const appModule = await import('../src/app.js');
    const dbModule = await import('../src/db.js');
    const modelModule = await import('../src/models.js');
    const { createApp } = appModule;
    const { connectDatabase } = dbModule;
    disconnectDatabase = dbModule.disconnectDatabase;
    const { AdminActionLog, User } = modelModule;

    await connectDatabase();
    await mongoose.default.connection.db?.dropDatabase();
    const legacyUserId = new mongoose.default.Types.ObjectId();
    await mongoose.default.connection.db?.collection('users').insertOne({
      _id: legacyUserId,
      displayName: 'Legacy Live Player',
      username: 'legacy_live',
      email: 'legacy@example.com',
      role: 'player',
      status: 'active',
      isVip: true
    });
    await mongoose.default.connection.db?.collection('hq_user_profiles').insertOne({
      userId: legacyUserId,
      displayName: 'Legacy Live Player',
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      reems: 0,
      walletSummary: { credits: 0 },
      tags: ['content_safe']
    });
    await mongoose.default.connection.db?.collection('wallets').insertOne({
      userId: legacyUserId,
      usdBalance: 15,
      rtcBalance: 83000,
      availableBalance: 15,
      pendingWithdrawals: 0,
      lifetimeDeposits: 25,
      lifetimeWithdrawals: 10,
      lastRtcRefill: new Date()
    });
    const tableId = new mongoose.default.Types.ObjectId();
    await mongoose.default.connection.db?.collection('tables').insertOne({
      _id: tableId,
      mode: 'FREE_RTC_TABLE'
    });
    await mongoose.default.connection.db?.collection('matches').insertMany([
      {
        tableId,
        status: 'completed',
        winner: legacyUserId,
        winType: 'REEM',
        players: [{ userId: legacyUserId, username: 'legacy_live', stake: 100, buyIn: 100, payout: 250, isAI: false }],
        endTime: new Date()
      },
      {
        tableId,
        status: 'completed',
        winner: new mongoose.default.Types.ObjectId(),
        winType: 'REGULAR',
        players: [{ userId: legacyUserId, username: 'legacy_live', stake: 50, buyIn: 50, payout: -50, isAI: false }],
        endTime: new Date()
      }
    ]);
    const historicalUserId = new mongoose.default.Types.ObjectId();
    await mongoose.default.connection.db?.collection('users').insertOne({
      _id: historicalUserId,
      displayName: 'Historical Username Player',
      username: 'history_live',
      email: 'history@example.com',
      role: 'player',
      status: 'active'
    });
    await mongoose.default.connection.db?.collection('wallets').insertOne({
      userId: historicalUserId,
      usdBalance: 0,
      rtcBalance: 12000,
      availableBalance: 0,
      pendingWithdrawals: 0,
      lifetimeDeposits: 0,
      lifetimeWithdrawals: 0,
      lastRtcRefill: new Date()
    });
    await mongoose.default.connection.db?.collection('matches').insertOne({
      tableId,
      status: 'completed',
      winner: new mongoose.default.Types.ObjectId(),
      winType: 'REEM',
      players: [{ userId: new mongoose.default.Types.ObjectId(), username: 'history_live', stake: 200, buyIn: 200, payout: 500, isAI: false }],
      endTime: new Date()
    });
    await mongoose.default.connection.db?.collection('transactions').insertOne({
      userId: legacyUserId,
      type: 'RtcPurchase',
      amount: 73000,
      currency: 'RTC',
      status: 'Completed',
      date: new Date()
    });
    server = createApp().listen(port);

    const importedPlayers = await api('/api/hq/users');
    assert.equal(importedPlayers.status, 200);
    assert.equal(importedPlayers.payload.some((row: any) => row.username === 'legacy_live'), true);
    assert.equal(importedPlayers.payload.find((row: any) => row.username === 'legacy_live')?.rtcBalance, 83000);
    assert.equal(importedPlayers.payload.find((row: any) => row.username === 'legacy_live')?.gamesPlayed, 2);
    assert.equal(importedPlayers.payload.find((row: any) => row.username === 'legacy_live')?.wins, 1);
    assert.equal(importedPlayers.payload.find((row: any) => row.username === 'history_live')?.rtcBalance, 12000);
    assert.equal(importedPlayers.payload.find((row: any) => row.username === 'history_live')?.gamesPlayed, 1);
    assert.equal(importedPlayers.payload.find((row: any) => row.username === 'history_live')?.wins, 1);
    assert.equal(await User.countDocuments({ username: 'legacy_live' }), 0);

    const originalProfile = await api(`/api/hq/users/${legacyUserId}`);
    assert.equal(originalProfile.status, 200);
    assert.equal(originalProfile.payload.source, 'original_reemteam_players');
    assert.equal(originalProfile.payload.walletSummary.rtcBalance, 83000);
    assert.equal(originalProfile.payload.playerStats.gamesPlayed, 2);
    assert.equal(originalProfile.payload.playerStats.reems, 1);

    const originalWallet = await api(`/api/hq/wallet/${legacyUserId}`);
    assert.equal(originalWallet.status, 200);
    assert.equal(originalWallet.payload.source, 'original_reemteam_admin_wallets');
    assert.equal(originalWallet.payload.wallet.rtcBalance, 83000);
    assert.equal(originalWallet.payload.transactions.length, 1);

    const integrity = await api('/api/hq/data-integrity/players');
    assert.equal(integrity.status, 200);
    assert.equal(integrity.payload.hqReadingFrom, 'original_reemteam_players');
    assert.equal(integrity.payload.originalPlayerCount, 2);

    const user = await api('/api/hq/users', {
      method: 'POST',
      body: {
        displayName: 'Crown Maya',
        username: 'crownmaya',
        email: 'maya@example.com',
        role: 'player',
        tags: ['vip', 'content_safe'],
        gamesPlayed: 12
      }
    });
    assert.equal(user.status, 409, JSON.stringify(user.payload));
    const playerId = String(legacyUserId);

    const tagged = await api(`/api/hq/users/${playerId}/tags`, {
      method: 'PATCH',
      body: { add: ['hot_player'], remove: ['content_safe'] }
    });
    assert.equal(tagged.status, 200);
    assert.equal(tagged.payload.tags.includes('hot_player'), true);
    assert.equal(tagged.payload.tags.includes('content_safe'), false);

    const crib = await api('/api/hq/cribs', {
      method: 'POST',
      body: {
        cribName: 'The Back Room',
        description: 'Higher-stake games with heat.',
        stakeTier: 'high',
        growthPriority: 88,
        featured: true
      }
    });
    assert.equal(crib.status, 201);

    const table = await api('/api/hq/tables', {
      method: 'POST',
      body: {
        tableName: 'Back Room 1',
        cribId: crib.payload.id,
        stake: 50,
        maxSeats: 4,
        status: 'active'
      }
    });
    assert.equal(table.status, 201);

    const event = await api('/api/hq/events', {
      method: 'POST',
      body: {
        eventName: 'Friday Night Reem',
        eventType: 'reem_chase',
        startTime: new Date(Date.now() + 60_000).toISOString(),
        endTime: new Date(Date.now() + 3_600_000).toISOString(),
        eligibleCribs: [crib.payload.id],
        eligibleTables: [table.payload.id],
        growthGoal: 'Drive high-stake participation.'
      }
    });
    assert.equal(event.status, 201);

    const campaign = await api('/api/hq/campaigns', {
      method: 'POST',
      body: {
        campaignName: 'Friday Night Reem Push',
        campaignType: 'promote_friday_night_reem',
        description: 'Boost the hottest crib before the event.',
        priority: 91,
        status: 'draft'
      }
    });
    assert.equal(campaign.status, 201);
    const activatedCampaign = await api(`/api/hq/campaigns/${campaign.payload.id}/activate`, { method: 'POST' });
    assert.equal(activatedCampaign.payload.status, 'active');

    const signal = await api('/api/hq/game-intelligence/signals', {
      method: 'POST',
      body: {
        signalType: 'reem_detected',
        sourceType: 'gameplay',
        sourceId: 'round-1',
        playerId,
        tableId: table.payload.id,
        cribId: crib.payload.id,
        eventId: event.payload.id,
        title: 'Crown Maya hit a Reem in The Back Room',
        description: 'A content-safe Reem landed during a high-stake run.',
        occurredAt: new Date().toISOString(),
        severity: 'high',
        confidence: 96,
        visibilitySafe: true
      }
    });
    assert.equal(signal.status, 201);

    const play = await api('/api/hq/growth-plays', {
      method: 'POST',
      body: {
        signalId: signal.payload.id,
        playType: 'gameplay_highlight',
        activeCampaign: 'promote_friday_night_reem'
      }
    });
    assert.equal(play.status, 201);
    assert.equal(play.payload.whyThis.sourceSignals[0], 'Crown Maya hit a Reem in The Back Room');
    assert.ok(play.payload.finalScore > 0);

    const approved = await api(`/api/hq/growth-plays/${play.payload.id}/approve`, { method: 'POST' });
    assert.equal(approved.payload.status, 'approved');

    const draft = await api(`/api/hq/growth-plays/${play.payload.id}/build-content`, { method: 'POST' });
    assert.equal(draft.status, 201);
    assert.equal(draft.payload.status, 'needs_review');

    const scheduledDraft = await api(`/api/hq/content-drafts/${draft.payload.id}/schedule`, {
      method: 'POST',
      body: { scheduledFor: new Date(Date.now() + 7_200_000).toISOString() }
    });
    assert.equal(scheduledDraft.payload.status, 'scheduled');
    const publishedDraft = await api(`/api/hq/content-drafts/${draft.payload.id}/publish-now`, { method: 'POST' });
    assert.equal(publishedDraft.payload.status, 'published');
    assert.ok(publishedDraft.payload.publishedAt);

    const referral = await api('/api/hq/referrals', {
      method: 'POST',
      body: {
        ownerUserId: playerId,
        code: 'MAYA50',
        status: 'converted',
        rewardAmount: 50
      }
    });
    assert.equal(referral.status, 201);
    const referralSummary = await api('/api/hq/referrals/summary');
    assert.equal(referralSummary.payload.converted, 1);

    const wallet = await api('/api/hq/wallet/adjustment-request', {
      method: 'POST',
      body: {
        userId: playerId,
        amount: 25,
        reason: 'Referral reward approval'
      }
    });
    assert.equal(wallet.status, 201);
    assert.equal(wallet.payload.type, 'adjustment');

    const issue = await api('/api/hq/support', {
      method: 'POST',
      body: {
        userId: playerId,
        title: 'Verify payout screenshot',
        severity: 'medium',
        notes: ['Player submitted receipt.']
      }
    });
    assert.equal(issue.status, 201);
    const resolvedIssue = await api(`/api/hq/support/${issue.payload.id}/resolve`, { method: 'POST' });
    assert.equal(resolvedIssue.payload.status, 'resolved');

    const result = await api('/api/hq/analytics/performance-results', {
      method: 'POST',
      body: {
        contentDraftId: draft.payload.id,
        growthPlayId: play.payload.id,
        campaignId: campaign.payload.id,
        channel: 'Content Studio',
        format: 'IG Story',
        metric: 'table_joins',
        value: 17,
        learning: 'Reem highlight drove table joins from VIP-adjacent players.'
      }
    });
    assert.equal(result.status, 201);
    const analytics = await api('/api/hq/analytics');
    assert.equal(analytics.payload.totals.value, 17);
    const whatWorked = await api('/api/hq/analytics/what-worked');
    assert.equal(whatWorked.payload.learnings.includes('Reem highlight drove table joins from VIP-adjacent players.'), true);

    const settings = await api('/api/hq/settings', {
      method: 'PATCH',
      body: {
        automationMode: 'assisted',
        approvedChannels: ['Content Studio'],
        approvedFormats: ['IG Story'],
        activeCampaign: campaign.payload.id
      }
    });
    assert.equal(settings.payload.activeCampaign, campaign.payload.id);

    const secondSignal = await api('/api/hq/game-intelligence/signals', {
      method: 'POST',
      body: {
        signalType: 'hot_table_detected',
        sourceType: 'gameplay',
        sourceId: 'round-2',
        tableId: table.payload.id,
        cribId: crib.payload.id,
        title: 'Back Room 1 needs one more seat',
        description: 'Table heat is rising and one seat is open.',
        severity: 'medium',
        confidence: 81
      }
    });
    assert.equal(secondSignal.status, 201);
    const generated = await api('/api/hq/growth-plays/generate-from-signals', { method: 'POST' });
    assert.equal(generated.payload.generated.length, 1);

    const command = await api('/api/hq/command-center');
    assert.equal(command.status, 200);
    assert.equal(command.payload.product, 'ReemTeamHQ');

    const actions = await AdminActionLog.find().lean();
    assert.equal(actions.some((action) => action.actionType === 'user_updated'), true);
    assert.equal(actions.some((action) => action.actionType === 'growth_play_created'), true);
    assert.equal(actions.some((action) => action.actionType === 'content_created'), true);
    assert.equal(actions.some((action) => action.actionType === 'campaign_activated'), true);
    assert.equal(actions.some((action) => action.actionType === 'support_issue_resolved'), true);
    assert.equal(actions.some((action) => action.actionType === 'settings_changed'), true);
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
    if (disconnectDatabase) {
      await disconnectDatabase();
    }
    await mongo.stop();
  }
});
