import { CampaignType, GrowthPlayType, ScoreParts, SignalType, WhyThis } from '@reemteam/shared';

export type GrowthPlayScoringInput = {
  playType: GrowthPlayType;
  signalTypes: SignalType[];
  confidence: number;
  occurredAt: Date;
  visibilitySafe: boolean;
  activeCampaign?: CampaignType | null;
  duplicateCount?: number;
  recentSimilarCount?: number;
  hasRiskFlags?: boolean;
};

const campaignMatches: Record<CampaignType, GrowthPlayType[]> = {
  grow_new_players: ['new_player_activation', 'content_recommendation'],
  push_referrals: ['referral_push'],
  fill_low_stake_tables: ['table_fill'],
  promote_high_stake_cribs: ['crib_promo', 'gameplay_highlight', 'leaderboard_story'],
  reactivate_inactive_players: ['player_reactivation'],
  promote_friday_night_reem: ['event_promo', 'gameplay_highlight', 'leaderboard_story'],
  build_leaderboard_competition: ['leaderboard_story', 'event_promo']
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const scoreGrowthPlay = (input: GrowthPlayScoringInput) => {
  const ageHours = Math.max(0, (Date.now() - input.occurredAt.getTime()) / 1000 / 60 / 60);
  const highSignal = input.signalTypes.some((signal) =>
    ['reem_detected', 'caught_drop_detected', 'big_payout_detected', 'high_stakes_win_detected'].includes(signal)
  );
  const campaignFit =
    input.activeCampaign && campaignMatches[input.activeCampaign].includes(input.playType)
      ? 92
      : input.activeCampaign
        ? 35
        : 50;

  const parts: ScoreParts = {
    gameplayIntensity: highSignal ? 88 : 56,
    businessValue: ['crib_promo', 'table_fill', 'event_promo', 'referral_push'].includes(input.playType) ? 82 : 62,
    socialProof: input.signalTypes.includes('leaderboard_jump_detected') || highSignal ? 84 : 48,
    urgency: ageHours < 2 ? 90 : ageHours < 12 ? 72 : 42,
    contentPotential: input.visibilitySafe ? 82 : 26,
    campaignFit,
    novelty: clamp(88 - (input.recentSimilarCount ?? 0) * 12),
    recency: clamp(100 - ageHours * 5),
    confidence: clamp(input.confidence),
    fatiguePenalty: clamp((input.recentSimilarCount ?? 0) * 8),
    duplicationPenalty: clamp((input.duplicateCount ?? 0) * 14),
    riskPenalty: input.hasRiskFlags || !input.visibilitySafe ? 35 : 0
  };

  const positive =
    parts.gameplayIntensity +
    parts.businessValue +
    parts.socialProof +
    parts.urgency +
    parts.contentPotential +
    parts.campaignFit +
    parts.novelty +
    parts.recency +
    parts.confidence;
  const penalties = parts.fatiguePenalty + parts.duplicationPenalty + parts.riskPenalty;
  const finalScore = clamp(positive / 9 - penalties / 3);

  const urgency: 'high' | 'medium' | 'low' = finalScore >= 85 ? 'high' : finalScore >= 65 ? 'medium' : 'low';

  return {
    scoreParts: parts,
    finalScore,
    urgency
  };
};

export const explainGrowthPlay = (input: {
  signalTitles: string[];
  scoreParts: ScoreParts;
  activeCampaign?: CampaignType | null;
  recommendedAction: string;
  visibilitySafe: boolean;
  riskFlags: string[];
}): WhyThis => {
  const boosts = Object.entries(input.scoreParts)
    .filter(([key, value]) => !key.endsWith('Penalty') && value >= 80)
    .map(([key]) => key);
  const penalties = Object.entries(input.scoreParts)
    .filter(([key, value]) => key.endsWith('Penalty') && value > 0)
    .map(([key]) => key);

  return {
    sourceSignals: input.signalTitles,
    scoreBoosts: boosts,
    penalties,
    campaignFit: input.activeCampaign ? `Matches active campaign ${input.activeCampaign}.` : 'No active campaign boost applied.',
    recommendedActionReason: `HQ recommends this because ${input.recommendedAction.toLowerCase()}`,
    riskVisibilityNotes: input.visibilitySafe ? ['Safe for operator action.'] : ['Not safe for public content without review.', ...input.riskFlags]
  };
};
