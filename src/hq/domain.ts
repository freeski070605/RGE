export const hqModules = [
  'Command Center',
  'CRM',
  'Users',
  'Tables',
  'Cribs',
  'Events',
  'Game Intelligence',
  'Growth Plays',
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

export const hqRoles = ['owner', 'admin', 'operator', 'moderator', 'support', 'player'] as const;

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

export const growthPlayScoreParts = [
  'gameplayIntensity',
  'businessValue',
  'socialProof',
  'urgency',
  'contentPotential',
  'campaignFit',
  'novelty',
  'recency',
  'confidence',
  'fatiguePenalty',
  'duplicationPenalty',
  'riskPenalty'
] as const;

export const gameIntelligenceSignalTypes = [
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

export const campaignKeys = [
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
