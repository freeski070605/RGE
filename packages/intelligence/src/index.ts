import { getGameplaySignalWeight } from '../../game-rules/src';
import { CampaignKey, ContentFormat, GameIntelligenceSignal, GrowthPlay, GrowthPlayType, ScoreParts, Urgency } from '../../shared/src';

const emptyScoreParts = (): ScoreParts => ({
  gameplayIntensity: 0,
  businessValue: 0,
  socialProof: 0,
  urgency: 0,
  contentPotential: 0,
  campaignFit: 0,
  novelty: 0,
  recency: 0,
  confidence: 0,
  fatiguePenalty: 0,
  duplicationPenalty: 0,
  riskPenalty: 0
});

const mapSignalToPlayType = (signal: GameIntelligenceSignal): GrowthPlayType => {
  if (signal.signalType.includes('crib')) return 'crib_promo';
  if (signal.signalType.includes('table')) return 'table_fill';
  if (signal.signalType.includes('event')) return 'event_promo';
  if (signal.signalType.includes('leaderboard')) return 'leaderboard_story';
  if (signal.signalType.includes('referral')) return 'referral_push';
  if (signal.signalType.includes('inactive')) return 'player_reactivation';
  if (signal.signalType.includes('new_player')) return 'new_player_activation';
  if (signal.signalType.includes('support')) return 'support_alert';
  if (signal.signalType.includes('content_')) return 'content_recommendation';
  return 'gameplay_highlight';
};

const chooseFormat = (playType: GrowthPlayType): ContentFormat => {
  if (playType === 'table_fill') return 'In-app banner';
  if (playType === 'event_promo') return 'Event promo';
  if (playType === 'referral_push') return 'Push notification';
  if (playType === 'leaderboard_story') return 'Leaderboard card';
  if (playType === 'player_reactivation') return 'Push notification';
  return 'IG Story';
};

const chooseAction = (playType: GrowthPlayType) => {
  if (playType === 'crib_promo') return 'Promote the crib in Command Center and schedule a story.';
  if (playType === 'table_fill') return 'Raise table promotion priority and show an in-app banner.';
  if (playType === 'event_promo') return 'Boost the event and generate an event promo.';
  if (playType === 'leaderboard_story') return 'Feature the leaderboard jump in Content Studio.';
  if (playType === 'referral_push') return 'Send a referral push to the matching segment.';
  if (playType === 'player_reactivation') return 'Send a reactivation notification to inactive players.';
  if (playType === 'support_alert') return 'Alert an admin to inspect the account or table.';
  return 'Build a gameplay highlight in Content Studio.';
};

const campaignMatches = (playType: GrowthPlayType, activeCampaigns: CampaignKey[]) => {
  if (playType === 'new_player_activation') return activeCampaigns.includes('grow_new_players');
  if (playType === 'referral_push') return activeCampaigns.includes('push_referrals');
  if (playType === 'table_fill') return activeCampaigns.includes('fill_low_stake_tables');
  if (playType === 'crib_promo') return activeCampaigns.includes('promote_high_stake_cribs');
  if (playType === 'player_reactivation') return activeCampaigns.includes('reactivate_inactive_players');
  if (playType === 'leaderboard_story') return activeCampaigns.includes('build_leaderboard_competition');
  if (playType === 'gameplay_highlight') return activeCampaigns.includes('promote_friday_night_reem');
  return false;
};

const urgencyFromScore = (score: number): Urgency => {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
};

export const scoreGrowthPlay = (signal: GameIntelligenceSignal, activeCampaigns: CampaignKey[] = []) => {
  const playType = mapSignalToPlayType(signal);
  const scoreParts = emptyScoreParts();
  scoreParts.gameplayIntensity = getGameplaySignalWeight(signal.signalType);
  scoreParts.businessValue = signal.targetTableId || signal.targetCribId ? 14 : 8;
  scoreParts.socialProof = signal.signalType.includes('leaderboard') || signal.signalType.includes('reem') ? 14 : 8;
  scoreParts.urgency = signal.signalType.includes('dead_table') || signal.signalType.includes('event_needs') ? 18 : 10;
  scoreParts.contentPotential = playType === 'gameplay_highlight' || playType === 'leaderboard_story' ? 16 : 10;
  scoreParts.campaignFit = campaignMatches(playType, activeCampaigns) ? 15 : 0;
  scoreParts.novelty = 8;
  scoreParts.recency = 10;
  scoreParts.confidence = Math.round(signal.confidence / 10);

  const positive =
    scoreParts.gameplayIntensity +
    scoreParts.businessValue +
    scoreParts.socialProof +
    scoreParts.urgency +
    scoreParts.contentPotential +
    scoreParts.campaignFit +
    scoreParts.novelty +
    scoreParts.recency +
    scoreParts.confidence;

  const penalties = scoreParts.fatiguePenalty + scoreParts.duplicationPenalty + scoreParts.riskPenalty;
  return { playType, scoreParts, finalScore: Math.max(0, positive - penalties) };
};

export const createGrowthPlayFromSignal = (
  signal: GameIntelligenceSignal,
  activeCampaigns: CampaignKey[] = []
): GrowthPlay => {
  const { playType, scoreParts, finalScore } = scoreGrowthPlay(signal, activeCampaigns);
  const recommendedFormat = chooseFormat(playType);
  const recommendedAction = chooseAction(playType);
  const campaignFit = campaignMatches(playType, activeCampaigns);

  return {
    id: `gp_${signal.id}`,
    title: signal.summary,
    goal: 'Turn a meaningful HQ signal into the highest-value operator action.',
    playType,
    sourceSignalIds: [signal.id],
    targetUserId: signal.targetUserId,
    targetCribId: signal.targetCribId,
    targetTableId: signal.targetTableId,
    targetEventId: signal.targetEventId,
    recommendedAction,
    recommendedChannel: recommendedFormat.includes('IG') || recommendedFormat === 'TikTok' ? 'social' : 'hq',
    recommendedFormat,
    whyItMatters: 'This signal connects gameplay activity to growth, retention, referrals, or table liquidity.',
    whyThis: {
      sourceSignals: [signal.summary],
      scoreBoosts: [
        `Gameplay intensity +${scoreParts.gameplayIntensity}`,
        `Business value +${scoreParts.businessValue}`,
        `Content potential +${scoreParts.contentPotential}`
      ],
      penalties: [],
      campaignFit: campaignFit ? 'Matches an active campaign and receives a campaignFit boost.' : 'No active campaign boost applied.',
      recommendedActionReason: recommendedAction
    },
    urgency: urgencyFromScore(finalScore),
    confidence: signal.confidence,
    estimatedValue: finalScore * 100,
    scoreParts,
    finalScore,
    riskFlags: [],
    status: 'open',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
};
