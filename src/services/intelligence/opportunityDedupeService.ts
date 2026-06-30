import { ContentItemModel } from '../../db/models/ContentItem';
import { OpportunityCandidateModel } from '../../db/models/OpportunityCandidate';

export type OpportunityPenaltyParts = {
  duplicatePenalty: number;
  fatiguePenalty: number;
  lowContextPenalty: number;
  weakVisualPenalty: number;
  privacyRiskPenalty: number;
  staleMomentPenalty: number;
};

export const emptyPenalties = (): OpportunityPenaltyParts => ({
  duplicatePenalty: 0,
  fatiguePenalty: 0,
  lowContextPenalty: 0,
  weakVisualPenalty: 0,
  privacyRiskPenalty: 0,
  staleMomentPenalty: 0
});

export const calculateOpportunityPenalties = async (input: {
  candidateKey?: string;
  opportunityType: string;
  sourceEventIds: string[];
  playerId?: string;
  cribId?: string;
  visibilitySafe: boolean;
  occurredAt: Date;
  hasVisualContext: boolean;
}) => {
  const penalties = emptyPenalties();
  const now = Date.now();
  const recentCutoff = new Date(now - 48 * 60 * 60 * 1000);
  const playerCutoff = new Date(now - 72 * 60 * 60 * 1000);

  if (input.sourceEventIds.length) {
    const duplicate = await OpportunityCandidateModel.findOne({
      sourceEventIds: { $in: input.sourceEventIds },
      status: { $in: ['open', 'saved', 'converted'] }
    }).lean();
    if (duplicate && duplicate.candidateKey !== input.candidateKey) {
      penalties.duplicatePenalty = 100;
    }
  }

  const [recentSameType, recentSamePlayer] = await Promise.all([
    OpportunityCandidateModel.countDocuments({
      opportunityType: input.opportunityType,
      createdAt: { $gte: recentCutoff },
      status: { $in: ['open', 'saved', 'converted'] }
    }),
    input.playerId
      ? ContentItemModel.countDocuments({
          opportunityType: input.opportunityType,
          createdAt: { $gte: playerCutoff },
          stage: { $nin: ['archived', 'wont_use'] },
          sourceEventIds: { $exists: true }
        })
      : Promise.resolve(0)
  ]);

  if (recentSameType >= 3) {
    penalties.fatiguePenalty += Math.min(18, recentSameType * 4);
  }
  if (recentSamePlayer >= 2) {
    penalties.fatiguePenalty += Math.min(16, recentSamePlayer * 5);
  }
  if (!input.hasVisualContext) {
    penalties.weakVisualPenalty = 7;
  }
  if (!input.playerId && !input.cribId) {
    penalties.lowContextPenalty = 10;
  }
  if (!input.visibilitySafe) {
    penalties.privacyRiskPenalty = 100;
  }

  const ageHours = Math.max(0, (now - input.occurredAt.getTime()) / (60 * 60 * 1000));
  if (ageHours > 24) {
    penalties.staleMomentPenalty = Math.min(20, Math.round(ageHours / 6));
  }

  return penalties;
};
