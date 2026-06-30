const topScoreParts = (scoreParts: Record<string, number>) =>
  Object.entries(scoreParts)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 3)
    .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase());

export const explainOpportunity = (input: {
  title: string;
  playerDisplayName?: string;
  cribName?: string;
  opportunityType: string;
  indicators: Array<{ indicatorType: string; metadata?: Record<string, unknown> }>;
  scoreParts: Record<string, number>;
  penalties: Record<string, number>;
  recommendedFormat: string;
  recommendedPlatforms: string[];
  urgency: string;
}) => {
  const indicatorLabels = input.indicators.map((indicator) => indicator.indicatorType.replace(/_/g, ' '));
  const boosts = topScoreParts(input.scoreParts);
  const appliedPenalties = Object.entries(input.penalties)
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} (${value})`);
  const subject = input.playerDisplayName || input.cribName || 'this ReemTeam moment';

  return {
    summary: `RGE is showing this because ${subject} triggered ${indicatorLabels.join(', ') || input.opportunityType.replace(/_/g, ' ')}, with strongest boosts from ${boosts.join(', ') || 'freshness and content potential'}.`,
    indicators: indicatorLabels,
    scoreBoosts: boosts,
    penalties: appliedPenalties,
    formatReason: `${input.recommendedFormat} fits because this opportunity needs a ${input.urgency === 'critical' || input.urgency === 'high' ? 'fast, visual' : 'clear, reusable'} treatment on ${input.recommendedPlatforms.join(', ')}.`,
    timing: input.urgency === 'critical' || input.urgency === 'high' ? 'Urgent' : 'Evergreen'
  };
};
