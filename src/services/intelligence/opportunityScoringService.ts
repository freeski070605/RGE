import { getOperatorSettings } from '../operator/settingsService';
import { calculateOpportunityPenalties, OpportunityPenaltyParts } from './opportunityDedupeService';
import { env } from '../../config/env';

export type OpportunityScoreParts = {
  gameplayIntensity: number;
  payoutValue: number;
  contentPotential: number;
  socialProof: number;
  novelty: number;
  recency: number;
  businessImpact: number;
  playerRelevance: number;
  campaignFit: number;
  confidence: number;
};

const campaignTypeMap: Record<string, string[]> = {
  weekend_push: ['hot_crib', 'reem_moment', 'big_payout', 'table_filling_fast'],
  event_night: ['hot_crib', 'table_filling_fast', 'leaderboard_jump'],
  referral_growth: ['referral_momentum', 'invite_chain', 'new_player_wave'],
  leaderboard_race: ['leaderboard_jump', 'crib_king', 'hot_player'],
  high_stakes_promo: ['high_stakes_win', 'big_payout', 'stake_tier_heating_up'],
  new_player_activation: ['new_player_first_win', 'new_player_wave'],
  inactive_player_reactivation: ['returning_player_heat']
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export const scoreOpportunityCandidate = async (input: {
  opportunityType: string;
  candidateKey?: string;
  indicatorScoreParts: Record<string, number>;
  occurredAt: Date;
  amountWon?: number;
  stake?: number;
  playerId?: string;
  cribId?: string;
  visibilitySafe: boolean;
  sourceEventIds: string[];
  hasVisualContext: boolean;
}) => {
  const settings = await getOperatorSettings(env.OPERATOR_EMAIL);
  const ageHours = Math.max(0, (Date.now() - input.occurredAt.getTime()) / (60 * 60 * 1000));
  const activeCampaign = settings.activeCampaign || 'none';
  const campaignFit = campaignTypeMap[activeCampaign]?.includes(input.opportunityType) ? 92 : activeCampaign === 'none' ? 45 : 35;

  const scoreParts: OpportunityScoreParts = {
    gameplayIntensity: clamp(input.indicatorScoreParts.gameplayIntensity ?? 45),
    payoutValue: clamp(input.indicatorScoreParts.payoutValue ?? Math.min(100, ((input.amountWon ?? 0) / 150) * 100)),
    contentPotential: clamp(input.indicatorScoreParts.contentPotential ?? 55),
    socialProof: clamp(input.indicatorScoreParts.socialProof ?? 40),
    novelty: clamp(input.indicatorScoreParts.novelty ?? 55),
    recency: clamp(100 - ageHours * 3),
    businessImpact: clamp(input.indicatorScoreParts.businessImpact ?? 35),
    playerRelevance: clamp(input.indicatorScoreParts.playerRelevance ?? (input.playerId ? 60 : 35)),
    campaignFit,
    confidence: clamp(input.indicatorScoreParts.confidence ?? 55)
  };

  const penalties = await calculateOpportunityPenalties(input);
  const penaltyTotal = Object.values(penalties).reduce((sum, value) => sum + value, 0);
  const weighted =
    0.18 * scoreParts.gameplayIntensity +
    0.14 * scoreParts.payoutValue +
    0.13 * scoreParts.contentPotential +
    0.12 * scoreParts.socialProof +
    0.11 * scoreParts.novelty +
    0.10 * scoreParts.recency +
    0.09 * scoreParts.businessImpact +
    0.07 * scoreParts.playerRelevance +
    0.04 * scoreParts.campaignFit +
    0.02 * scoreParts.confidence;

  return {
    scoreParts,
    penalties: penalties as OpportunityPenaltyParts,
    finalScore: Number(Math.max(0, weighted - penaltyTotal).toFixed(2))
  };
};
