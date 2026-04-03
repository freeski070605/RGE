export const getImplementationSpec = () => ({
  system: {
    name: 'ReemGrowth Engine Operator Assistant',
    workflow: [
      'Detect live gameplay opportunities',
      'Recommend the best angle, format, and timing',
      'Create a unified content item with brief and variants',
      'Approve or adjust in one review flow',
      'Publish or schedule with media health guardrails',
      'Learn from performance feedback and strategy signals'
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
      fields: ['signalIds', 'ideaType', 'opportunityType', 'headline', 'whyItMatters', 'recommendedContentAngle', 'recommendedFormat', 'recommendedPlatforms', 'urgency', 'confidenceScore', 'estimatedValue', 'status']
    },
    {
      collection: 'content_items',
      fields: ['sourceOpportunityId', 'sourceSignalIds', 'title', 'opportunityType', 'strategyAngle', 'recommendedFormat', 'recommendedPlatforms', 'operatorMode', 'stage', 'briefId', 'selectedVariantId', 'publishingJobIds', 'analyticsSummary', 'schedule']
    },
    {
      collection: 'creative_briefs',
      fields: ['contentIdeaId', 'contentItemId', 'objective', 'audience', 'platform', 'format', 'tone', 'hookDirection', 'cta', 'assetIds', 'generationPrompt', 'status']
    },
    {
      collection: 'content_variants',
      fields: ['creativeBriefId', 'contentItemId', 'variantLabel', 'hook', 'caption', 'hashtags', 'overlayText', 'cta', 'hookStyle', 'assetIds', 'media', 'status']
    },
    {
      collection: 'publishing_jobs',
      fields: ['contentVariantId', 'contentItemId', 'platform', 'scheduledFor', 'publishedAt', 'status', 'captionSnapshot', 'mediaSnapshot', 'providerResponse']
    },
    {
      collection: 'performance_insights',
      fields: ['publishingJobId', 'contentVariantId', 'platform', 'clicks', 'signups', 'deposits', 'likes', 'comments', 'shares', 'saves', 'impressions', 'hookStyle', 'contentType', 'assetType', 'performanceScore']
    }
  ],
  apiRoutes: [
    'GET /api/health',
    'GET /api/dashboard',
    'GET /api/command-center',
    'GET /api/opportunities',
    'POST /api/opportunities/:id/create-content-item',
    'GET /api/pipeline',
    'GET /api/content-items/:id',
    'POST /api/content-items/:id/generate-copy',
    'POST /api/content-items/:id/generate-media',
    'POST /api/content-items/:id/approve',
    'POST /api/content-items/:id/schedule',
    'POST /api/content-items/:id/publish-now',
    'POST /api/content-items/:id/archive',
    'GET /api/calendar',
    'GET /api/performance',
    'GET /api/library',
    'GET /api/growth-loops',
    'GET /api/system-health',
    'GET /api/media/diagnostics',
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
    'Command Center',
    'Opportunities',
    'Pipeline',
    'Calendar',
    'Performance',
    'Library',
    'Growth Loops',
    'Settings'
  ],
  workerFlow: [
    'backend /api/rge/feed -> intelligence queue -> sync player stats, leaderboards, signals, and ranked opportunities',
    'opportunity -> content item -> brief -> variants -> selected review object',
    'content item media request -> media queue -> render image and video assets with persisted status and diagnostics',
    'schedule or publish request -> scheduler queue -> execute live publishing jobs with guardrails',
    'performance tracking -> insights -> strategy snapshot and recommendation loop'
  ]
});
