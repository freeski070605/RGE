export type OperatorRecord = {
  email: string;
  name: string;
};

export type OperatorSessionResponse = {
  authenticated: boolean;
  operator: OperatorRecord;
};

export type EventRecord = {
  id: string;
  eventType: string;
  playerId: string;
  amount: number;
  turns: number;
  streak: number;
  tableAmount: number;
  status: string;
  source: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type PostAnalytics = {
  id: string;
  clicks: number;
  signups: number;
  deposits: number;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    impressions: number;
  };
  latestPlatformMetrics: Record<string, unknown>;
  performanceScore: number;
};

export type PostRecord = {
  id: string;
  event: EventRecord | null;
  assets: AssetRecord[];
  platforms: string[];
  caption: string;
  captionOptions: string[];
  hook: string;
  hashtags: string[];
  cta: string;
  overlayText: string;
  aiMetadata: {
    model?: string;
    promptVersion?: string;
    strategyNotes?: string[];
  };
  media: {
    status: string;
    imagePath: string | null;
    videoPath: string | null;
    imageUrl: string | null;
    videoUrl: string | null;
  };
  schedule: {
    status: string;
    scheduledFor: string | null;
    publishedAt: string | null;
    lastAttemptAt: string | null;
    providerResponse: Record<string, unknown>;
    errorMessage: string | null;
  };
  analytics: PostAnalytics | null;
  createdAt: string;
  updatedAt: string;
};

export type AssetRecord = {
  id: string;
  originalName?: string;
  storedFilename?: string;
  kind: string;
  mimeType?: string;
  fileSize?: number;
  title: string;
  tags: string[];
  editorStatus: string;
  lastEditPreset?: string | null;
  lastEditOverlay?: string | null;
  originalUrl: string | null;
  editedUrl: string | null;
  preferredUrl: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
};

