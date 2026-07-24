export const hqRoles = ['owner', 'admin', 'operator', 'moderator', 'support', 'player'] as const;
export type HqRole = (typeof hqRoles)[number];

export const playerTags = [
  'new_player',
  'hot_player',
  'vip',
  'high_stakes',
  'inactive',
  'strong_referrer',
  'event_player',
  'content_safe',
  'do_not_feature',
  'suspicious',
  'needs_support'
] as const;
export type PlayerTag = (typeof playerTags)[number];

export const hqSections = [
  'Command Center',
  'Account Management',
  'Tables',
  'Cribs',
  'Events',
  'Campaigns',
  'Game Intelligence',
  'Growth Plays',
  'Content Studio',
  'Referrals',
  'Support',
  'Analytics',
  'System Health',
  'Settings'
] as const;

export const signalTypes = [
  'reem_detected',
  'caught_drop_detected',
  'big_payout_detected',
  'high_stakes_win_detected',
  'first_turn_41_detected',
  'first_turn_lowball_detected',
  'auto_50_47_detected',
  'hot_player_detected',
  'leaderboard_jump_detected',
  'new_player_first_win_detected',
  'returning_player_active_detected',
  'hot_table_detected',
  'dead_table_detected',
  'crib_heating_up_detected',
  'event_needs_promotion_detected',
  'referral_momentum_detected',
  'inactive_player_segment_detected',
  'content_format_working_detected',
  'content_fatigue_detected',
  'suspicious_activity_detected'
] as const;
export type SignalType = (typeof signalTypes)[number];

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
  'content_recommendation',
  'risk_review'
] as const;
export type GrowthPlayType = (typeof growthPlayTypes)[number];

export const campaignTypes = [
  'grow_new_players',
  'push_referrals',
  'fill_low_stake_tables',
  'promote_high_stake_cribs',
  'reactivate_inactive_players',
  'promote_friday_night_reem',
  'build_leaderboard_competition'
] as const;
export type CampaignType = (typeof campaignTypes)[number];

export const contentFormats = [
  'IG Story',
  'IG Reel',
  'Feed post',
  'Carousel',
  'TikTok',
  'In-app banner',
  'Push notification',
  'Event promo',
  'Leaderboard card',
  'Referral promo'
] as const;

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

export type WhyThis = {
  sourceSignals: string[];
  scoreBoosts: string[];
  penalties: string[];
  campaignFit: string;
  recommendedActionReason: string;
  riskVisibilityNotes: string[];
};

export type CommandCenterMetric = {
  label: string;
  value: string | number;
  tone: 'green' | 'gold' | 'blue' | 'purple' | 'orange' | 'red' | 'neutral';
};
