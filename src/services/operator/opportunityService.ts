import { ContentIdeaModel } from '../../db/models/ContentIdea';
import { ContentItemModel } from '../../db/models/ContentItem';
import { DerivedIndicatorModel } from '../../db/models/DerivedIndicator';
import { GameSignalModel } from '../../db/models/GameSignal';
import { OpportunityCandidateModel } from '../../db/models/OpportunityCandidate';

const freshnessLabel = (createdAt: Date) => {
  const ageHours = Math.max(0, (Date.now() - createdAt.getTime()) / (60 * 60 * 1000));
  if (ageHours < 3) return 'Just in';
  if (ageHours < 12) return 'Fresh today';
  if (ageHours < 24) return 'Today';
  return 'Aging';
};

const listLegacyOpportunities = async () => {
  const opportunities = await ContentIdeaModel.find({
    operatorStatus: { $in: ['open', 'saved', 'converted'] }
  })
    .sort({ priorityScore: -1, createdAt: -1 })
    .limit(80)
    .lean();

  const signalIds = opportunities.flatMap((opportunity) => (opportunity.signalIds ?? []).map((id: any) => String(id)));
  const signals = signalIds.length ? await GameSignalModel.find({ _id: { $in: signalIds } }).lean() : [];
  const signalMap = new Map(signals.map((signal) => [String(signal._id), signal]));
  const contentItems = await ContentItemModel.find({
    sourceOpportunityId: { $in: opportunities.map((opportunity) => opportunity._id) }
  })
    .select('sourceOpportunityId stage')
    .lean();
  const contentItemByOpportunityId = new Map(
    contentItems.map((item) => [String(item.sourceOpportunityId), { id: String(item._id), stage: item.stage }])
  );

  return opportunities
    .filter((opportunity) => opportunity.opportunityType !== 'deposit_momentum' && opportunity.ideaType !== 'social_proof')
    .map((opportunity) => {
      const sourceSignals = (opportunity.signalIds ?? [])
        .map((signalId: any) => signalMap.get(String(signalId)))
        .filter(Boolean)
        .map((signal) => ({
          id: String(signal!._id),
          type: signal!.signalType,
          player: signal!.username || signal!.playerId || 'Unknown player',
          tableName: signal!.tableName || '',
          occurredAt: signal!.occurredAt,
          amount: signal!.amount ?? 0
        }));

      return {
        id: String(opportunity._id),
        title: opportunity.headline,
        headline: opportunity.headline,
        opportunityType: opportunity.opportunityType ?? opportunity.ideaType,
        whyItMatters: opportunity.whyItMatters ?? opportunity.reason,
        whyAmISeeingThis: opportunity.whyThisRecommendation ?? opportunity.reason,
        recommendedContentAngle: opportunity.recommendedContentAngle ?? opportunity.hookAngle,
        recommendedFormat: opportunity.recommendedFormat || 'reel',
        recommendedPlatforms:
          opportunity.recommendedPlatforms?.length ? opportunity.recommendedPlatforms : opportunity.platformRecommendation,
        urgency: opportunity.urgency ?? 'medium',
        confidenceScore: opportunity.confidenceScore ?? opportunity.priorityScore ?? 0,
        estimatedValue: opportunity.estimatedValue ?? opportunity.priorityScore ?? 0,
        finalScore: opportunity.priorityScore ?? 0,
        scoreParts: {},
        penalties: {},
        explanation: null,
        sourceIndicators: [],
        freshness: freshnessLabel(opportunity.createdAt),
        sourceSignals,
        operatorStatus: opportunity.operatorStatus ?? 'open',
        contentItem: contentItemByOpportunityId.get(String(opportunity._id)) ?? null,
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt
      };
    });
};

export const listOpportunities = async () => {
  const candidates = await OpportunityCandidateModel.find({
    status: { $in: ['open', 'saved', 'converted'] },
    visibilitySafe: true,
    finalScore: { $gte: 28 }
  })
    .sort({ finalScore: -1, createdAt: -1 })
    .limit(80)
    .lean();

  if (!candidates.length) {
    return listLegacyOpportunities();
  }

  const indicatorIds = candidates.flatMap((candidate) => (candidate.sourceIndicatorIds ?? []).map((id: any) => String(id)));
  const indicators = indicatorIds.length ? await DerivedIndicatorModel.find({ _id: { $in: indicatorIds } }).lean() : [];
  const indicatorMap = new Map(indicators.map((indicator) => [String(indicator._id), indicator]));
  const ideaIds = candidates.map((candidate) => String((candidate.metadata as any)?.contentIdeaId ?? '')).filter(Boolean);
  const contentItems = ideaIds.length
    ? await ContentItemModel.find({ sourceOpportunityId: { $in: ideaIds } }).select('sourceOpportunityId stage').lean()
    : [];
  const contentItemByIdeaId = new Map(
    contentItems.map((item) => [String(item.sourceOpportunityId), { id: String(item._id), stage: item.stage }])
  );

  return candidates.map((candidate) => {
    const sourceIndicators = (candidate.sourceIndicatorIds ?? [])
      .map((id: any) => indicatorMap.get(String(id)))
      .filter(Boolean)
      .map((indicator) => ({
        id: String(indicator!._id),
        type: indicator!.indicatorType,
        window: indicator!.window,
        confidence: indicator!.confidence,
        scoreParts: indicator!.scoreParts ?? {},
        occurredAt: indicator!.occurredAt
      }));

    const sourceSignals = sourceIndicators.map((indicator) => ({
      id: indicator.id,
      type: indicator.type,
      player: candidate.playerDisplayName || candidate.cribName || 'ReemTeam',
      tableName: candidate.cribName || candidate.tableId || '',
      occurredAt: indicator.occurredAt,
      amount: candidate.estimatedValue ?? 0
    }));
    const contentIdeaId = String((candidate.metadata as any)?.contentIdeaId ?? '');

    return {
      id: String(candidate._id),
      title: candidate.title,
      headline: candidate.title,
      opportunityType: candidate.opportunityType,
      whyItMatters: candidate.whyItMatters,
      whyAmISeeingThis: (candidate.metadata as any)?.explanation?.summary ?? candidate.whyItMatters,
      recommendedContentAngle: candidate.recommendedAngle,
      recommendedFormat: candidate.recommendedFormat,
      recommendedPlatforms: candidate.recommendedPlatforms ?? [],
      urgency: candidate.urgency,
      confidenceScore: candidate.confidence,
      estimatedValue: candidate.estimatedValue,
      finalScore: candidate.finalScore,
      scoreParts: candidate.scoreParts ?? {},
      penalties: candidate.penalties ?? {},
      explanation: (candidate.metadata as any)?.explanation ?? null,
      sourceIndicators,
      freshness: freshnessLabel(candidate.createdAt),
      sourceSignals,
      operatorStatus: candidate.status,
      contentItem: contentIdeaId ? contentItemByIdeaId.get(contentIdeaId) ?? null : null,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt
    };
  });
};
