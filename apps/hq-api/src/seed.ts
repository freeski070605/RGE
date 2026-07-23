import { connectDatabase, disconnectDatabase } from './db.js';
import { hqModels } from './services.js';
import { Operator } from './auth.js';
import { createGrowthPlayFromSignal, buildContentDraft } from './services.js';
import mongoose from 'mongoose';

const actor: Operator = {
  id: 'seed',
  email: 'seed@reemteam.local',
  name: 'ReemTeamHQ Seed',
  role: 'owner'
};

await connectDatabase();

const realPlayerCount = await mongoose.connection.db?.collection('users').estimatedDocumentCount().catch(() => 0) ?? 0;
if (realPlayerCount > 0 && process.env.DEMO_SEED_ALLOW_REAL_DB !== 'true') {
  throw new Error('Refusing to run demo seed because original ReemTeam players exist in users. Set DEMO_SEED_ALLOW_REAL_DB=true only for a disposable database.');
}

await Promise.all([
  hqModels.AdminActionLog.deleteMany({}),
  hqModels.AdminNote.deleteMany({}),
  hqModels.Campaign.deleteMany({}),
  hqModels.ContentDraft.deleteMany({}),
  hqModels.Crib.deleteMany({}),
  hqModels.Event.deleteMany({}),
  hqModels.GameIntelligenceSignal.deleteMany({}),
  hqModels.GrowthPlay.deleteMany({}),
  hqModels.HQSetting.deleteMany({}),
  hqModels.PerformanceResult.deleteMany({}),
  hqModels.Referral.deleteMany({}),
  hqModels.SupportIssue.deleteMany({}),
  hqModels.Table.deleteMany({}),
  hqModels.User.deleteMany({}),
  hqModels.UserProfile.deleteMany({}),
  hqModels.WalletLedger.deleteMany({})
]);

const [maya, jay, nina, mo] = await hqModels.User.create([
  { displayName: 'Crown Maya', username: 'crownmaya', email: 'maya@example.com', role: 'player', tags: ['vip', 'hot_player', 'content_safe'], lastActiveAt: new Date(), favoriteCrib: 'Da Crown Room', averageStake: 45, highestStake: 120, gamesPlayed: 188, wins: 104, losses: 84, reems: 9, drops: 3, caughtDrops: 7, referrals: 12, walletSummary: { credits: 3200, winnings: 18400, promotionalCredits: 900, referralCredits: 2200 } },
  { displayName: 'Jay Reem', username: 'jayreem', email: 'jay@example.com', role: 'player', tags: ['strong_referrer', 'event_player'], lastActiveAt: new Date(), favoriteCrib: 'The Back Room', averageStake: 18, highestStake: 60, gamesPlayed: 76, wins: 41, losses: 35, reems: 4, referrals: 18 },
  { displayName: 'Nina Lowball', username: 'ninalow', email: 'nina@example.com', role: 'player', tags: ['new_player', 'content_safe'], lastActiveAt: new Date(), favoriteCrib: 'Kitchen Table', averageStake: 8, highestStake: 20, gamesPlayed: 18, wins: 7, losses: 11, reems: 1 },
  { displayName: 'Mo Support', username: 'mosupport', email: 'mo@example.com', role: 'support', tags: ['needs_support'], status: 'active' }
]);

await hqModels.UserProfile.create([maya, jay, nina].map((user: any) => ({
  userId: user._id,
  displayName: user.displayName,
  contact: { email: user.email },
  tags: user.tags,
  summary: { gamesPlayed: user.gamesPlayed, wins: user.wins, reems: user.reems },
  contentSafe: user.contentSafe
})));

const [basement, kitchen, backRoom, crownRoom] = await hqModels.Crib.create([
  { cribName: 'The Basement', description: 'Default low-stakes action.', stakeTier: 'low', theme: 'basement', status: 'active', growthPriority: 45 },
  { cribName: 'Kitchen Table', description: 'Friendly new-player games.', stakeTier: 'low', theme: 'kitchen', status: 'active', featured: true, growthPriority: 62 },
  { cribName: 'The Back Room', description: 'Mid/high heat with social proof.', stakeTier: 'mid', theme: 'back-room', status: 'active', growthPriority: 88, eventEligible: true },
  { cribName: 'Da Crown Room', description: 'VIP tables and big Reem moments.', stakeTier: 'high', theme: 'crown', status: 'active', featured: true, growthPriority: 96 }
]);