export type ReferralRecord = {
  id: string;
  ownerUserId: string;
  code: string;
  walletCreditsAwarded: number;
  inviteCount: number;
  rewardedCount: number;
  invites: Array<{
    invitedUserId: string;
    status: string;
    rewardCents: number;
    invitedAt: string;
    rewardedAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type DashboardSummary = {
  headline: {
    totalPosts: number;
    totalEvents: number;
    totalReferrals: number;
    totalWalletCreditsAwarded: number;
    totalAssets: number;
  };
  totals: {
    clicks: number;
    signups: number;
    deposits: number;
    engagement: number;
  };
  pipeline: Record<string, number>;
  latestPosts: PostRecord[];
  recentEvents: EventRecord[];
  topReferrals: ReferralRecord[];
  recentAssets: AssetRecord[];
};

export type AnalyticsDashboard = {
  totals: {
    clicks: number;
    signups: number;
    deposits: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    impressions: number;
  };
  recentPosts: PostRecord[];
  analytics: PostAnalytics[];
  strategy: {
    instructions: string;
    winningHooks: string[];
    winningHashtags: string[];
    summary: {
      averageEngagementScore: number;
      reviewedPosts: number;
    };
  };
};

export type PlayerSnapshotRecord = {
  id: string;
  date: string;
  window: '24h' | '7d' | '30d';
  playerId: string;
  username: string;
  vipStatus: string;
  matchesPlayed: number;
  wins: number;
  reems: number;
  netPayout: number;
  biggestPayout: number;
  depositAmount: number;
  currentWinStreak: number;
  bestWinStreak: number;
};

export type LeaderboardRecord = {
  id: string;
  metric: string;
  window: '24h' | '7d' | '30d';
  title: string;
  description: string;
  generatedAt: string;
  rankings: Array<{
    rank: number;
    playerId: string;
    username: string;
    value: number;
    secondaryValue?: number;
    metadata?: Record<string, unknown>;
  }>;
};

export type SignalRecord = {
  id: string;
  signalType: string;
  sourceType: string;
  sourceId: string;
  playerId?: string;
  username?: string;
  tableId?: string;
  tableName?: string;
  matchId?: string;
  mode?: string;
  stake?: number;
  amount?: number;
  occurredAt: string;
  window: '24h' | '7d' | '30d';
  metadata: Record<string, unknown>;
  scores: {
    noveltyScore: number;
    performancePotentialScore: number;
    brandFitScore: number;
    urgencyScore: number;
    overallPriorityScore: number;
  };
  recommendedPlatforms: string[];
  status: string;
};

export type ContentIdeaRecord = {
  id: string;
  ideaType: string;
  goal: string;
  audience: string;
  platformRecommendation: string[];
  priorityScore: number;
  headline: string;
  reason: string;
  hookAngle: string;
  ctaAngle: string;
  linkedPlayers: string[];
  linkedAssets: string[];
  campaignTags: string[];
  signalCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type CreativeBriefRecord = {
  id: string;
  contentIdeaId: string;
  ideaHeadline: string;
  objective: string;
  audience: string;
  platform: string;
  format: string;
  tone: string;
  hookDirection: string;
  cta: string;
  requiredAssetKinds: string[];
  assetIds: string[];
  assets: Array<{
    id: string;
    kind: string;
    title: string;
    preferredUrl: string | null;
  }>;
  notes: string[];
  generationPrompt: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ContentVariantRecord = {
  id: string;
  creativeBriefId: string;
  variantLabel: string;
  hook: string;
  caption: string;
  hashtags: string[];
  overlayText: string;
  cta: string;
  tone: string;
  hookStyle: string;
  media: {
    status: string;
    imagePath: string | null;
    videoPath: string | null;
    imageUrl: string | null;
    videoUrl: string | null;
  };
  assetIds: string[];
  assets: Array<{
    id: string;
    kind: string;
    title: string;
    preferredUrl: string | null;
  }>;
  brief: {
    id: string;
    platform: string;
    format: string;
    tone: string;
    objective: string;
    ideaHeadline: string;
  } | null;
  aiMetadata: {
    model?: string;
    promptVersion?: string;
    strategyNotes?: string[];
  };
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type PublishingJobRecord = {
  id: string;
  contentVariantId: string;
  platform: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  status: string;
  captionSnapshot: string;
  mediaSnapshot: {
    imageUrl: string | null;
    videoUrl: string | null;
  };
  providerResponse: Record<string, unknown>;
  errorMessage: string | null;
  variant: {
    id: string;
    variantLabel: string;
    hook: string;
  } | null;
  insight: {
    clicks: number;
    signups: number;
    deposits: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    impressions: number;
    performanceScore: number;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type GrowthInsightsDashboard = {
  totals: {
    clicks: number;
    signups: number;
    deposits: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    impressions: number;
  };
  topJobs: Array<{
    id: string;
    platform: string;
    status: string;
    scheduledFor: string | null;
    publishedAt: string | null;
  }>;
  topIdeas: ContentIdeaRecord[];
  strategy: {
    instructions: string;
    winningHookStyles: string[];
    winningContentTypes: string[];
    winningAssetTypes: string[];
  };
  bestPerformers: Array<{
    id: string;
    publishingJobId: string;
    platform: string;
    contentType: string;
    assetType: string;
    hookStyle: string;
    performanceScore: number;
  }>;
};

export type GrowthDashboard = {
  headline: {
    totalIdeas: number;
    totalBriefs: number;
    totalVariants: number;
    totalPublishingJobs: number;
  };
  strategy: {
    instructions: string;
    winningHookStyles: string[];
    winningContentTypes: string[];
    winningAssetTypes: string[];
  };
  todayQueue: ContentIdeaRecord[];
  signalInbox: Array<{
    id: string;
    signalType: string;
    username?: string;
    priorityScore: number;
    amount?: number;
    occurredAt: string;
    status: string;
  }>;
  briefs: CreativeBriefRecord[];
  variants: ContentVariantRecord[];
  publishingJobs: PublishingJobRecord[];
  insights: GrowthInsightsDashboard;
};

export type ImplementationSpec = {
  system: {
    name: string;
    workflow: string[];
  };
  mongoSchemas: Array<{
    collection: string;
    fields: string[];
  }>;
  apiRoutes: string[];
  dashboardScreens: string[];
  workerFlow: string[];
};
