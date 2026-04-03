import { Types } from 'mongoose';
import { env } from '../../config/env';
import { AssetModel } from '../../db/models/Asset';
import { ContentIdeaModel } from '../../db/models/ContentIdea';
import { ContentItemModel } from '../../db/models/ContentItem';
import { ContentVariantModel } from '../../db/models/ContentVariant';
import { CreativeBriefModel } from '../../db/models/CreativeBrief';
import { PerformanceInsightModel } from '../../db/models/PerformanceInsight';
import { PublishingJobModel } from '../../db/models/PublishingJob';
import {
  createBriefFromIdea,
  generateVariantsForBrief,
  publishVariantNow,
  queueMediaForVariant,
  scheduleVariantPublishing
} from '../growth/opsService';
import { getOperatorSettings } from './settingsService';
import { AppError } from '../../utils/errors';
import { toAssetUrl, toMediaUrl } from '../../utils/publicPaths';

const supportedStageOrder = [
  'new_opportunity',
  'draft_ready',
  'needs_review',
  'approved',
  'scheduled',
  'published',
  'underperforming',
  'archived',
  'wont_use'
] as const;

const stageLabelMap: Record<string, string> = {
  new_opportunity: 'New Opportunity',
  draft_ready: 'Draft Ready',
  needs_review: 'Needs Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  underperforming: 'Underperforming',
  archived: 'Archived',
  wont_use: "Won't Use"
};

const resolveMediaUrl = (media?: any, type: 'image' | 'video' = 'image') => {
  const remote = type === 'image' ? media?.imageRemoteUrl : media?.videoRemoteUrl;
  const publicUrl = type === 'image' ? media?.imagePublicUrl : media?.videoPublicUrl;
  const filePath = type === 'image' ? media?.imagePath : media?.videoPath;
  return remote || publicUrl || toMediaUrl(filePath);
};

const serializeSignal = (signal: any) => ({
  id: String(signal._id),
  signalType: signal.signalType,
  playerId: signal.playerId ?? '',
  username: signal.username ?? '',
  tableName: signal.tableName ?? '',
  amount: signal.amount ?? 0,
  stake: signal.stake ?? 0,
  occurredAt: signal.occurredAt,
  scores: signal.scores ?? {}
});

const serializeBrief = (brief: any) =>
  brief
    ? {
        id: String(brief._id),
        platform: brief.platform,
        format: brief.format,
        tone: brief.tone,
        objective: brief.objective,
        hookDirection: brief.hookDirection,
        cta: brief.cta,
        notes: brief.notes ?? [],
        createdAt: brief.createdAt,
        updatedAt: brief.updatedAt
      }
    : null;

const serializeVariant = (variant: any) =>
  variant
    ? {
        id: String(variant._id),
        variantLabel: variant.variantLabel,
        hook: variant.hook,
        caption: variant.caption,
        hashtags: variant.hashtags ?? [],
        overlayText: variant.overlayText ?? '',
        cta: variant.cta ?? '',
        tone: variant.tone ?? '',
        hookStyle: variant.hookStyle ?? '',
        status: variant.status,
        media: {
          status: variant.media?.status === 'ready' ? 'succeeded' : variant.media?.status ?? 'pending',
          imageUrl: resolveMediaUrl(variant.media, 'image'),
          videoUrl: resolveMediaUrl(variant.media, 'video'),
          imagePath: variant.media?.imagePath ?? null,
          videoPath: variant.media?.videoPath ?? null,
          errorMessage: variant.media?.errorMessage ?? null,
          lastFinishedAt: variant.media?.lastFinishedAt ?? null
        },
        createdAt: variant.createdAt,
        updatedAt: variant.updatedAt
      }
    : null;

const serializePublishingJob = (job: any, insight?: any) => ({
  id: String(job._id),
  platform: job.platform,
  status: job.status,
  scheduledFor: job.scheduledFor ?? null,
  publishedAt: job.publishedAt ?? null,
  errorMessage: job.errorMessage ?? null,
  mediaPreviewUrl:
    job.mediaSnapshot?.videoRemoteUrl ||
    job.mediaSnapshot?.videoPublicUrl ||
    toMediaUrl(job.mediaSnapshot?.videoPath) ||
    job.mediaSnapshot?.imageRemoteUrl ||
    job.mediaSnapshot?.imagePublicUrl ||
    toMediaUrl(job.mediaSnapshot?.imagePath),
  insight: insight
    ? {
        clicks: insight.clicks,
        signups: insight.signups,
        deposits: insight.deposits,
        likes: insight.likes,
        comments: insight.comments,
        shares: insight.shares,
        saves: insight.saves,
        impressions: insight.impressions,
        performanceScore: insight.performanceScore
      }
    : null
});