const [table1, table2, table3] = await hqModels.Table.create([
  { tableName: 'Kitchen 1', cribId: kitchen._id, stake: 5, maxSeats: 4, status: 'active', visibility: 'public', priority: 60 },
  { tableName: 'Back Room 4', cribId: backRoom._id, stake: 25, maxSeats: 4, status: 'active', visibility: 'public', eventTable: true, priority: 88, featured: true },
  { tableName: 'Crown Room 2', cribId: crownRoom._id, stake: 100, maxSeats: 4, status: 'open', visibility: 'private', priority: 95, aiFillEnabled: false }
]);

const friday = await hqModels.Event.create({
  eventName: 'Friday Night Reem',
  eventType: 'reem_chase',
  description: 'High-energy Reem chase in the Back Room and Crown Room.',
  startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
  endTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
  eligibleCribs: [backRoom._id, crownRoom._id],
  eligibleTables: [table2._id, table3._id],
  rewardRules: { reemBonus: 500 },
  leaderboardRules: { metric: 'reems' },
  contentGoal: 'Create social proof.',
  growthGoal: 'Drive high-stake table joins.',
  status: 'scheduled'
});

await hqModels.Campaign.create([
  { campaignName: 'Promote Friday Night Reem', campaignType: 'promote_friday_night_reem', description: 'Boost Friday event energy.', status: 'active', priority: 100, scoringBoosts: { campaignFit: 20 } },
  { campaignName: 'Push Referrals', campaignType: 'push_referrals', description: 'Turn active players into invite momentum.', status: 'draft', priority: 70 }
]);

const signals = await hqModels.GameIntelligenceSignal.create([
  { signalType: 'reem_detected', sourceType: 'gameplay', sourceId: 'round-1001', playerId: maya._id, tableId: table2._id, cribId: backRoom._id, eventId: friday._id, title: 'Crown Maya hit a Reem in The Back Room', description: 'A content-safe Reem landed during an event table run.', occurredAt: new Date(), severity: 'high', confidence: 96, visibilitySafe: true, metadata: { amount: 245 } },
  { signalType: 'referral_momentum_detected', sourceType: 'referrals', sourceId: 'ref-day-1', playerId: jay._id, title: 'Jay Reem is driving referral movement', description: 'Jay invited four players and two converted this week.', occurredAt: new Date(), severity: 'medium', confidence: 88, visibilitySafe: true },
  { signalType: 'suspicious_activity_detected', sourceType: 'wallet', sourceId: 'wallet-flag-1', playerId: mo._id, title: 'Repeated wallet dispute pattern detected', description: 'Support and wallet records show repeated adjustment requests.', occurredAt: new Date(), severity: 'critical', confidence: 82, visibilitySafe: false }
]);

const plays = [];
for (const signal of signals) {
  plays.push(await createGrowthPlayFromSignal(actor, String(signal._id), {}));
}
await buildContentDraft(actor, plays[0].id);

await hqModels.Referral.create([
  { ownerUserId: jay._id, invitedUserId: nina._id, code: 'JAYREEM', status: 'converted', rewardAmount: 500 },
  { ownerUserId: maya._id, code: 'CROWN', status: 'active', rewardAmount: 0 }
]);
await hqModels.WalletLedger.create([
  { userId: maya._id, type: 'credit', amount: 18400, reason: 'Winnings balance' },
  { userId: jay._id, type: 'credit', amount: 500, reason: 'Referral reward' },
  { userId: mo._id, type: 'adjustment', amount: -1200, reason: 'Manual review request', suspicious: true }
]);
await hqModels.SupportIssue.create([
  { userId: mo._id, title: 'Wallet dispute needs review', severity: 'high', status: 'open', notes: ['Repeated adjustment language.'] },
  { userId: nina._id, title: 'New player onboarding question', severity: 'low', status: 'open', notes: ['Asked about Kitchen Table stakes.'] }
]);
await hqModels.PerformanceResult.create([
  { contentDraftId: undefined, growthPlayId: undefined, channel: 'IG Story', format: 'Leaderboard card', metric: 'table_joins', value: 18, learning: 'Leaderboard posts worked best on Sunday nights.' },
  { channel: 'In-app banner', format: 'Referral promo', metric: 'referral_conversions', value: 7, learning: 'Referral pushes performed better during live events.' }
]);
await hqModels.HQSetting.create({ key: 'operator_settings', value: { automationMode: 'assisted', approvedChannels: ['Content Studio', 'In-app banner', 'Push notification'], approvedFormats: ['IG Story', 'Leaderboard card', 'Referral promo'], activeCampaign: 'promote_friday_night_reem' }, updatedBy: actor.email });

console.log('Seeded ReemTeamHQ with players, cribs, tables, events, campaigns, signals, Growth Plays, drafts, referrals, wallet, support, analytics, and settings.');
await disconnectDatabase();
