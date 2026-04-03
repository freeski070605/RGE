import { AnalyticsModel } from '../../db/models/Analytics';
import { PostModel } from '../../db/models/Post';
import { getStrategySnapshot } from '../strategy/strategyService';

export const initializeAnalyticsForPost = async (postId: string) => {
  return AnalyticsModel.findOneAndUpdate(
    { postId },
    {
      $setOnInsert: {
        postId,
        clicks: 0,
        signups: 0,
        deposits: 0,
        engagement: {
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          impressions: 0
        }
      }
    },
    { new: true, upsert: true }
  );
};

export const recordAnalyticsDelta = async (input: {
  postId: string;
  clicks?: number;
  signups?: number;
  deposits?: number;
  engagement?: {
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    impressions?: number;
  };
}) => {
  const inc = {
    clicks: input.clicks ?? 0,
    signups: input.signups ?? 0,
    deposits: input.deposits ?? 0,
    'engagement.likes': input.engagement?.likes ?? 0,
    'engagement.comments': input.engagement?.comments ?? 0,
    'engagement.shares': input.engagement?.shares ?? 0,
    'engagement.saves': input.engagement?.saves ?? 0,
    'engagement.impressions': input.engagement?.impressions ?? 0
  };

  return AnalyticsModel.findOneAndUpdate(
    { postId: input.postId },
    {
      $inc: inc
    },
    { new: true, upsert: true }
  );
};

export const getAnalyticsDashboard = async () => {
  const [analyticsDocs, recentPosts, strategy] = await Promise.all([
    AnalyticsModel.find().sort({ updatedAt: -1 }).lean(),
    PostModel.find().sort({ createdAt: -1 }).limit(10).lean(),
    getStrategySnapshot()
  ]);

  const totals = analyticsDocs.reduce(
    (accumulator, analytics) => {
      const engagement = analytics.engagement ?? {
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        impressions: 0
      };

      accumulator.clicks += analytics.clicks;
      accumulator.signups += analytics.signups;
      accumulator.deposits += analytics.deposits;
      accumulator.likes += engagement.likes;
      accumulator.comments += engagement.comments;
      accumulator.shares += engagement.shares;
      accumulator.saves += engagement.saves;
      accumulator.impressions += engagement.impressions;
      return accumulator;
    },
    {
      clicks: 0,
      signups: 0,
      deposits: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      impressions: 0
    }
  );

  return {
    totals,
    recentPosts,
    analytics: analyticsDocs,
    strategy
  };
};
