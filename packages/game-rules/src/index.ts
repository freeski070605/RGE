export const specialWinTypes = ['reem', 'dealt_50_47', 'first_turn_41', 'first_turn_lowball'] as const;

export const cribExamples = ['The Basement', 'Kitchen Table', 'The Back Room', 'Da Crown Room'] as const;

export const eventExamples = [
  'Quick Smoke',
  'Friday Night Reem',
  'Crown Room Night',
  'Double Referral Weekend',
  'Leaderboard Race',
  'New Player Night',
  'High Stakes Run'
] as const;

export const signalTypes = [
  'reem_detected',
  'caught_drop_detected',
  'big_payout_detected',
  'high_stakes_win_detected',
  'first_turn_41_detected',
  'first_turn_lowball_detected',
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
  'content_fatigue_detected'
] as const;

export type SignalType = (typeof signalTypes)[number];

export const isSpecialWinSignal = (signalType: string) =>
  signalType === 'reem_detected' ||
  signalType === 'first_turn_41_detected' ||
  signalType === 'first_turn_lowball_detected' ||
  signalType === 'high_stakes_win_detected';

export const getGameplaySignalWeight = (signalType: string) => {
  if (signalType === 'reem_detected') return 28;
  if (signalType === 'caught_drop_detected') return 22;
  if (signalType === 'big_payout_detected') return 24;
  if (signalType === 'high_stakes_win_detected') return 26;
  if (signalType === 'first_turn_41_detected') return 23;
  if (signalType === 'first_turn_lowball_detected') return 20;
  if (signalType === 'hot_table_detected') return 18;
  if (signalType === 'crib_heating_up_detected') return 18;
  if (signalType === 'referral_momentum_detected') return 16;
  return 10;
};
