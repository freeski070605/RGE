import { Types } from 'mongoose';
import { DerivedIndicatorModel } from '../../db/models/DerivedIndicator';
import { NormalizedEventModel } from '../../db/models/NormalizedEvent';
import { OpportunityCandidateModel } from '../../db/models/OpportunityCandidate';
import { explainOpportunity } from './opportunityExplainService';
import { scoreOpportunityCandidate } from './opportunityScoringService';

const internalIndicatorTypes = new Set(['deposit_momentum', 'wallet_credit_momentum', 'retention_momentum']);

const eventToIndicatorType: Record<string, string> = {
  reem_achieved: 'reem_moment',
  drop_caught: 'caught_drop',
  big_payout: 'big_payout',
  high_stakes_win: 'high_stakes_win',
  leaderboard_changed: 'leaderboard_jump',
  player_streak_changed: 'win_streak',
  referral_completed: 'referral_momentum',
  new_player_first_win: 'new_player_first_win',
  player_returned: 'returning_player_heat',
  wallet_credit_awarded: 'wallet_credit_momentum',
  stake_tier_moved: 'stake_tier_heating_up',
  table_filled: 'table_filling_fast',
  promo_table_active: 'promo_table_active',
  event_table_active: 'hot_crib'
};

const winTypeToIndicatorType: Record<string, string> = {
  auto_50_47: 'auto_win_50_47',
  first_turn_41: 'first_turn_41',
  first_turn_11_under: 'first_turn_lowball',
  caught_drop: 'caught_drop',
  successful_drop: 'clutch_drop',
  reem: 'reem_moment'
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const amountScore = (amount?: number) => clamp(((amount ?? 0) / 150) * 100);
const stakeScore = (stake?: number) => clamp(((stake ?? 0) / 50) * 100);

const scorePartsForEvent = (event: any, indicatorType: string) => {
  const payoutValue = amountScore(event.amountWon);
  const highStake = stakeScore(event.stake);
  const baseGameplay = indicatorType === 'reem_moment' || indicatorType === 'caught_drop' ? 92 : 55;
  return {
    gameplayIntensity: clamp(Math.max(baseGameplay, highStake, payoutValue)),
    payoutValue,
    contentPotential: clamp(['reem_moment', 'caught_drop', 'hot_crib', 'leaderboard_jump', 'promo_table_active'].includes(indicatorType) ? 86 : 62),
    socialProof: clamp(indicatorType.includes('leaderboard') || indicatorType.includes('referral') ? 86 : event.cribId ? 65 : 48),
    novelty: clamp(['auto_win_50_47', 'first_turn_41', 'first_turn_lowball', 'caught_drop'].includes(indicatorType) ? 90 : 58),
    businessImpact: clamp(
      indicatorType === 'promo_table_active'
        ? 78
        : internalIndicatorTypes.has(indicatorType) || indicatorType.includes('referral')
          ? 85
          : highStake > 60
            ? 65
            : 35
    ),
    playerRelevance: event.playerId ? 68 : event.cribId ? 52 : indicatorType === 'promo_table_active' ? 58 : 30,
    confidence: event.visibilitySafe ? 72 : 42
  };
};

const titleFor = (indicatorType: string, event: any) => {
  const player = event.playerDisplayName || 'A player';
  const crib = event.cribName || 'a ReemTeam crib';
  const amount = event.amountWon ? `$${event.amountWon}` : '';
  const labels: Record<string, string> = {
    reem_moment: `${player} hit a Reem${event.cribName ? ` at ${event.cribName}` : ''}`,
    caught_drop: `${player} caught a risky drop`,
    clutch_drop: `${player} pulled off a clutch drop`,
    big_payout: `${player} won ${amount || 'a big payout'}`,
    high_stakes_win: `${player} won at the $${event.stake || 'high'} table`,
    leaderboard_jump: `${player} made a leaderboard jump`,
    win_streak: `${player} is heating up`,
    referral_momentum: `${player} is bringing friends in`,
    new_player_first_win: `${player} got a first win`,
    returning_player_heat: `${player} returned hot`,
    hot_crib: `${crib} is heating up`,
    table_filling_fast: `${crib} table is filling fast`,
    promo_table_active: `${crib} promo table is live with AI players`,
    stake_tier_heating_up: `$${event.stake || 'Higher'} games are heating up`
  };
  return labels[indicatorType] ?? `${player} created a ReemTeam moment`;
};

const recommendationFor = (indicatorType: string) => {
  if (indicatorType === 'promo_table_active') {
    return { format: 'story', platforms: ['story', 'instagram'], angle: 'Show the promo table matchup and turn the AI players into a quick content prompt.' };
  }
  if (indicatorType === 'hot_crib' || indicatorType === 'table_filling_fast') {
    return { format: 'story', platforms: ['story', 'instagram'], angle: 'Show the active crib and invite players to jump in.' };
  }
  if (indicatorType.includes('leaderboard')) {
    return { format: 'carousel', platforms: ['instagram'], angle: 'Frame the movement as a leaderboard race.' };
  }
  if (indicatorType.includes('referral')) {
    return { format: 'story', platforms: ['story'], angle: 'Turn the invite chain into social proof.' };
  }
  return { format: 'reel', platforms: ['instagram', 'story'], angle: 'Make the gameplay moment feel immediate and competitive.' };
};

const urgencyFor = (finalScore: number, occurredAt: Date) => {
  const ageHours = (Date.now() - occurredAt.getTime()) / (60 * 60 * 1000);
  if (finalScore >= 78 && ageHours < 6) return 'critical';
  if (finalScore >= 64) return 'high';
  if (finalScore >= 42) return 'medium';
  return 'low';
};

const upsertIndicator = async (event: any, indicatorType: string) => {
  const indicatorKey = `${indicatorType}:${event.eventId}`;
  return DerivedIndicatorModel.findOneAndUpdate(
    { indicatorKey },
    {
      $set: {
        indicatorKey,
        indicatorType,
        sourceEventIds: [event.eventId],
        playerId: event.playerId,
        playerDisplayName: event.playerDisplayName,
        tableId: event.tableId,
        cribId: event.cribId,
        cribName: event.cribName,
        stake: event.stake,
        occurredAt: event.occurredAt,
        window: 'instant',
        scoreParts: scorePartsForEvent(event, indicatorType),
        confidence: event.visibilitySafe ? 72 : 42,
        visibilitySafe: event.visibilitySafe,
        metadata: {
          eventType: event.eventType,
          winType: event.winType,
          amountWon: event.amountWon,
          leaderboardMovement: event.leaderboardMovement
        }
      }
    },
    { upsert: true, new: true }
  );
};

const buildRollingCribIndicators = async (since: Date) => {
  const events = await NormalizedEventModel.find({
    occurredAt: { $gte: since },
    cribId: { $exists: true, $ne: '' },
    visibilitySafe: true
  }).lean();
  const groups = new Map<string, any[]>();
  for (const event of events) {
    const key = String(event.cribId);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  const indicators = [];
  for (const [cribId, cribEvents] of groups) {
    if (cribEvents.length < 2) continue;
    const latest = cribEvents.sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())[0];
    const indicatorKey = `hot_crib:${cribId}:${since.toISOString().slice(0, 13)}`;
    indicators.push(
      await DerivedIndicatorModel.findOneAndUpdate(
        { indicatorKey },
        {
          $set: {
            indicatorKey,
            indicatorType: 'hot_crib',
            sourceEventIds: cribEvents.map((event) => event.eventId),
            cribId,
            cribName: latest.cribName,
            tableId: latest.tableId,
            stake: latest.stake,
            occurredAt: latest.occurredAt,
            window: '6h',
            scoreParts: {
              gameplayIntensity: clamp(cribEvents.length * 18),
              payoutValue: clamp(Math.max(...cribEvents.map((event) => event.amountWon ?? 0)) / 150 * 100),
              contentPotential: 84,
              socialProof: clamp(60 + cribEvents.length * 8),
              novelty: 58,
              businessImpact: 72,
              playerRelevance: 45,
              confidence: 78
            },
            confidence: 78,
            visibilitySafe: true,
            metadata: { eventCount: cribEvents.length }
          }
        },
        { upsert: true, new: true }
      )
    );
  }
  return indicators;
};

const candidateFromIndicator = async (indicator: any) => {
  if (internalIndicatorTypes.has(indicator.indicatorType) && !indicator.visibilitySafe) {
    return null;
  }

  const event = indicator.sourceEventIds?.length
    ? await NormalizedEventModel.findOne({ eventId: indicator.sourceEventIds[0] }).lean()
    : null;
  const candidateKey = `${indicator.indicatorType}:${indicator.sourceEventIds?.[0] ?? indicator.indicatorKey}`;
  const recommendation = recommendationFor(indicator.indicatorType);
  const score = await scoreOpportunityCandidate({
    candidateKey,
    opportunityType: indicator.indicatorType,
    indicatorScoreParts: (indicator.scoreParts as Record<string, number>) ?? {},
    occurredAt: indicator.occurredAt,
    amountWon: event?.amountWon ?? undefined,
    stake: indicator.stake ?? undefined,
    playerId: indicator.playerId ?? undefined,
    cribId: indicator.cribId ?? undefined,
    visibilitySafe: indicator.visibilitySafe,
    sourceEventIds: indicator.sourceEventIds ?? [],
    hasVisualContext: Boolean(indicator.playerDisplayName || indicator.cribName || event?.amountWon || indicator.stake)
  });

  if (score.finalScore < 28 || score.penalties.duplicatePenalty >= 100 || score.penalties.privacyRiskPenalty >= 100) {
    return null;
  }

  const urgency = urgencyFor(score.finalScore, indicator.occurredAt);
  const explanation = explainOpportunity({
    title: titleFor(indicator.indicatorType, event ?? indicator),
    playerDisplayName: indicator.playerDisplayName,
    cribName: indicator.cribName,
    opportunityType: indicator.indicatorType,
    indicators: [indicator],
    scoreParts: score.scoreParts,
    penalties: score.penalties,
    recommendedFormat: recommendation.format,
    recommendedPlatforms: recommendation.platforms,
    urgency
  });

  return OpportunityCandidateModel.findOneAndUpdate(
    { candidateKey },
    {
      $set: {
        candidateKey,
        opportunityType: indicator.indicatorType,
        sourceIndicatorIds: [new Types.ObjectId(String(indicator._id))],
        sourceEventIds: indicator.sourceEventIds ?? [],
        playerId: indicator.playerId,
        playerDisplayName: indicator.playerDisplayName,
        cribId: indicator.cribId,
        cribName: indicator.cribName,
        tableId: indicator.tableId,
        stake: indicator.stake,
        title: titleFor(indicator.indicatorType, event ?? indicator),
        whyItMatters:
          indicator.indicatorType === 'promo_table_active'
            ? 'Promo table activity gives RGE ready-made gameplay context, named AI players, and a low-friction social prompt.'
            : indicator.indicatorType === 'hot_crib'
            ? 'Crib activity is a high-value prompt to get more players into active rooms.'
            : 'This is a concrete ReemTeam gameplay moment with enough context to build content around.',
        recommendedAngle: recommendation.angle,
        recommendedFormat: recommendation.format,
        recommendedPlatforms: recommendation.platforms,
        urgency,
        confidence: score.scoreParts.confidence,
        estimatedValue: Number((score.finalScore * 10 + (event?.amountWon ?? 0)).toFixed(0)),
        scoreParts: score.scoreParts,
        finalScore: score.finalScore,
        penalties: score.penalties,
        visibilitySafe: indicator.visibilitySafe,
        expiresAt: new Date(indicator.occurredAt.getTime() + 72 * 60 * 60 * 1000),
        metadata: {
          explanation,
          indicatorTypes: [indicator.indicatorType],
          source: 'v3'
        }
      },
      $setOnInsert: {
        status: 'open'
      }
    },
    { upsert: true, new: true }
  );
};

export const runIndicatorEngine = async (input?: { since?: Date }) => {
  const since = input?.since ?? new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const events = await NormalizedEventModel.find({ occurredAt: { $gte: since } }).sort({ occurredAt: -1 }).limit(500).lean();
  const indicators = [];

  for (const event of events) {
    const indicatorType = winTypeToIndicatorType[String(event.winType ?? '')] ?? eventToIndicatorType[event.eventType];
    if (!indicatorType) continue;
    indicators.push(await upsertIndicator(event, indicatorType));
  }
  indicators.push(...(await buildRollingCribIndicators(new Date(Date.now() - 6 * 60 * 60 * 1000))));

  const candidates = [];
  for (const indicator of indicators) {
    const candidate = await candidateFromIndicator(indicator);
    if (candidate) candidates.push(candidate);
  }

  await OpportunityCandidateModel.updateMany(
    { expiresAt: { $lt: new Date() }, status: { $in: ['open', 'saved'] } },
    { $set: { status: 'expired' } }
  );

  return {
    processedEvents: events.length,
    upsertedIndicators: indicators.length,
    upsertedCandidates: candidates.length
  };
};
