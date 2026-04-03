import { AnalyticsModel } from '../../db/models/Analytics';
import { AssetModel } from '../../db/models/Asset';
import { EventModel } from '../../db/models/Event';
import { PostModel } from '../../db/models/Post';
import { normalizeMediaStatus } from '../../utils/mediaStatus';
import { ReferralModel } from '../../db/models/Referral';
import { toAssetUrl, toMediaUrl } from '../../utils/publicPaths';

const calculatePerformanceScore = (analytics?: {
  clicks?: number;
  signups?: number;
  deposits?: number;
  engagement?: {
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    impressions?: number;
  } | null;
} | null): number => {
  if (!analytics) {
    return 0;
  }

  const engagement = analytics.engagement ?? {};

  return (
    (analytics.clicks ?? 0) * 1.5 +
    (analytics.signups ?? 0) * 6 +
    (analytics.deposits ?? 0) * 8 +
    (engagement.likes ?? 0) +
    (engagement.comments ?? 0) * 2 +
    (engagement.shares ?? 0) * 3 +
    (engagement.saves ?? 0) * 2.5
  );
};

const serializePost = (post: any, analytics?: any) => ({
  id: String(post._id),
  event: post.eventId
    ? {
        id: String(post.eventId._id ?? post.eventId),
        eventType: post.eventId.eventType,
        playerId: post.eventId.playerId,
        amount: post.eventId.amount,
        turns: post.eventId.turns,
        streak: post.eventId.streak,
        tableAmount: post.eventId.tableAmount,
        status: post.eventId.status,
        source: post.eventId.source,
        createdAt: post.eventId.createdAt
      }
    : null,
  platforms: post.platforms ?? [],
  caption: post.caption ?? '',
  captionOptions: post.captionOptions ?? [],
  hook: post.hook ?? '',
  hashtags: post.hashtags ?? [],
  cta: post.cta ?? '',
  overlayText: post.overlayText ?? '',
  aiMetadata: post.aiMetadata ?? {},
  media: {
    status: normalizeMediaStatus(post.media?.status),
    imagePath: post.media?.imagePath ?? null,
    videoPath: post.media?.videoPath ?? null,
    imageUrl: toMediaUrl(post.media?.imagePath),
    videoUrl: toMediaUrl(post.media?.videoPath)
  },
  schedule: {
    status: post.schedule?.status ?? 'draft',
    scheduledFor: post.schedule?.scheduledFor ?? null,
    publishedAt: post.schedule?.publishedAt ?? null,
    lastAttemptAt: post.schedule?.lastAttemptAt ?? null,
    providerResponse: post.schedule?.providerResponse ?? {},
    errorMessage: post.schedule?.errorMessage ?? null
  },
  assets: (post.assetIds ?? []).map((asset: any) => ({
    id: String(asset._id ?? asset),
    kind: asset.kind,
    title: asset.title ?? '',
    tags: asset.tags ?? [],
    editorStatus: asset.editorStatus ?? 'original',
    originalUrl: toAssetUrl(asset.originalPath),
    editedUrl: toAssetUrl(asset.editedPath),
    preferredUrl: toAssetUrl(asset.editedPath || asset.originalPath)
  })),
  analytics: analytics
    ? {
        id: String(analytics._id),
        clicks: analytics.clicks ?? 0,
        signups: analytics.signups ?? 0,
        deposits: analytics.deposits ?? 0,
        engagement: analytics.engagement ?? {
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          impressions: 0
        },
        latestPlatformMetrics: analytics.latestPlatformMetrics ?? {},
        performanceScore: calculatePerformanceScore(analytics)
      }
    : null,
  createdAt: post.createdAt,
  updatedAt: post.updatedAt
});

