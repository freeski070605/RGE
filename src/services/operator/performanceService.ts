import { PerformanceInsightModel } from '../../db/models/PerformanceInsight';
import { listPipeline } from './contentItemService';
import { getGrowthStrategySnapshot } from '../growth/opsService';

const rankTopValues = (rows: string[]) =>
  [...rows.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>()).entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([label, count]) => ({ label, count }));

export const getPerformanceView = async () => {
  const [pipeline, insights, strategy] = await Promise.all([
    listPipeline(),
    PerformanceInsightModel.find().sort({ performanceScore: -1 }).lean(),
    getGrowthStrategySnapshot()
  ]);

  const publishedItems = pipeline.items.filter((item) => item.stage === 'published' || item.stage === 'underperforming');
  const bestPerformers = [...publishedItems]
    .sort((left, right) => right.analyticsSummary.performanceScore - left.analyticsSummary.performanceScore)
    .slice(0, 10);
  const underperforming = publishedItems
    .filter((item) => item.stage === 'underperforming' || item.analyticsSummary.performanceScore < 20)
    .slice(0, 10);

  return {
    totals: {
      engagement: insights.reduce((total, insight) => total + (insight.likes ?? 0) + (insight.comments ?? 0) + (insight.shares ?? 0), 0),
      clicks: insights.reduce((total, insight) => total + (insight.clicks ?? 0), 0),
      signups: insights.reduce((total, insight) => total + (insight.signups ?? 0), 0),
      deposits: insights.reduce((total, insight) => total + (insight.deposits ?? 0), 0),
      conversionInfluence: publishedItems.reduce((total, item) => total + item.analyticsSummary.conversionInfluence, 0)
    },
    bestPerformers,
    underperforming,
    bestHooks: rankTopValues(insights.map((insight) => insight.hookStyle || '').filter(Boolean)),
    bestFormats: rankTopValues(publishedItems.map((item) => item.recommendedFormat || '').filter(Boolean)),
    bestStoryTypes: rankTopValues(publishedItems.map((item) => item.opportunityType || '').filter(Boolean)),
    bestPublishWindows: rankTopValues(
      publishedItems.map((item) => item.schedule.bestTimeWindow || '').filter(Boolean)
    ),
    recommendations: strategy
  };
};
