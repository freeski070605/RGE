import { ContentIdeaModel } from '../../db/models/ContentIdea';
import { ContentItemModel } from '../../db/models/ContentItem';
import { GameSignalModel } from '../../db/models/GameSignal';

const freshnessLabel = (createdAt: Date) => {
  const ageHours = Math.max(0, (Date.now() - createdAt.getTime()) / (60 * 60 * 1000));
  if (ageHours < 3) {
    return 'Just in';
  }

  if (ageHours < 12) {
    return 'Fresh today';
  }

  if (ageHours < 24) {
    return 'Today';
  }

  return 'Aging';
};

export const listOpportunities = async () => {
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
        freshness: freshnessLabel(opportunity.createdAt),
        sourceSignals,
        operatorStatus: opportunity.operatorStatus ?? 'open',
        contentItem: contentItemByOpportunityId.get(String(opportunity._id)) ?? null,
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt
      };
    });
};
