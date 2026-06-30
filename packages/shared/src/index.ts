export const hqModules = [
  'Command Center',
  'CRM',
  'Users',
  'Tables',
  'Cribs',
  'Events',
  'Game Intelligence',
  'RGE Growth Engine',
  'Content Studio',
  'Referrals',
  'Wallet/Ops',
  'Support',
  'Analytics',
  'System Health'
] as const;

export const hqPipeline = [
  'HQ Data',
  'Game Intelligence Signals',
  'Growth Plays',
  'Operator Action',
  'Content/Promo/Event/User Action',
  'Performance Result',
  'Learning Feedback'
] as const;

export const roles = ['owner', 'admin', 'operator', 'moderator', 'support', 'player'] as const;

export const userTags = [
  'new_player',
  'hot_player',
  'vip',
  'high_stakes',
  'inactive',
  'strong_referrer',
  'needs_support',
  'event_player',
  'suspicious',
  'content_safe',
  'do_not_feature'
] as const;

export const growthPlayTypes = [
  'gameplay_highlight',
  'crib_promo',
  'table_fill',
  'event_promo',
  'leaderboard_story',
  'referral_push',
  'player_reactivation',
  'new_player_activation',
  'vip_highlight',
  'support_alert',
  'admin_alert',
  'content_recommendation'
] as const;

export const growthPlayStatuses = ['open', 'in_progress', 'approved', 'actioned', 'dismissed', 'expired'] as const;

export const campaigns = [
  'grow_new_players',
  'push_referrals',
  'fill_low_stake_tables',
  'promote_high_stake_cribs',
  'reactivate_inactive_players',
  'promote_friday_night_reem',
  'build_leaderboard_competition'
] as const;

export const contentFormats = [
  'IG Story',
  'IG Reel',
  'Feed Post',
  'Carousel',
  'TikTok',
  'In-app banner',
  'Push notification',
  'Event promo',
  'Leaderboard card'
] as const;

export type HQModule = (typeof hqModules)[number];
export type Role = (typeof roles)[number];
export type UserTag = (typeof userTags)[number];
export type GrowthPlayType = (typeof growthPlayTypes)[number];
export type GrowthPlayStatus = (typeof growthPlayStatuses)[number];
export type CampaignKey = (typeof campaigns)[number];
export type ContentFormat = (typeof contentFormats)[number];

export type Urgency = 'low' | 'medium' | 'high' | 'critical';

export type ScoreParts = {
  gameplayIntensity: number;
  businessValue: number;
  socialProof: number;
  urgency: number;
  contentPotential: number;
  campaignFit: number;
  novelty: number;
  recency: number;
  confidence: number;
  fatiguePenalty: number;
  duplicationPenalty: number;
  riskPenalty: number;
};

export type User = {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  status: 'active' | 'disabled' | 'suspended';
  role: Role;
  tags: UserTag[];
  lastActiveAt: string;
};

export type UserProfile = {
  userId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  reems: number;
  drops: number;
  caughtDrops: number;
  favoriteCrib: string;
  averageStake: number;
  highestStake: number;
  referralCount: number;
  walletBalanceCents: number;
  supportIssueCount: number;
  riskFlags: string[];
};

export type Crib = {
  id: string;
  cribName: string;
  description: string;
  stakeTier: string;
  theme: string;
  status: 'draft' | 'active' | 'paused' | 'retired';
  featured: boolean;
  growthPriority: number;
  eventEligible: boolean;
};

export type Table = {
  id: string;
  tableName: string;
  cribId: string;
  stake: number;
  maxSeats: number;
  status: 'open' | 'active' | 'paused' | 'closed';
  visibility: 'public' | 'private';
  eventTable: boolean;
  aiFillEnabled: boolean;
  minimumBalance: number;
  ruleset: string;
  theme: string;
  priority: number;
};

export type HQEvent = {
  id: string;
  eventName: string;
  eventType: string;
  startTime: string;
  endTime: string;
  eligibleCribs: string[];
  eligibleTables: string[];
  stakeRange: { min: number; max: number };
  rewardRules: string;
  leaderboardRules: string;
  contentGoal: string;
  growthGoal: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'cancelled';
};

export type GameIntelligenceSignal = {
  id: string;
  signalType: string;
  source: 'gameplay' | 'tables' | 'cribs' | 'users' | 'referrals' | 'events' | 'campaigns' | 'content_performance';
  summary: string;
  targetUserId?: string;
  targetCribId?: string;
  targetTableId?: string;
  targetEventId?: string;
  confidence: number;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

export type GrowthPlay = {
  id: string;
  title: string;
  goal: string;
  playType: GrowthPlayType;
  sourceSignalIds: string[];
  targetUserId?: string;
  targetCribId?: string;
  targetTableId?: string;
  targetEventId?: string;
  recommendedAction: string;
  recommendedChannel: string;
  recommendedFormat: ContentFormat;
  whyItMatters: string;
  whyThis: {
    sourceSignals: string[];
    scoreBoosts: string[];
    penalties: string[];
    campaignFit: string;
    recommendedActionReason: string;
  };
  urgency: Urgency;
  confidence: number;
  estimatedValue: number;
  scoreParts: ScoreParts;
  finalScore: number;
  riskFlags: string[];
  status: GrowthPlayStatus;
  expiresAt: string;
};

export type CommandCenter = {
  question: 'What needs attention today?';
  activeUsersToday: number;
  gamesPlayedToday: number;
  tablesActiveNow: number;
  hottestCrib: Crib;
  biggestWin: { userId: string; displayName: string; amountCents: number; tableName: string };
  latestReem: { userId: string; displayName: string; tableName: string; occurredAt: string };
  referralActivity: { invitesToday: number; conversionsToday: number };
  openSupportIssues: number;
  bestGrowthPlay: GrowthPlay;
  eventsRunning: HQEvent[];
  systemHealth: Array<{ component: string; status: 'ok' | 'warning' | 'error'; detail: string }>;
};
