export const getImplementationSpec = () => ({
  system: {
    name: 'ReemGrowth Engine V2',
    workflow: [
      'Backend game intelligence feed',
      'RGE intelligence sync',
      'Signal scoring',
      'Content ideas',
      'Creative briefs',
      'Content variants',
      'Media rendering',
      'Publishing jobs',
      'Performance insights'
    ]
  },
  mongoSchemas: [
    {
      collection: 'player_stats_daily',
      fields: ['date', 'window', 'playerId', 'username', 'vipStatus', 'matchesPlayed', 'wins', 'reems', 'netPayout', 'biggestPayout', 'depositAmount', 'currentWinStreak', 'bestWinStreak']
    },
    {
      collection: 'leaderboard_snapshots',
      fields: ['metric', 'window', 'title', 'description', 'generatedAt', 'rankings']
    },
    {
      collection: 'game_signals',
      fields: ['signalType', 'sourceType', 'sourceId', 'playerId', 'tableId', 'matchId', 'window', 'scores', 'recommendedPlatforms', 'status']
    },
    {
      collection: 'content_ideas',
      fields: ['signalIds', 'ideaType', 'goal', 'audience', 'platformRecommendation', 'priorityScore', 'headline', 'reason', 'hookAngle', 'ctaAngle', 'status']
    },
    {
      collection: 'creative_briefs',
      fields: ['contentIdeaId', 'objective', 'audience', 'platform', 'format', 'tone', 'hookDirection', 'cta', 'assetIds', 'generationPrompt', 'status']
    },
    {
      collection: 'content_variants',
      fields: ['creativeBriefId', 'variantLabel', 'hook', 'caption', 'hashtags', 'overlayText', 'cta', 'hookStyle', 'assetIds', 'media', 'status']
    },
    {
      collection: 'publishing_jobs',
      fields: ['contentVariantId', 'platform', 'scheduledFor', 'publishedAt', 'status', 'captionSnapshot', 'mediaSnapshot', 'providerResponse']
    },
    {
      collection: 'performance_insights',
      fields: ['publishingJobId', 'contentVariantId', 'platform', 'clicks', 'signups', 'deposits', 'likes', 'comments', 'shares', 'saves', 'impressions', 'hookStyle', 'contentType', 'assetType', 'performanceScore']
    }
  ],
  apiRoutes: [
    'GET /api/health',
    'GET /api/dashboard',
    'GET /api/v2/spec',
    'POST /api/v2/intelligence/sync',
    'GET /api/v2/intelligence/overview',
    'GET /api/v2/player-snapshots',
    'GET /api/v2/leaderboards',
    'GET /api/v2/signals',
    'GET /api/v2/content-ideas',
    'POST /api/v2/content-ideas/:ideaId/briefs',
    'GET /api/v2/creative-briefs',
    'POST /api/v2/creative-briefs/:briefId/variants',
    'GET /api/v2/content-variants',
    'POST /api/v2/content-variants/:variantId/create-media',
    'POST /api/v2/content-variants/:variantId/schedule',
    'POST /api/v2/content-variants/:variantId/publish-now',
    'GET /api/v2/publishing-jobs',
    'POST /api/v2/publishing-jobs/:publishingJobId/track',
    'GET /api/v2/insights',
    'GET /api/v2/dashboard'
  ],
  dashboardScreens: [
    'Overview',
    'Today Queue',
    'Leaderboards',
    'Signal Inbox',
    'Brief Builder',
    'Variant Studio',
    'Publishing Calendar',
    'Insights',
    'Asset Studio',
    'Referrals'
  ],
  workerFlow: [
    'backend /api/rge/feed -> intelligence queue -> sync player stats, leaderboards, signals, and seed ideas',
    'approved idea -> create brief -> generate variants',
    'variant media request -> media queue -> render image and video assets',
    'schedule request -> scheduler queue -> publish live Instagram or X content at the scheduled time',
    'analytics tracking -> performance insights -> strategy snapshot for future brief and variant generation'
  ]
});