const calculatePerformanceSummary = (insights: any[]) => {
  const totals = insights.reduce(
    (accumulator, insight) => {
      accumulator.clicks += insight.clicks ?? 0;
      accumulator.signups += insight.signups ?? 0;
      accumulator.deposits += insight.deposits ?? 0;
      accumulator.likes += insight.likes ?? 0;
      accumulator.comments += insight.comments ?? 0;
      accumulator.shares += insight.shares ?? 0;
      accumulator.saves += insight.saves ?? 0;
      accumulator.impressions += insight.impressions ?? 0;
      accumulator.performanceScore += insight.performanceScore ?? 0;
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
      impressions: 0,
      performanceScore: 0
    }
  );

  const averageScore = insights.length ? totals.performanceScore / insights.length : 0;

  return {
    ...totals,
    performanceScore: Number(averageScore.toFixed(2)),
    baselineDelta: Number((averageScore - 35).toFixed(2)),
    conversionInfluence: Number((totals.signups * 4 + totals.clicks * 0.6 + totals.deposits * 2).toFixed(2)),
    trend: averageScore >= 60 ? 'winning' : averageScore <= 20 && insights.length ? 'underperforming' : 'stable',
    updatedAt: insights[0]?.updatedAt ?? null
  };
};

const deriveStage = (input: {
  currentStage: string;
  selectedVariant?: any | null;
  publishingJobs: any[];
  analyticsSummary: ReturnType<typeof calculatePerformanceSummary>;
  archivedAt?: Date | null;
  dismissedAt?: Date | null;
}) => {
  if (input.archivedAt) {
    return 'archived';
  }

  if (input.dismissedAt) {
    return 'wont_use';
  }

  if (input.analyticsSummary.trend === 'underperforming' && input.publishingJobs.some((job) => job.status === 'published')) {
    return 'underperforming';
  }

  if (input.publishingJobs.some((job) => job.status === 'published')) {
    return 'published';
  }

  if (input.publishingJobs.some((job) => job.status === 'scheduled')) {
    return 'scheduled';
  }

  if (input.currentStage === 'approved') {
    return 'approved';
  }

  if (input.selectedVariant?.media?.status === 'succeeded' || input.selectedVariant?.media?.status === 'ready') {
    return 'needs_review';
  }

  if (input.selectedVariant) {
    return 'draft_ready';
  }

  return input.currentStage || 'new_opportunity';
};

const chooseSelectedVariant = (variants: any[]) =>
  variants.find((variant) => variant.status === 'published') ||
  variants.find((variant) => variant.status === 'scheduled') ||
  variants.find((variant) => variant.media?.status === 'succeeded' || variant.media?.status === 'ready') ||
  variants[0] ||
  null;

const computeBestTimeWindow = (platforms: string[]) => {
  const primaryPlatform = platforms[0] || 'instagram';
  return primaryPlatform === 'story' ? 'Today 12:00 PM - 3:00 PM ET' : 'Today 6:00 PM - 9:00 PM ET';
};

const computeAutopilotSchedule = () => {
  const scheduledAt = new Date(Date.now() + env.AUTOPILOT_SCHEDULE_DELAY_MINUTES * 60 * 1000);
  scheduledAt.setMinutes(Math.ceil(scheduledAt.getMinutes() / 15) * 15, 0, 0);
  return scheduledAt.toISOString();
};

const attachLegacyContentItemLinks = async (input: {
  itemId: string;
  briefId?: string | null;
  variantIds?: string[];
  publishingJobIds?: string[];
}) => {
  const updates: Promise<any>[] = [];

  if (input.briefId) {
    updates.push(CreativeBriefModel.findByIdAndUpdate(input.briefId, { contentItemId: new Types.ObjectId(input.itemId) }));
  }

  if (input.variantIds?.length) {
    updates.push(
      ContentVariantModel.updateMany(
        { _id: { $in: input.variantIds.map((id) => new Types.ObjectId(id)) } },
        { $set: { contentItemId: new Types.ObjectId(input.itemId) } }
      )
    );
  }

  if (input.publishingJobIds?.length) {
    updates.push(
      PublishingJobModel.updateMany(
        { _id: { $in: input.publishingJobIds.map((id) => new Types.ObjectId(id)) } },
        { $set: { contentItemId: new Types.ObjectId(input.itemId) } }
      )
    );
  }

  await Promise.all(updates);
};

