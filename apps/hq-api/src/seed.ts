import { createGrowthPlayFromSignal } from '../../../packages/intelligence/src';
import { CommandCenter, Crib, GameIntelligenceSignal, HQEvent, Table, User, UserProfile } from '../../../packages/shared/src';

const now = new Date();
const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString();

export const users: User[] = [
  {
    id: 'usr_crownmaya',
    username: 'crownmaya',
    displayName: 'Crown Maya',
    email: 'maya@example.com',
    status: 'active',
    role: 'player',
    tags: ['hot_player', 'vip', 'content_safe'],
    lastActiveAt: iso(8)
  },
  {
    id: 'usr_lowballlou',
    username: 'lowballlou',
    displayName: 'Lowball Lou',
    status: 'active',
    role: 'player',
    tags: ['new_player', 'event_player'],
    lastActiveAt: iso(18)
  },
  {
    id: 'usr_admin',
    username: 'hqadmin',
    displayName: 'HQ Admin',
    email: 'ops@reemteam.local',
    status: 'active',
    role: 'owner',
    tags: [],
    lastActiveAt: iso(2)
  }
];

export const profiles: UserProfile[] = [
  {
    userId: 'usr_crownmaya',
    gamesPlayed: 188,
    wins: 104,
    losses: 84,
    reems: 9,
    drops: 14,
    caughtDrops: 7,
    favoriteCrib: 'Da Crown Room',
    averageStake: 50,
    highestStake: 250,
    referralCount: 12,
    walletBalanceCents: 13800,
    supportIssueCount: 0,
    riskFlags: []
  },
  {
    userId: 'usr_lowballlou',
    gamesPlayed: 11,
    wins: 7,
    losses: 4,
    reems: 1,
    drops: 2,
    caughtDrops: 1,
    favoriteCrib: 'Kitchen Table',
    averageStake: 10,
    highestStake: 25,
    referralCount: 2,
    walletBalanceCents: 2900,
    supportIssueCount: 0,
    riskFlags: []
  }
];

export const cribs: Crib[] = [
  {
    id: 'crib_basement',
    cribName: 'The Basement',
    description: 'Low-stake tables for new and returning players.',
    stakeTier: 'low',
    theme: 'basement',
    status: 'active',
    featured: false,
    growthPriority: 72,
    eventEligible: true
  },
  {
    id: 'crib_kitchen',
    cribName: 'Kitchen Table',
    description: 'Friendly mid-speed games and first wins.',
    stakeTier: 'low_mid',
    theme: 'kitchen',
    status: 'active',
    featured: true,
    growthPriority: 81,
    eventEligible: true
  },
  {
    id: 'crib_crown',
    cribName: 'Da Crown Room',
    description: 'High-stakes tables for VIPs and big Reem moments.',
    stakeTier: 'high',
    theme: 'crown',
    status: 'active',
    featured: true,
    growthPriority: 94,
    eventEligible: true
  }
];

export const tables: Table[] = [
  {
    id: 'tbl_crown_4',
    tableName: 'Crown Room 4',
    cribId: 'crib_crown',
    stake: 100,
    maxSeats: 4,
    status: 'active',
    visibility: 'public',
    eventTable: false,
    aiFillEnabled: false,
    minimumBalance: 10000,
    ruleset: 'standard',
    theme: 'crown',
    priority: 92
  },
  {
    id: 'tbl_kitchen_2',
    tableName: 'Kitchen Table 2',
    cribId: 'crib_kitchen',
    stake: 10,
    maxSeats: 4,
    status: 'open',
    visibility: 'public',
    eventTable: true,
    aiFillEnabled: true,
    minimumBalance: 1000,
    ruleset: 'standard',
    theme: 'kitchen',
    priority: 78
  }
];

export const events: HQEvent[] = [
  {
    id: 'evt_friday_reem',
    eventName: 'Friday Night Reem',
    eventType: 'reem_chase',
    startTime: iso(-90),
    endTime: iso(-330),
    eligibleCribs: ['crib_kitchen', 'crib_crown'],
    eligibleTables: ['tbl_kitchen_2', 'tbl_crown_4'],
    stakeRange: { min: 10, max: 250 },
    rewardRules: 'Bonus wallet credit for featured Reem wins.',
    leaderboardRules: 'Rank by Reems, caught drops, and net wins.',
    contentGoal: 'Generate social proof and in-app table joins.',
    growthGoal: 'Increase Friday table activity.',
    status: 'running'
  }
];

export const signals: GameIntelligenceSignal[] = [
  {
    id: 'sig_reem_crownmaya',
    signalType: 'reem_detected',
    source: 'gameplay',
    summary: 'Crown Maya hit a Reem in Da Crown Room.',
    targetUserId: 'usr_crownmaya',
    targetCribId: 'crib_crown',
    targetTableId: 'tbl_crown_4',
    confidence: 96,
    occurredAt: iso(11),
    metadata: { amountCents: 24500, tableName: 'Crown Room 4' }
  },
  {
    id: 'sig_kitchen_heat',
    signalType: 'crib_heating_up_detected',
    source: 'cribs',
    summary: 'Kitchen Table traffic is heating up during Friday Night Reem.',
    targetCribId: 'crib_kitchen',
    targetEventId: 'evt_friday_reem',
    confidence: 88,
    occurredAt: iso(17),
    metadata: { activeTables: 3, joinsLastHour: 22 }
  },
  {
    id: 'sig_referral_push',
    signalType: 'referral_momentum_detected',
    source: 'referrals',
    summary: 'VIP referrals are converting above the weekly baseline.',
    confidence: 83,
    occurredAt: iso(23),
    metadata: { conversionsToday: 6 }
  }
];

export const growthPlays = signals
  .map((signal) => createGrowthPlayFromSignal(signal, ['promote_friday_night_reem', 'push_referrals']))
  .sort((left, right) => right.finalScore - left.finalScore);

export const commandCenter: CommandCenter = {
  question: 'What needs attention today?',
  activeUsersToday: 184,
  gamesPlayedToday: 67,
  tablesActiveNow: tables.filter((table) => table.status === 'active').length,
  hottestCrib: cribs[2],
  biggestWin: { userId: 'usr_crownmaya', displayName: 'Crown Maya', amountCents: 24500, tableName: 'Crown Room 4' },
  latestReem: { userId: 'usr_crownmaya', displayName: 'Crown Maya', tableName: 'Crown Room 4', occurredAt: iso(11) },
  referralActivity: { invitesToday: 18, conversionsToday: 6 },
  openSupportIssues: 2,
  bestGrowthPlay: growthPlays[0],
  eventsRunning: events.filter((event) => event.status === 'running'),
  systemHealth: [
    { component: 'database', status: 'ok', detail: 'HQ data store reachable.' },
    { component: 'game data ingestion', status: 'ok', detail: 'Signals received within the last 15 minutes.' },
    { component: 'worker health', status: 'warning', detail: 'Media worker is not connected in scaffold mode.' },
    { component: 'publishing', status: 'ok', detail: 'No failed publishing jobs.' }
  ]
};
