import { AnalyticsModel } from '../../db/models/Analytics';
import { PostModel } from '../../db/models/Post';

type StrategySnapshot = {
  instructions: string;
  winningHooks: string[];
  winningHashtags: string[];
  summary: {
    averageEngagementScore: number;
    reviewedPosts: number;
  };
};

const scorePost = (analytics: {
  clicks: number;
  signups: number;
  deposits: number;
  engagement?: { likes: number; comments: number; shares: number; saves: number } | null;
}): number => {
  const engagement = analytics.engagement ?? {
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0
  };

  return (
  analytics.clicks * 1.5 +
  analytics.signups * 6 +
  analytics.deposits * 8 +
  engagement.likes * 1 +
  engagement.comments * 2 +
  engagement.shares * 3 +
  engagement.saves * 2.5
  );
};

export const getStrategySnapshot = async (): Promise<StrategySnapshot> => {
  const analyticsDocs = await AnalyticsModel.find().lean();

  if (analyticsDocs.length === 0) {
    return {
      instructions:
        'Lead with visible wins, short punchy hooks, and direct calls to action tailored for card-game momentum.',
      winningHooks: [],
      winningHashtags: [],
      summary: {
        averageEngagementScore: 0,
        reviewedPosts: 0
      }
    };
  }

  const scored = analyticsDocs.map((analytics) => ({
    analytics,
    score: scorePost(analytics)
  }));

  scored.sort((left, right) => right.score - left.score);

  const topAnalytics = scored.slice(0, 5).map((entry) => entry.analytics);
  const posts = await PostModel.find({
    _id: { $in: topAnalytics.map((entry) => entry.postId) }
  }).lean();

  const postById = new Map(posts.map((post) => [String(post._id), post]));
  const hookCounts = new Map<string, number>();
  const hashtagCounts = new Map<string, number>();

  topAnalytics.forEach((analytics) => {
    const post = postById.get(String(analytics.postId));
    if (!post) {
      return;
    }

    if (post.hook) {
      hookCounts.set(post.hook, (hookCounts.get(post.hook) ?? 0) + 1);
    }

    post.hashtags.forEach((hashtag: string) => {
      hashtagCounts.set(hashtag, (hashtagCounts.get(hashtag) ?? 0) + 1);
    });
  });

  const winningHooks = [...hookCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([hook]) => hook);

  const winningHashtags = [...hashtagCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([hashtag]) => hashtag);

  const averageEngagementScore = scored.reduce((total, entry) => total + entry.score, 0) / scored.length;

  const instructionParts = [
    'Use one bold, momentum-heavy hook in the first line.',
    'Keep captions short enough for social skim reading.',
    winningHooks.length > 0 ? `Mirror the energy of hooks like: ${winningHooks.join(' | ')}` : '',
    winningHashtags.length > 0 ? `Reuse proven hashtags when relevant: ${winningHashtags.join(' ')}` : ''
  ].filter(Boolean);

  return {
    instructions: instructionParts.join(' '),
    winningHooks,
    winningHashtags,
    summary: {
      averageEngagementScore: Number(averageEngagementScore.toFixed(2)),
      reviewedPosts: scored.length
    }
  };
};