export const hydrateLegacyContentItems = async (limit = 24) => {
  const legacyIdeas = await ContentIdeaModel.find({
    status: { $in: ['briefed', 'variant_ready', 'scheduled', 'published'] },
    operatorStatus: { $ne: 'dismissed' }
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  if (!legacyIdeas.length) {
    return;
  }

  const existingItems = await ContentItemModel.find({
    sourceOpportunityId: { $in: legacyIdeas.map((idea) => idea._id) }
  })
    .select('sourceOpportunityId')
    .lean();
  const coveredIdeaIds = new Set(existingItems.map((item) => String(item.sourceOpportunityId)));

  for (const idea of legacyIdeas) {
    if (coveredIdeaIds.has(String(idea._id))) {
      continue;
    }

    const brief = await CreativeBriefModel.findOne({ contentIdeaId: idea._id }).sort({ updatedAt: -1 }).lean();
    const variants = brief ? await ContentVariantModel.find({ creativeBriefId: brief._id }).sort({ createdAt: 1 }).lean() : [];
    const selectedVariant = chooseSelectedVariant(variants);
    const publishingJobs = variants.length
      ? await PublishingJobModel.find({ contentVariantId: { $in: variants.map((variant) => variant._id) } }).lean()
      : [];
    const insights = publishingJobs.length
      ? await PerformanceInsightModel.find({ publishingJobId: { $in: publishingJobs.map((job) => job._id) } }).lean()
      : [];
    const analyticsSummary = calculatePerformanceSummary(
      insights.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
    );

    const item = await ContentItemModel.create({
      sourceOpportunityId: idea._id,
      sourceSignalIds: idea.signalIds ?? [],
      sourceEventIds: idea.sourceEventIds ?? [],
      title: idea.headline,
      opportunityType: idea.opportunityType ?? idea.ideaType,
      whyItMatters: idea.whyItMatters ?? idea.reason,
      strategyAngle: idea.recommendedContentAngle ?? idea.hookAngle,
      recommendationWhy: idea.whyThisRecommendation ?? idea.reason,
      hookDirection: idea.hookAngle,
      recommendedFormat: idea.recommendedFormat || 'reel',
      recommendedPlatforms: idea.recommendedPlatforms?.length ? idea.recommendedPlatforms : idea.platformRecommendation,
      templateRecommendation: 'Legacy Migration',
      urgency: idea.urgency ?? 'medium',
      confidenceScore: idea.confidenceScore ?? idea.priorityScore ?? 0,
      estimatedValue: idea.estimatedValue ?? idea.priorityScore ?? 0,
      stage: deriveStage({
        currentStage: idea.status === 'published' ? 'published' : idea.status === 'scheduled' ? 'scheduled' : 'draft_ready',
        selectedVariant,
        publishingJobs,
        analyticsSummary
      }),
      briefId: brief?._id,
      variantIds: variants.map((variant) => variant._id),
      selectedVariantId: selectedVariant?._id,
      publishingJobIds: publishingJobs.map((job) => job._id),
      analyticsSummary,
      schedule: {
        status: publishingJobs.some((job) => job.status === 'published')
          ? 'published'
          : publishingJobs.some((job) => job.status === 'scheduled')
            ? 'scheduled'
            : 'unscheduled',
        scheduledFor: publishingJobs.find((job) => job.scheduledFor)?.scheduledFor,
        publishedAt: publishingJobs.find((job) => job.publishedAt)?.publishedAt,
        bestTimeWindow: computeBestTimeWindow(idea.recommendedPlatforms?.length ? idea.recommendedPlatforms : idea.platformRecommendation),
        lastError: publishingJobs.find((job) => job.errorMessage)?.errorMessage
      },
      createdBy: 'migration',
      needsAttention: !publishingJobs.some((job) => job.status === 'published')
    });

    await attachLegacyContentItemLinks({
      itemId: String(item._id),
      briefId: brief ? String(brief._id) : null,
      variantIds: variants.map((variant) => String(variant._id)),
      publishingJobIds: publishingJobs.map((job) => String(job._id))
    });
  }
};

const loadContentItemContext = async (itemId: string) => {
  const item = await ContentItemModel.findById(itemId)
    .populate('sourceOpportunityId')
    .populate('sourceSignalIds')
    .populate('briefId')
    .lean();

  if (!item) {
    throw new AppError('Content item not found', 404);
  }

  const [variants, publishingJobs, assets] = await Promise.all([
    ContentVariantModel.find({ _id: { $in: item.variantIds ?? [] } }).sort({ createdAt: 1 }).lean(),
    PublishingJobModel.find({ _id: { $in: item.publishingJobIds ?? [] } }).sort({ scheduledFor: 1, createdAt: -1 }).lean(),
    AssetModel.find({ _id: { $in: item.selectedMediaAssetIds ?? [] } }).lean()
  ]);

  const insights = publishingJobs.length
    ? await PerformanceInsightModel.find({ publishingJobId: { $in: publishingJobs.map((job) => job._id) } }).lean()
    : [];
  const insightsByJobId = new Map(insights.map((insight) => [String(insight.publishingJobId), insight]));
  const selectedVariant =
    variants.find((variant) => String(variant._id) === String(item.selectedVariantId ?? '')) || chooseSelectedVariant(variants);
  const analyticsSummary = calculatePerformanceSummary(
    insights.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
  );

  return {
    item,
    opportunity: item.sourceOpportunityId as any,
    signals: (item.sourceSignalIds as any[]) ?? [],
    brief: item.briefId as any,
    variants,
    selectedVariant,
    publishingJobs,
    assets,
    insightsByJobId,
    analyticsSummary
  };
};

export const syncContentItemState = async (itemId: string) => {
  const context = await loadContentItemContext(itemId);
  const nextStage = deriveStage({
    currentStage: context.item.stage,
    selectedVariant: context.selectedVariant,
    publishingJobs: context.publishingJobs,
    analyticsSummary: context.analyticsSummary,
    archivedAt: context.item.archivedAt,
    dismissedAt: context.item.dismissedAt
  });

  const scheduledJob = context.publishingJobs.find((job) => job.status === 'scheduled');
  const publishedJob = context.publishingJobs.find((job) => job.status === 'published');
  const failedJob = context.publishingJobs.find((job) => job.status === 'failed');

  await ContentItemModel.findByIdAndUpdate(context.item._id, {
    $set: {
      stage: nextStage,
      analyticsSummary: context.analyticsSummary,
      schedule: {
        status: publishedJob ? 'published' : scheduledJob ? 'scheduled' : failedJob ? 'failed' : 'unscheduled',
        scheduledFor: scheduledJob?.scheduledFor ?? null,
        publishedAt: publishedJob?.publishedAt ?? null,
        bestTimeWindow: context.item.schedule?.bestTimeWindow || computeBestTimeWindow(context.item.recommendedPlatforms),
        lastError: failedJob?.errorMessage ?? context.selectedVariant?.media?.errorMessage ?? null
      },
      needsAttention:
        nextStage === 'needs_review' ||
        nextStage === 'underperforming' ||
        Boolean(context.selectedVariant?.media?.errorMessage) ||
        Boolean(failedJob?.errorMessage)
    }
  });
};

export const getContentItemById = async (itemId: string) => {
  await syncContentItemState(itemId);
  const context = await loadContentItemContext(itemId);

  return {
    id: String(context.item._id),
    title: context.item.title,
    opportunityType: context.item.opportunityType,
    whyItMatters: context.item.whyItMatters,
    strategyAngle: context.item.strategyAngle,
    recommendationWhy: context.item.recommendationWhy,
    hookDirection: context.item.hookDirection,
    recommendedFormat: context.item.recommendedFormat,
    recommendedPlatforms: context.item.recommendedPlatforms ?? [],
    templateRecommendation: context.item.templateRecommendation ?? '',
    selectedVisualPreset: context.item.selectedVisualPreset ?? 'Momentum Spotlight',
    urgency: context.item.urgency,
    confidenceScore: context.item.confidenceScore,
    estimatedValue: context.item.estimatedValue,
    operatorMode: context.item.operatorMode,
    stage: context.item.stage,
    stageLabel: stageLabelMap[context.item.stage] ?? context.item.stage,
    needsAttention: context.item.needsAttention,
    reviewNotes: context.item.reviewNotes ?? [],
    createdBy: context.item.createdBy,
    sourceOpportunity: context.opportunity
      ? {
          id: String(context.opportunity._id),
          headline: context.opportunity.headline,
          whyItMatters: context.opportunity.whyItMatters ?? context.opportunity.reason,
          whyThisRecommendation: context.opportunity.whyThisRecommendation ?? context.opportunity.reason
        }
      : null,
    sourceSignals: context.signals.map(serializeSignal),
    brief: serializeBrief(context.brief),
    variants: context.variants.map(serializeVariant),
    selectedVariantId: context.selectedVariant ? String(context.selectedVariant._id) : null,
    selectedVariant: serializeVariant(context.selectedVariant),
    selectedAssets: context.assets.map((asset) => ({
      id: String(asset._id),
      kind: asset.kind,
      title: asset.title,
      preferredUrl: toAssetUrl(asset.editedPath || asset.originalPath)
    })),
    publishingJobs: context.publishingJobs.map((job) =>
      serializePublishingJob(job, context.insightsByJobId.get(String(job._id)))
    ),
    schedule: {
      status: context.item.schedule?.status ?? 'unscheduled',
      scheduledFor: context.item.schedule?.scheduledFor ?? null,
      publishedAt: context.item.schedule?.publishedAt ?? null,
      bestTimeWindow: context.item.schedule?.bestTimeWindow ?? computeBestTimeWindow(context.item.recommendedPlatforms),
      lastError: context.item.schedule?.lastError ?? null
    },
    analyticsSummary: context.analyticsSummary,
    createdAt: context.item.createdAt,
    updatedAt: context.item.updatedAt
  };
};

export const listPipeline = async () => {
  await hydrateLegacyContentItems();
  const items = await ContentItemModel.find().sort({ updatedAt: -1 }).limit(120).lean();
  const serializedItems = await Promise.all(items.map((item) => getContentItemById(String(item._id))));

  const columns = supportedStageOrder
    .filter((stage) => !['archived', 'wont_use'].includes(stage))
    .map((stage) => ({
      id: stage,
      label: stageLabelMap[stage],
      items: serializedItems.filter((item) => item.stage === stage)
    }));

  return {
    columns,
    items: serializedItems,
    counts: Object.fromEntries(
      supportedStageOrder.map((stage) => [stage, serializedItems.filter((item) => item.stage === stage).length])
    )
  };
};

export const getCalendarView = async () => {
  const pipeline = await listPipeline();
  const entries = pipeline.items
    .filter((item) => item.schedule.scheduledFor || item.schedule.publishedAt)
    .map((item) => ({
      id: item.id,
      title: item.title,
      platformBadges: item.recommendedPlatforms,
      status: item.stage,
      opportunityType: item.opportunityType,
      scheduledFor: item.schedule.scheduledFor,
      publishedAt: item.schedule.publishedAt
    }))
    .sort((left, right) => {
      const leftDate = new Date(left.scheduledFor || left.publishedAt || 0).getTime();
      const rightDate = new Date(right.scheduledFor || right.publishedAt || 0).getTime();
      return leftDate - rightDate;
    });

  const groupedByDay = entries.reduce(
    (accumulator, entry) => {
      const key = new Date(entry.scheduledFor || entry.publishedAt || Date.now()).toISOString().slice(0, 10);
      accumulator[key] = accumulator[key] ?? [];
      accumulator[key].push(entry);
      return accumulator;
    },
    {} as Record<string, typeof entries>
  );

  return {
    entries,
    days: Object.entries(groupedByDay).map(([date, items]) => ({
      date,
      items
    }))
  };
};

const ensureSelectableVariant = async (itemId: string) => {
  const context = await loadContentItemContext(itemId);
  if (context.selectedVariant) {
    return context.selectedVariant;
  }

  if (!context.variants.length) {
    throw new AppError('Generate copy before selecting a variant', 409);
  }

  const fallback = context.variants[0];
  await ContentItemModel.findByIdAndUpdate(itemId, { $set: { selectedVariantId: fallback._id } });
  return fallback;
};

const validateSchedulingGuardrails = async (input: {
  item: any;
  settings: Awaited<ReturnType<typeof getOperatorSettings>>;
  selectedVariant: any;
}) => {
  if (!input.selectedVariant) {
    throw new AppError('Choose a selected variant before publishing', 409);
  }

  const selectedFormat = input.item.recommendedFormat;
  const requestedPlatforms = input.item.recommendedPlatforms ?? [];

  if (selectedFormat && !input.settings.approvedFormats.includes(selectedFormat)) {
    throw new AppError(`Format ${selectedFormat} is not approved for automated publishing`, 409);
  }

  if (requestedPlatforms.some((platform: string) => !input.settings.approvedPlatforms.includes(platform))) {
    throw new AppError('One or more target platforms are not approved in operator settings', 409);
  }

  const mediaStatus = input.selectedVariant.media?.status === 'ready' ? 'succeeded' : input.selectedVariant.media?.status;
  if (mediaStatus !== 'succeeded') {
    throw new AppError('Media must finish generating before the content item can be scheduled or published', 409);
  }

  const repeatCutoff = new Date(Date.now() - input.settings.avoidNarrativeRepeatHours * 60 * 60 * 1000);
  const recentSimilar = await ContentItemModel.countDocuments({
    _id: { $ne: input.item._id },
    opportunityType: input.item.opportunityType,
    createdAt: { $gte: repeatCutoff },
    stage: { $in: ['scheduled', 'published'] }
  });

  if (recentSimilar >= 2) {
    throw new AppError('Guardrail blocked this item because the same narrative ran too often recently', 409);
  }
};

export const createContentItemFromOpportunity = async (input: { opportunityId: string; operatorEmail: string }) => {
  const [idea, settings] = await Promise.all([
    ContentIdeaModel.findById(input.opportunityId),
    getOperatorSettings(input.operatorEmail)
  ]);

  if (!idea) {
    throw new AppError('Opportunity not found', 404);
  }

  if (idea.operatorStatus === 'dismissed') {
    throw new AppError('This opportunity was dismissed and cannot create a content item until restored', 409);
  }

  const existing = await ContentItemModel.findOne({
    sourceOpportunityId: idea._id,
    stage: { $nin: ['archived', 'wont_use'] }
  }).lean();
  if (existing) {
    return getContentItemById(String(existing._id));
  }

  const item = await ContentItemModel.create({
    sourceOpportunityId: idea._id,
    sourceSignalIds: idea.signalIds ?? [],
    sourceEventIds: idea.sourceEventIds ?? [],
    title: idea.headline,
    opportunityType: idea.opportunityType ?? idea.ideaType,
    whyItMatters: idea.whyItMatters ?? idea.reason,
    strategyAngle: idea.recommendedContentAngle ?? idea.hookAngle,
    recommendationWhy: idea.whyThisRecommendation ?? idea.reason,
    hookDirection: idea.hookAngle,
    recommendedFormat: idea.recommendedFormat || 'reel',
    recommendedPlatforms: idea.recommendedPlatforms?.length ? idea.recommendedPlatforms : idea.platformRecommendation,
    templateRecommendation: idea.recommendedFormat === 'carousel' ? 'Board Breakdown' : 'Momentum Spotlight',
    urgency: idea.urgency ?? 'medium',
    confidenceScore: idea.confidenceScore ?? idea.priorityScore ?? 0,
    estimatedValue: idea.estimatedValue ?? idea.priorityScore ?? 0,
    operatorMode: settings.mode,
    stage: settings.mode === 'manual' ? 'draft_ready' : settings.mode === 'autopilot' ? 'approved' : 'needs_review',
    selectedMediaAssetIds: idea.linkedAssets ?? [],
    schedule: {
      status: 'unscheduled',
      bestTimeWindow: computeBestTimeWindow(
        idea.recommendedPlatforms?.length ? idea.recommendedPlatforms : idea.platformRecommendation
      )
    },
    createdBy: input.operatorEmail,
    needsAttention: settings.mode !== 'autopilot'
  });

  const brief = await createBriefFromIdea({
    ideaId: input.opportunityId,
    platform: idea.recommendedPlatforms?.[0] || idea.platformRecommendation?.[0],
    format: idea.recommendedFormat || undefined,
    tone: settings.mode === 'manual' ? 'operator-guided and precise' : 'competitive and social-first',
    assetIds: (idea.linkedAssets ?? []).map((asset: any) => String(asset))
  });
  const variants = await generateVariantsForBrief(brief.id, settings.mode === 'manual' ? 2 : 3);
  const selectedVariantId = variants[0]?.id ?? null;

  await ContentItemModel.findByIdAndUpdate(item._id, {
    $set: {
      briefId: new Types.ObjectId(brief.id),
      variantIds: variants.map((variant) => new Types.ObjectId(variant.id)),
      selectedVariantId: selectedVariantId ? new Types.ObjectId(selectedVariantId) : undefined
    }
  });

  await attachLegacyContentItemLinks({
    itemId: String(item._id),
    briefId: brief.id,
    variantIds: variants.map((variant) => variant.id)
  });

  idea.operatorStatus = 'converted';
  await idea.save();

  if (selectedVariantId && settings.mode !== 'manual') {
    await queueMediaForVariant(selectedVariantId);
  }

  return getContentItemById(String(item._id));
};

export const generateContentItemCopy = async (input: { itemId: string; count?: number }) => {
  const item = await ContentItemModel.findById(input.itemId);
  if (!item) {
    throw new AppError('Content item not found', 404);
  }

  let briefId = item.briefId ? String(item.briefId) : '';
  if (!briefId) {
    const brief = await createBriefFromIdea({
      ideaId: String(item.sourceOpportunityId),
      platform: item.recommendedPlatforms[0],
      format: item.recommendedFormat
    });
    briefId = brief.id;
    item.briefId = new Types.ObjectId(brief.id) as never;
    await item.save();
    await attachLegacyContentItemLinks({
      itemId: String(item._id),
      briefId
    });
  }

  const variants = await generateVariantsForBrief(briefId, input.count ?? 3);
  const selectedVariantId = variants[0]?.id ?? null;

  item.variantIds = variants.map((variant) => new Types.ObjectId(variant.id)) as never;
  item.selectedVariantId = selectedVariantId ? (new Types.ObjectId(selectedVariantId) as never) : undefined;
  item.stage = item.operatorMode === 'manual' ? 'draft_ready' : item.operatorMode === 'autopilot' ? 'approved' : 'needs_review';
  item.needsAttention = item.operatorMode !== 'autopilot';
  await item.save();

  await attachLegacyContentItemLinks({
    itemId: String(item._id),
    variantIds: variants.map((variant) => variant.id)
  });

  return getContentItemById(String(item._id));
};

export const generateContentItemMedia = async (itemId: string) => {
  const item = await ContentItemModel.findById(itemId);
  if (!item) {
    throw new AppError('Content item not found', 404);
  }

  const selectedVariant = await ensureSelectableVariant(itemId);
  await queueMediaForVariant(String(selectedVariant._id));
  return getContentItemById(itemId);
};

export const approveContentItem = async (itemId: string) => {
  const item = await ContentItemModel.findByIdAndUpdate(
    itemId,
    {
      $set: {
        stage: 'approved',
        needsAttention: false
      }
    },
    { new: true }
  );

  if (!item) {
    throw new AppError('Content item not found', 404);
  }

  return getContentItemById(String(item._id));
};

export const saveContentItemDraft = async (itemId: string) => {
  const item = await ContentItemModel.findByIdAndUpdate(
    itemId,
    {
      $set: {
        stage: 'draft_ready',
        needsAttention: false
      }
    },
    { new: true }
  );

  if (!item) {
    throw new AppError('Content item not found', 404);
  }

  return getContentItemById(String(item._id));
};

export const selectContentItemVariant = async (input: { itemId: string; variantId: string }) => {
  const item = await ContentItemModel.findById(input.itemId);
  if (!item) {
    throw new AppError('Content item not found', 404);
  }

  const belongsToItem = item.variantIds.some((variantId) => String(variantId) === input.variantId);
  if (!belongsToItem) {
    throw new AppError('Variant does not belong to this content item', 400);
  }

  item.selectedVariantId = new Types.ObjectId(input.variantId) as never;
  item.needsAttention = true;
  await item.save();
  return getContentItemById(String(item._id));
};

export const selectContentItemVisualPreset = async (input: { itemId: string; preset: string }) => {
  const item = await ContentItemModel.findByIdAndUpdate(
    input.itemId,
    {
      $set: {
        selectedVisualPreset: input.preset
      }
    },
    { new: true }
  );

  if (!item) {
    throw new AppError('Content item not found', 404);
  }

  return getContentItemById(String(item._id));
};

export const scheduleContentItem = async (input: {
  itemId: string;
  scheduledFor: string;
  platforms?: string[];
  operatorEmail: string;
}) => {
  const [item, settings] = await Promise.all([
    ContentItemModel.findById(input.itemId),
    getOperatorSettings(input.operatorEmail)
  ]);
  if (!item) {
    throw new AppError('Content item not found', 404);
  }

  const selectedVariant = await ensureSelectableVariant(input.itemId);
  await validateSchedulingGuardrails({
    item,
    settings,
    selectedVariant
  });

  const jobs = await scheduleVariantPublishing({
    variantId: String(selectedVariant._id),
    scheduledFor: input.scheduledFor,
    platforms: input.platforms?.length ? input.platforms : item.recommendedPlatforms
  });

  item.stage = 'scheduled';
  item.publishingJobIds = jobs.map((job) => new Types.ObjectId(job.id)) as never;
  item.schedule = {
    status: 'scheduled',
    scheduledFor: new Date(input.scheduledFor),
    bestTimeWindow: item.schedule?.bestTimeWindow || computeBestTimeWindow(item.recommendedPlatforms)
  } as never;
  item.needsAttention = false;
  await item.save();

  await attachLegacyContentItemLinks({
    itemId: String(item._id),
    publishingJobIds: jobs.map((job) => job.id)
  });

  return getContentItemById(String(item._id));
};

export const publishContentItemNow = async (input: { itemId: string; operatorEmail: string }) => {
  const [item, settings] = await Promise.all([
    ContentItemModel.findById(input.itemId),
    getOperatorSettings(input.operatorEmail)
  ]);
  if (!item) {
    throw new AppError('Content item not found', 404);
  }

  const selectedVariant = await ensureSelectableVariant(input.itemId);
  await validateSchedulingGuardrails({
    item,
    settings,
    selectedVariant
  });

  const jobs = await publishVariantNow(String(selectedVariant._id), item.recommendedPlatforms);
  item.stage = 'published';
  item.publishingJobIds = jobs.map((job) => new Types.ObjectId(job.id)) as never;
  item.schedule = {
    status: 'published',
    publishedAt: new Date(),
    bestTimeWindow: item.schedule?.bestTimeWindow || computeBestTimeWindow(item.recommendedPlatforms)
  } as never;
  item.needsAttention = false;
  await item.save();

  await attachLegacyContentItemLinks({
    itemId: String(item._id),
    publishingJobIds: jobs.map((job) => job.id)
  });

  return getContentItemById(String(item._id));
};

export const archiveContentItem = async (input: { itemId: string; reason?: string }) => {
  const item = await ContentItemModel.findByIdAndUpdate(
    input.itemId,
    {
      $set: {
        stage: 'archived',
        archivedAt: new Date(),
        needsAttention: false
      },
      ...(input.reason ? { $push: { reviewNotes: input.reason } } : {})
    },
    { new: true }
  );

  if (!item) {
    throw new AppError('Content item not found', 404);
  }

  await ContentIdeaModel.findByIdAndUpdate(item.sourceOpportunityId, {
    $set: {
      operatorStatus: 'dismissed',
      dismissedAt: new Date(),
      status: 'archived'
    }
  });

  return getContentItemById(String(item._id));
};

export const saveOpportunityForLater = async (opportunityId: string) => {
  const opportunity = await ContentIdeaModel.findByIdAndUpdate(
    opportunityId,
    {
      $set: {
        operatorStatus: 'saved',
        savedForLaterAt: new Date()
      }
    },
    { new: true }
  );

  if (!opportunity) {
    throw new AppError('Opportunity not found', 404);
  }

  return opportunity;
};

export const dismissOpportunity = async (opportunityId: string) => {
  const opportunity = await ContentIdeaModel.findByIdAndUpdate(
    opportunityId,
    {
      $set: {
        operatorStatus: 'dismissed',
        dismissedAt: new Date(),
        status: 'archived'
      }
    },
    { new: true }
  );

  if (!opportunity) {
    throw new AppError('Opportunity not found', 404);
  }

  return opportunity;
};

export const maybeAutoScheduleContentItemFromVariant = async (variantId: string) => {
  const item = await ContentItemModel.findOne({
    $or: [{ selectedVariantId: new Types.ObjectId(variantId) }, { variantIds: new Types.ObjectId(variantId) }]
  });

  if (!item || item.operatorMode !== 'autopilot' || ['scheduled', 'published'].includes(item.stage)) {
    return null;
  }

  try {
    return await scheduleContentItem({
      itemId: String(item._id),
      scheduledFor: computeAutopilotSchedule(),
      operatorEmail: item.createdBy || 'system'
    });
  } catch (error) {
    await ContentItemModel.findByIdAndUpdate(item._id, {
      $set: {
        stage: 'needs_review',
        needsAttention: true
      },
      $push: {
        reviewNotes: error instanceof Error ? error.message : 'Autopilot scheduling failed'
      }
    });
    return null;
  }
};
