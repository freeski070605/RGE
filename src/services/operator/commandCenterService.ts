import { listOpportunities } from './opportunityService';
import { listPipeline } from './contentItemService';
import { getSystemHealth } from '../system/systemHealthService';

export const getCommandCenter = async () => {
  const [opportunities, pipeline, systemHealth] = await Promise.all([
    listOpportunities(),
    listPipeline(),
    getSystemHealth()
  ]);

  const needsReview = pipeline.items.filter((item) => item.stage === 'needs_review').slice(0, 8);
  const readyToAct = pipeline.items.filter((item) => ['approved', 'scheduled'].includes(item.stage)).slice(0, 8);
  const upcoming = pipeline.items
    .filter((item) => item.schedule.scheduledFor)
    .sort((left, right) => new Date(left.schedule.scheduledFor || 0).getTime() - new Date(right.schedule.scheduledFor || 0).getTime())
    .slice(0, 8);
  const underperforming = pipeline.items.filter((item) => item.stage === 'underperforming').slice(0, 6);
  const recentPublished = pipeline.items
    .filter((item) => item.stage === 'published')
    .sort((left, right) => new Date(right.schedule.publishedAt || 0).getTime() - new Date(left.schedule.publishedAt || 0).getTime())
    .slice(0, 6);

  return {
    topOpportunitiesToday: opportunities.slice(0, 6),
    needsReview,
    readyToScheduleOrPublish: readyToAct,
    upcomingScheduledContent: upcoming,
    recentPerformanceSnapshot: recentPublished.map((item) => ({
      id: item.id,
      title: item.title,
      stage: item.stage,
      performanceScore: item.analyticsSummary.performanceScore,
      clicks: item.analyticsSummary.clicks,
      signups: item.analyticsSummary.signups
    })),
    underperforming,
    systemHealth
  };
};
