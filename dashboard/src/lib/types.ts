export type OperatorRecord = {
  email: string;
  name: string;
};

export type OperatorSessionResponse = {
  authenticated: boolean;
  operator: OperatorRecord;
};

export type OperatorSettingsRecord = {
  operatorEmail: string;
  mode: 'autopilot' | 'assisted' | 'manual';
  approvedPlatforms: string[];
  approvedFormats: string[];
  avoidNarrativeRepeatHours: number;
  activeCampaign: string;
  updatedAt: string | null;
};

export type OpportunityRecord = {
  id: string;
  title: string;
  headline: string;
  opportunityType: string;
  whyItMatters: string;
  whyAmISeeingThis: string;
  recommendedContentAngle: string;
  recommendedFormat: string;
  recommendedPlatforms: string[];
  urgency: string;
  confidenceScore: number;
  estimatedValue: number;
  finalScore: number;
  scoreParts: Record<string, number>;
  penalties: Record<string, number>;
  explanation: {
    summary: string;
    indicators: string[];
    scoreBoosts: string[];
    penalties: string[];
    formatReason: string;
    timing: string;
  } | null;
  sourceIndicators: Array<{
    id: string;
    type: string;
    window: string;
    confidence: number;
    scoreParts: Record<string, number>;
    occurredAt: string;
  }>;
  freshness: string;
  sourceSignals: Array<{
    id: string;
    type: string;
    player: string;
    tableName: string;
    occurredAt: string;
    amount: number;
  }>;
  operatorStatus: string;
  contentItem: { id: string; stage: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentItemRecord = {
  id: string;
  title: string;
  opportunityType: string;
  whyItMatters: string;
  strategyAngle: string;
  recommendationWhy: string;
  hookDirection: string;
  recommendedFormat: string;
  recommendedPlatforms: string[];
  templateRecommendation: string;
  selectedVisualPreset: string;
  urgency: string;
  confidenceScore: number;
  estimatedValue: number;
  operatorMode: 'autopilot' | 'assisted' | 'manual';
  stage: string;
  stageLabel: string;
  needsAttention: boolean;
  reviewNotes: string[];
  createdBy: string;
  sourceOpportunity: {
    id: string;
    headline: string;
    whyItMatters: string;
    whyThisRecommendation: string;
  } | null;
  sourceSignals: Array<{
    id: string;
    signalType: string;
    playerId: string;
    username: string;
    tableName: string;
    amount: number;
    stake: number;
    occurredAt: string;
    scores: Record<string, number>;
  }>;
  brief: {
    id: string;
    platform: string;
    format: string;
    tone: string;
    objective: string;
    hookDirection: string;
    cta: string;
    notes: string[];
    createdAt: string;
    updatedAt: string;
  } | null;
  variants: Array<{
    id: string;
    variantLabel: string;
    hook: string;
    caption: string;
    hashtags: string[];
    overlayText: string;
    cta: string;
    tone: string;
    hookStyle: string;
    status: string;
    media: {
      status: string;
      imageUrl: string | null;
      videoUrl: string | null;
      imagePath: string | null;
      videoPath: string | null;
      errorMessage: string | null;
      lastFinishedAt: string | null;
    };
    createdAt: string;
    updatedAt: string;
  }>;
  selectedVariantId: string | null;
  selectedVariant: ContentItemRecord['variants'][number] | null;
  selectedAssets: Array<{
    id: string;
    kind: string;
    title: string;
    preferredUrl: string | null;
  }>;
  publishingJobs: Array<{
    id: string;
    platform: string;
    status: string;
    scheduledFor: string | null;
    publishedAt: string | null;
    errorMessage: string | null;
    mediaPreviewUrl: string | null;
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
  }>;
  schedule: {
    status: string;
    scheduledFor: string | null;
    publishedAt: string | null;
    bestTimeWindow: string | null;
    lastError: string | null;
  };
  analyticsSummary: {
    clicks: number;
    signups: number;
    deposits: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    impressions: number;
    performanceScore: number;
    baselineDelta: number;
    conversionInfluence: number;
    trend: string;
    updatedAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type PostRecord = {
  id: string;
  platforms: string[];
  hook: string;
  caption: string;
  media: {
    status: string;
  };
  schedule: {
    status: string;
  };
  event: {
    playerId?: string;
    eventType?: string;
  } | null;
  analytics: {
    performanceScore: number;
  } | null;
};

export type PipelineView = {
  columns: Array<{
    id: string;
    label: string;
    items: ContentItemRecord[];
  }>;
  items: ContentItemRecord[];
  counts: Record<string, number>;
};

export type CalendarView = {
  entries: Array<{
    id: string;
    title: string;
    platformBadges: string[];
    status: string;
    opportunityType: string;
    scheduledFor: string | null;
    publishedAt: string | null;
  }>;
  days: Array<{
    date: string;
    items: CalendarView['entries'];
  }>;
};

export type PerformanceView = {
  totals: {
    engagement: number;
    clicks: number;
    signups: number;
    deposits: number;
    conversionInfluence: number;
  };
  bestPerformers: ContentItemRecord[];
  underperforming: ContentItemRecord[];
  bestHooks: Array<{ label: string; count: number }>;
  bestFormats: Array<{ label: string; count: number }>;
  bestStoryTypes: Array<{ label: string; count: number }>;
  bestPublishWindows: Array<{ label: string; count: number }>;
  recommendations: {
    instructions: string;
    winningHookStyles: string[];
    winningContentTypes: string[];
    winningAssetTypes: string[];
  };
};

export type LibraryView = {
  assets: Array<{
    id: string;
    title: string;
    kind: string;
    tags: string[];
    editorStatus: string;
    preferredUrl: string | null;
  }>;
  visualPresets: Array<{ id: string; name: string; description: string }>;
  overlays: string[];
  templates: Array<{ id: string; name: string; description: string }>;
  hookPatterns: Array<{ id: string; hook: string }>;
  ctaTemplates: Array<{ id: string; cta: string }>;
  brandVoicePresets: Array<{ id: string; name: string }>;
  reusableCaptionComponents: string[];
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

export type GrowthLoopsView = {
  summary: {
    referralCodes: number;
    totalInvites: number;
    totalRewarded: number;
    totalWalletCreditsAwarded: number;
  };
  referrals: ReferralRecord[];
};

export type HealthBlock = {
  status: string;
  detail: string;
  error?: string;
  counts?: Record<string, number>;
  path?: string;
  backendApiBaseUrl?: string;
  ffmpegPath?: string;
};

export type SystemHealthView = {
  backendConnectivity: HealthBlock;
  intelligenceSync: HealthBlock & { lastSyncTime?: string | null };
  mongo: HealthBlock;
  redis: HealthBlock;
  workerHealth: Array<{
    workerName: string;
    queueName: string;
    status: string;
    lastHeartbeatAt: string;
  }>;
  mediaQueue: HealthBlock;
  publishingQueue: HealthBlock;
  assetsDirectory: HealthBlock;
  mediaOutputDirectory: HealthBlock;
  lastSyncTime: string | null;
  lastSuccessfulMediaRenderTime: string | null;
  mediaDiagnostics: MediaDiagnosticsView;
};

export type MediaDiagnosticsView = {
  queue: HealthBlock;
  processing: HealthBlock;
  output: HealthBlock;
  serving: HealthBlock;
  ffmpeg: HealthBlock;
  canvas: HealthBlock;
  outputDirectories: {
    media: HealthBlock;
    assets: HealthBlock;
  };
  queueLength: number;
  activeJobs: number;
  failedJobs: number;
  completedJobs: number;
  averageProcessingTimeMs: number | null;
  ffmpegAvailable: boolean;
  canvasAvailable: boolean;
  outputDirectoryWritable: boolean;
  assetDirectoryWritable: boolean;
  lastSuccess: string | null;
  lastFailure: {
    at: string | null;
    reason: string | null;
  };
};

export type WorkersStatusView = {
  summary: {
    status: 'ok' | 'error';
    okCount: number;
    total: number;
  };
  workers: {
    intelligence: WorkerStatusRecord;
    content: WorkerStatusRecord;
    media: WorkerStatusRecord;
    scheduler: WorkerStatusRecord;
  };
};

export type WorkerStatusRecord = {
  status: 'ok' | 'error';
  detail: string;
  workerName: string;
  queueName: string;
  lastHeartbeatAt: string | null;
  heartbeatStatus: string;
  metadata: Record<string, unknown>;
};

export type SystemIntegrityView = {
  backendConnection: 'ok' | 'error';
  mongo: 'ok' | 'error';
  redis: 'ok' | 'error';
  workers: {
    intelligence: 'ok' | 'error';
    content: 'ok' | 'error';
    media: 'ok' | 'error';
    scheduler: 'ok' | 'error';
  };
  mediaPipeline: {
    queue: 'ok' | 'error';
    processing: 'ok' | 'error';
    output: 'ok' | 'error';
    serving: 'ok' | 'error';
  };
  lastSuccessfulMediaJob: string | null;
  lastFailedMediaJob: string | null;
  lastSync: string | null;
  issues: Array<{
    code: string;
    severity: 'warning' | 'critical';
    summary: string;
    details?: string;
    entityType?: string;
    entityId?: string | null;
    action?: string;
    detectedAt: string;
  }>;
};

export type CommandCenterView = {
  topOpportunitiesToday: OpportunityRecord[];
  needsReview: ContentItemRecord[];
  readyToScheduleOrPublish: ContentItemRecord[];
  upcomingScheduledContent: ContentItemRecord[];
  recentPerformanceSnapshot: Array<{
    id: string;
    title: string;
    stage: string;
    performanceScore: number;
    clicks: number;
    signups: number;
  }>;
  underperforming: ContentItemRecord[];
  systemHealth: SystemHealthView;
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