export const listPosts = async (input?: { limit?: number; status?: string }) => {
  const query = input?.status ? { 'schedule.status': input.status } : {};
  const limit = input?.limit ?? 50;

  const posts = await PostModel.find(query)
    .populate('eventId')
    .populate('assetIds')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const analyticsDocs = await AnalyticsModel.find({
    postId: { $in: posts.map((post) => post._id) }
  }).lean();

  const analyticsByPostId = new Map(analyticsDocs.map((analytics) => [String(analytics.postId), analytics]));

  return posts.map((post) => serializePost(post, analyticsByPostId.get(String(post._id))));
};

export const getPostById = async (postId: string) => {
  const post = await PostModel.findById(postId).populate('eventId').populate('assetIds').lean();
  if (!post) {
    return null;
  }

  const analytics = await AnalyticsModel.findOne({ postId: post._id }).lean();
  return serializePost(post, analytics);
};

export const listRecentEvents = async (limit = 25) => {
  const events = await EventModel.find().sort({ createdAt: -1 }).limit(limit).lean();
  return events.map((event) => ({
    id: String(event._id),
    eventType: event.eventType,
    playerId: event.playerId,
    amount: event.amount,
    turns: event.turns,
    streak: event.streak,
    tableAmount: event.tableAmount,
    status: event.status,
    source: event.source,
    metadata: event.metadata ?? {},
    createdAt: event.createdAt
  }));
};

export const listReferrals = async () => {
  const referrals = await ReferralModel.find().sort({ createdAt: -1 }).lean();
  return referrals.map((referral) => ({
    id: String(referral._id),
    ownerUserId: referral.ownerUserId,
    code: referral.code,
    walletCreditsAwarded: referral.walletCreditsAwarded,
    inviteCount: referral.invites.length,
    rewardedCount: referral.invites.filter((invite) => invite.status === 'rewarded').length,
    invites: referral.invites,
    createdAt: referral.createdAt,
    updatedAt: referral.updatedAt
  }));
};

export const getDashboardSummary = async () => {
  const [posts, events, referrals, analyticsDocs, assets, totalAssets] = await Promise.all([
    listPosts({ limit: 8 }),
    listRecentEvents(8),
    listReferrals(),
    AnalyticsModel.find().sort({ updatedAt: -1 }).lean(),
    AssetModel.find().sort({ createdAt: -1 }).limit(8).lean(),
    AssetModel.countDocuments()
  ]);

  const totals = analyticsDocs.reduce(
    (accumulator, analytics) => {
      accumulator.clicks += analytics.clicks ?? 0;
      accumulator.signups += analytics.signups ?? 0;
      accumulator.deposits += analytics.deposits ?? 0;
      accumulator.engagement +=
        (analytics.engagement?.likes ?? 0) +
        (analytics.engagement?.comments ?? 0) +
        (analytics.engagement?.shares ?? 0) +
        (analytics.engagement?.saves ?? 0);
      return accumulator;
    },
    {
      clicks: 0,
      signups: 0,
      deposits: 0,
      engagement: 0
    }
  );

  const pipeline = posts.reduce(
    (accumulator, post) => {
      accumulator[post.schedule.status] = (accumulator[post.schedule.status] ?? 0) + 1;
      return accumulator;
    },
    {} as Record<string, number>
  );

  return {
    headline: {
      totalPosts: posts.length,
      totalEvents: events.length,
      totalReferrals: referrals.length,
      totalWalletCreditsAwarded: referrals.reduce((total, referral) => total + referral.walletCreditsAwarded, 0),
      totalAssets
    },
    totals,
    pipeline,
    latestPosts: posts,
    recentEvents: events,
    topReferrals: referrals.slice(0, 5),
    recentAssets: assets.map((asset) => ({
      id: String(asset._id),
      kind: asset.kind,
      title: asset.title ?? '',
      tags: asset.tags ?? [],
      editorStatus: asset.editorStatus,
      originalUrl: toAssetUrl(asset.originalPath),
      editedUrl: toAssetUrl(asset.editedPath),
      preferredUrl: toAssetUrl(asset.editedPath || asset.originalPath),
      createdAt: asset.createdAt
    }))
  };
};
