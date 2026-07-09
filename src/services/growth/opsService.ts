import OpenAI from 'openai';
import { enqueueMediaCreation, schedulePublishingJobExecution } from '../../queues';
import { env } from '../../config/env';
import { AssetModel } from '../../db/models/Asset';
import { ContentIdeaModel } from '../../db/models/ContentIdea';
import { ContentVariantModel } from '../../db/models/ContentVariant';
import { CreativeBriefModel } from '../../db/models/CreativeBrief';
import { GameSignalModel } from '../../db/models/GameSignal';
import { PerformanceInsightModel } from '../../db/models/PerformanceInsight';
import { PublishingJobModel } from '../../db/models/PublishingJob';
import { AppError } from '../../utils/errors';
import { isCompletedMediaStatus, normalizeMediaStatus } from '../../utils/mediaStatus';
import { getDurationMs, logError, logInfo, logWarn } from '../../utils/structuredLogger';
import { toAbsoluteAppUrl, toAssetUrl, toMediaUrl } from '../../utils/publicPaths';
import { renderCreativeImage, renderCreativeVideo } from '../media-engine/mediaEngine';
import { publishToSocialPlatform } from '../social/socialPublisher';
import { assertStoredArtifact } from '../storage/storageService';

const openaiClient = env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      organization: env.OPENAI_ORGANIZATION || undefined
    })
  : null;

const scorePerformance = (input: {
  clicks: number;
  signups: number;
  deposits: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}) =>
  Number(
    (
      input.clicks * 1.5 +
      input.signups * 6 +
      input.deposits * 8 +
      input.likes * 1 +
      input.comments * 2 +
      input.shares * 3 +
      input.saves * 2.5
    ).toFixed(2)
  );

const safeJson = <T>(input: string): T | null => {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
};

const normalizeHashtags = (hashtags: string[]) =>
  hashtags
    .map((hashtag) => hashtag.trim())
    .filter(Boolean)
    .map((hashtag) => (hashtag.startsWith('#') ? hashtag : `#${hashtag}`))
    .slice(0, 8);

const resolveMediaPreviewUrl = (input: {
  remoteUrl?: string | null;
  publicUrl?: string | null;
  filePath?: string | null;
}) => input.remoteUrl || input.publicUrl || toMediaUrl(input.filePath) || null;

const resolvePublishableMediaUrl = (input: {
  remoteUrl?: string | null;
  publicUrl?: string | null;
  filePath?: string | null;
}) => {
  if (input.remoteUrl) {
    return input.remoteUrl;
  }

  if (input.publicUrl) {
    return toAbsoluteAppUrl(input.publicUrl);
  }

  return toAbsoluteAppUrl(toMediaUrl(input.filePath));
};

const serializeIdea = (idea: any, signalCount = 0) => ({
  id: String(idea._id),
  ideaType: idea.ideaType,
  opportunityType: idea.opportunityType ?? idea.ideaType,
  goal: idea.goal,
  audience: idea.audience,
  platformRecommendation: idea.platformRecommendation ?? [],
  recommendedPlatforms: idea.recommendedPlatforms ?? idea.platformRecommendation ?? [],
  priorityScore: idea.priorityScore ?? 0,
  headline: idea.headline,
  reason: idea.reason,
  whyItMatters: idea.whyItMatters ?? idea.reason ?? '',
  hookAngle: idea.hookAngle,
  recommendedContentAngle: idea.recommendedContentAngle ?? idea.hookAngle ?? '',
  recommendedFormat: idea.recommendedFormat ?? '',
  ctaAngle: idea.ctaAngle,
  urgency: idea.urgency ?? 'medium',
  confidenceScore: idea.confidenceScore ?? 0,
  estimatedValue: idea.estimatedValue ?? 0,
  whyThisRecommendation: idea.whyThisRecommendation ?? idea.reason ?? '',
  linkedPlayers: idea.linkedPlayers ?? [],
  linkedAssets: (idea.linkedAssets ?? []).map((asset: any) => String(asset._id ?? asset)),
  campaignTags: idea.campaignTags ?? [],
  operatorStatus: idea.operatorStatus ?? 'open',
  savedForLaterAt: idea.savedForLaterAt ?? null,
  dismissedAt: idea.dismissedAt ?? null,
  signalCount,
  status: idea.status,
  createdAt: idea.createdAt,
  updatedAt: idea.updatedAt
});

const serializeBrief = (brief: any, idea?: any, assets?: any[]) => ({
  id: String(brief._id),
  contentIdeaId: String(brief.contentIdeaId?._id ?? brief.contentIdeaId),
  ideaHeadline: idea?.headline ?? brief.contentIdeaId?.headline ?? '',
  objective: brief.objective,
  audience: brief.audience,
  platform: brief.platform,
  format: brief.format,
  tone: brief.tone,
  hookDirection: brief.hookDirection,
  cta: brief.cta,
  requiredAssetKinds: brief.requiredAssetKinds ?? [],
  assetIds: (brief.assetIds ?? []).map((asset: any) => String(asset._id ?? asset)),
  assets:
    assets?.map((asset) => ({
      id: String(asset._id),
      kind: asset.kind,
      title: asset.title ?? '',
      preferredUrl: toAssetUrl(asset.editedPath || asset.originalPath)
    })) ?? [],
  notes: brief.notes ?? [],
  generationPrompt: brief.generationPrompt ?? '',
  status: brief.status,
  createdAt: brief.createdAt,
  updatedAt: brief.updatedAt
});

const serializeVariant = (variant: any, brief?: any, idea?: any, assets?: any[]) => ({
  id: String(variant._id),
  contentItemId: variant.contentItemId ? String(variant.contentItemId) : null,
  creativeBriefId: String(variant.creativeBriefId?._id ?? variant.creativeBriefId),
  variantLabel: variant.variantLabel,
  hook: variant.hook,
  caption: variant.caption,
  hashtags: variant.hashtags ?? [],
  overlayText: variant.overlayText,
  cta: variant.cta,
  tone: variant.tone,
  hookStyle: variant.hookStyle,
  media: {
    status: normalizeMediaStatus(variant.media?.status),
    imagePath: variant.media?.imagePath ?? null,
    videoPath: variant.media?.videoPath ?? null,
    imageUrl: resolveMediaPreviewUrl({
      remoteUrl: variant.media?.imageRemoteUrl,
      publicUrl: variant.media?.imagePublicUrl,
      filePath: variant.media?.imagePath
    }),
    videoUrl: resolveMediaPreviewUrl({
      remoteUrl: variant.media?.videoRemoteUrl,
      publicUrl: variant.media?.videoPublicUrl,
      filePath: variant.media?.videoPath
    }),
    errorMessage: variant.media?.errorMessage ?? null,
    jobId: variant.media?.jobId ?? null,
    lastQueuedAt: variant.media?.lastQueuedAt ?? null,
    lastStartedAt: variant.media?.lastStartedAt ?? null,
    lastFinishedAt: variant.media?.lastFinishedAt ?? null
  },
  assetIds: (variant.assetIds ?? []).map((asset: any) => String(asset._id ?? asset)),
  assets:
    assets?.map((asset) => ({
      id: String(asset._id),
      kind: asset.kind,
      title: asset.title ?? '',
      preferredUrl: toAssetUrl(asset.editedPath || asset.originalPath)
    })) ?? [],
  brief: brief
    ? {
        id: String(brief._id),
        platform: brief.platform,
        format: brief.format,
        tone: brief.tone,
        objective: brief.objective,
        ideaHeadline: idea?.headline ?? ''
      }
    : null,
  aiMetadata: variant.aiMetadata ?? {},
  status: variant.status,
  createdAt: variant.createdAt,
  updatedAt: variant.updatedAt
});

const serializePublishingJob = (job: any, variant?: any, insight?: any) => ({
  id: String(job._id),
  contentItemId: job.contentItemId ? String(job.contentItemId) : null,
  contentVariantId: String(job.contentVariantId?._id ?? job.contentVariantId),
  platform: job.platform,
  scheduledFor: job.scheduledFor ?? null,
  publishedAt: job.publishedAt ?? null,
  status: job.status,
  captionSnapshot: job.captionSnapshot ?? '',
  mediaSnapshot: {
    imageUrl: resolveMediaPreviewUrl({
      remoteUrl: job.mediaSnapshot?.imageRemoteUrl,
      publicUrl: job.mediaSnapshot?.imagePublicUrl,
      filePath: job.mediaSnapshot?.imagePath
    }),
    videoUrl: resolveMediaPreviewUrl({
      remoteUrl: job.mediaSnapshot?.videoRemoteUrl,
      publicUrl: job.mediaSnapshot?.videoPublicUrl,
      filePath: job.mediaSnapshot?.videoPath
    })
  },
  providerResponse: job.providerResponse ?? {},
  errorMessage: job.errorMessage ?? null,
  variant: variant
    ? {
        id: String(variant._id),
        variantLabel: variant.variantLabel,
        hook: variant.hook
      }
    : null,
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
    : null,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt
});

export const getGrowthStrategySnapshot = async () => {
  const insights = await PerformanceInsightModel.find().sort({ performanceScore: -1 }).limit(12).lean();

  if (!insights.length) {
    return {
      instructions:
        'Prioritize big payouts, reem moments, leaderboards, and strong first-line hooks tied to visible game outcomes.',
      winningHookStyles: [],
      winningContentTypes: [],
      winningAssetTypes: []
    };
  }

  const countValues = (values: string[]) => {
    const map = new Map<string, number>();
    values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
    return [...map.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([value]) => value);
  };

  const winningHookStyles = countValues(insights.map((item) => item.hookStyle || ''));
  const winningContentTypes = countValues(insights.map((item) => item.contentType || ''));
  const winningAssetTypes = countValues(insights.map((item) => item.assetType || ''));

  return {
    instructions: [
      'Lead with a visible result in the first line.',
      winningHookStyles.length ? `Lean into hook styles like ${winningHookStyles.join(', ')}.` : '',
      winningContentTypes.length ? `Top content types lately: ${winningContentTypes.join(', ')}.` : '',
      winningAssetTypes.length ? `Best asset mix lately: ${winningAssetTypes.join(', ')}.` : ''
    ]
      .filter(Boolean)
      .join(' '),
    winningHookStyles,
    winningContentTypes,
    winningAssetTypes
  };
};

export const listContentIdeas = async (limit = 40) => {
  const ideas = await ContentIdeaModel.find()
    .sort({ priorityScore: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  return ideas.map((idea: any) => serializeIdea(idea, (idea.signalIds ?? []).length));
};

export const createBriefFromIdea = async (input: {
  ideaId: string;
  platform?: string;
  format?: string;
  tone?: string;
  objective?: string;
  assetIds?: string[];
  notes?: string[];
}) => {
  const idea = await ContentIdeaModel.findById(input.ideaId);
  if (!idea) {
    throw new AppError('Content idea not found', 404);
  }

  const strategy = await getGrowthStrategySnapshot();
  const assetIds = input.assetIds?.length ? input.assetIds : idea.linkedAssets.map((asset) => String(asset));

  const brief = await CreativeBriefModel.create({
    contentIdeaId: idea._id,
    objective: input.objective || `${idea.goal} through ${idea.ideaType} content`,
    audience: idea.audience,
    platform: input.platform || idea.recommendedPlatforms?.[0] || idea.platformRecommendation[0] || 'instagram',
    format: input.format || idea.recommendedFormat || (idea.ideaType === 'leaderboard' ? 'carousel' : 'reel'),
    tone: input.tone || (idea.goal === 'conversion' ? 'competitive and persuasive' : 'hype and social-first'),
    hookDirection: idea.recommendedContentAngle || idea.hookAngle,
    cta: idea.ctaAngle,
    requiredAssetKinds: ['image', 'video'],
    assetIds,
    notes: input.notes?.length ? input.notes : [idea.reason],
    generationPrompt: `${idea.headline}. ${idea.hookAngle} ${idea.ctaAngle} ${strategy.instructions}`.trim(),
    status: 'approved'
  });

  idea.status = 'briefed';
  await idea.save();

  const assets = assetIds.length ? await AssetModel.find({ _id: { $in: assetIds } }).lean() : [];
  return serializeBrief(brief.toObject(), idea.toObject(), assets);
};

export const listCreativeBriefs = async (limit = 30) => {
  const briefs = await CreativeBriefModel.find()
    .populate('contentIdeaId')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const assetIds = briefs.flatMap((brief: any) => (brief.assetIds ?? []).map((asset: any) => String(asset)));
  const assets = assetIds.length ? await AssetModel.find({ _id: { $in: assetIds } }).lean() : [];
  const assetById = new Map(assets.map((asset) => [String(asset._id), asset]));

  return briefs.map((brief: any) =>
    serializeBrief(
      brief,
      brief.contentIdeaId,
      (brief.assetIds ?? []).map((asset: any) => assetById.get(String(asset))).filter(Boolean)
    )
  );
};

type VariantDraft = {
  label: string;
  hook: string;
  caption: string;
  hashtags: string[];
  overlayText: string;
  cta: string;
  tone: string;
  hookStyle: string;
};

const buildFallbackVariants = (input: {
  headline: string;
  platform: string;
  format: string;
  tone: string;
  objective: string;
  hookDirection: string;
  cta: string;
  count: number;
}): VariantDraft[] => {
  const defaults: VariantDraft[] = [
    {
      label: 'Variant A',
      hook: `${input.headline}. The table felt it immediately.`,
      caption: `Momentum flipped fast on ReemTeam. ${input.objective} with a ${input.tone} delivery that makes the outcome obvious from the first line.`,
      hashtags: ['#ReemTeam', '#BigWin', '#GamingMoments', '#CardGame'],
      overlayText: 'Table Heat',
      cta: input.cta,
      tone: input.tone,
      hookStyle: 'momentum'
    },
    {
      label: 'Variant B',
      hook: `${input.headline}. Proof that the board changes in one move.`,
      caption: `This one is built for ${input.platform}. Lead with the result, back it up with the stakes, then bring the audience into the next table.`,
      hashtags: ['#ReemTeam', '#Reem', '#WinStreak', '#PlayNow'],
      overlayText: 'Proof On The Board',
      cta: input.cta,
      tone: input.tone,
      hookStyle: 'social-proof'
    },
    {
      label: 'Variant C',
      hook: `${input.headline}. Comment if you would stay in this hand.`,
      caption: `A community-forward cut for ${input.format}. ${input.hookDirection} Keep the ending punchy and invite reactions.`,
      hashtags: ['#ReemTeam', '#CardTable', '#GameNight', '#Community'],
      overlayText: 'Would You Fold?',
      cta: input.cta,
      tone: input.tone,
      hookStyle: 'community'
    }
  ];

  return defaults.slice(0, input.count).map((variant) => ({
    ...variant,
    hashtags: normalizeHashtags(variant.hashtags)
  }));
};

const generateVariantsWithOpenAI = async (input: {
  headline: string;
  platform: string;
  format: string;
  tone: string;
  objective: string;
  hookDirection: string;
  cta: string;
  notes: string[];
  count: number;
  strategy: string;
}): Promise<VariantDraft[]> => {
  if (!openaiClient) {
    return buildFallbackVariants(input);
  }

  const response = await openaiClient.responses.create({
    model: env.OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'You are ReemGrowth Engine. Generate social-first content variants for a gaming marketing team. Keep copy concise, punchy, and platform-native.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Create ${input.count} content variants as JSON. Brief headline: ${input.headline}. Platform: ${input.platform}. Format: ${input.format}. Tone: ${input.tone}. Objective: ${input.objective}. Hook direction: ${input.hookDirection}. CTA: ${input.cta}. Notes: ${input.notes.join(
              ' | '
            )}. Strategy: ${input.strategy}. Return JSON with key variants containing ${input.count} items, each with label, hook, caption, hashtags, overlayText, cta, tone, hookStyle.`
          }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_object'
      }
    }
  } as never);

  const parsed = safeJson<{ variants: VariantDraft[] }>(response.output_text);
  if (!parsed?.variants?.length) {
    return buildFallbackVariants(input);
  }

  return parsed.variants.slice(0, input.count).map((variant, index) => ({
    label: variant.label || `Variant ${String.fromCharCode(65 + index)}`,
    hook: variant.hook,
    caption: variant.caption,
    hashtags: normalizeHashtags(variant.hashtags ?? []),
    overlayText: variant.overlayText || variant.hook,
    cta: variant.cta || input.cta,
    tone: variant.tone || input.tone,
    hookStyle: variant.hookStyle || 'momentum'
  }));
};

export const generateVariantsForBrief = async (briefId: string, count = 3) => {
  const brief = await CreativeBriefModel.findById(briefId).populate('contentIdeaId');
  if (!brief) {
    throw new AppError('Creative brief not found', 404);
  }

  const idea = brief.contentIdeaId as any;
  const strategy = await getGrowthStrategySnapshot();
  const variants = await generateVariantsWithOpenAI({
    headline: idea?.headline || 'ReemTeam moment',
    platform: brief.platform,
    format: brief.format,
    tone: brief.tone,
    objective: brief.objective,
    hookDirection: brief.hookDirection,
    cta: brief.cta,
    notes: brief.notes ?? [],
    count,
    strategy: strategy.instructions
  });

  await ContentVariantModel.updateMany(
    {
      creativeBriefId: brief._id,
      status: { $ne: 'archived' }
    },
    {
      $set: {
        status: 'archived'
      }
    }
  );
  const docs = await ContentVariantModel.insertMany(
    variants.map((variant) => ({
      creativeBriefId: brief._id,
      variantLabel: variant.label,
      hook: variant.hook,
      caption: variant.caption,
      hashtags: variant.hashtags,
      overlayText: variant.overlayText,
      cta: variant.cta,
      tone: variant.tone,
      hookStyle: variant.hookStyle,
      assetIds: brief.assetIds,
      aiMetadata: {
        model: openaiClient ? env.OPENAI_MODEL : 'deterministic-fallback',
        promptVersion: 'v2',
        strategyNotes: strategy.winningHookStyles.concat(strategy.winningContentTypes)
      },
      status: 'draft'
    }))
  );

  brief.status = 'variants_generated';
  await brief.save();
  if (idea) {
    await ContentIdeaModel.findByIdAndUpdate(idea._id, { status: 'variant_ready' });
  }

  const assetIds = brief.assetIds.map((asset: any) => String(asset));
  const assets = assetIds.length ? await AssetModel.find({ _id: { $in: assetIds } }).lean() : [];

  return docs.map((doc) => serializeVariant(doc.toObject(), brief.toObject(), idea?.toObject?.() ?? idea, assets));
};

export const listContentVariants = async (limit = 40) => {
  const variants = await ContentVariantModel.find()
    .populate({
      path: 'creativeBriefId',
      populate: {
        path: 'contentIdeaId'
      }
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const assetIds = variants.flatMap((variant: any) => (variant.assetIds ?? []).map((asset: any) => String(asset)));
  const assets = assetIds.length ? await AssetModel.find({ _id: { $in: assetIds } }).lean() : [];
  const assetById = new Map(assets.map((asset) => [String(asset._id), asset]));

  return variants.map((variant: any) => {
    const brief = variant.creativeBriefId;
    const idea = brief?.contentIdeaId;
    return serializeVariant(
      variant,
      brief,
      idea,
      (variant.assetIds ?? []).map((asset: any) => assetById.get(String(asset))).filter(Boolean)
    );
  });
};

const getAssetPathsForVariant = async (variant: any, brief: any, idea: any) => {
  const assetIds = [
    ...(variant.assetIds ?? []).map((asset: any) => String(asset)),
    ...(brief?.assetIds ?? []).map((asset: any) => String(asset)),
    ...(idea?.linkedAssets ?? []).map((asset: any) => String(asset))
  ];

  const uniqueAssetIds = [...new Set(assetIds)];
  if (!uniqueAssetIds.length) {
    return {
      assets: [],
      imagePath: null as string | null,
      videoPath: null as string | null
    };
  }

  const assets = await AssetModel.find({ _id: { $in: uniqueAssetIds } }).lean();
  const preferredImage = assets.find((asset) => asset.kind === 'image' && (asset.editedPath || asset.originalPath));
  const preferredVideo = assets.find((asset) => asset.kind === 'video' && (asset.editedPath || asset.originalPath));

  return {
    assets,
    imagePath: preferredImage ? preferredImage.editedPath || preferredImage.originalPath : null,
    videoPath: preferredVideo ? preferredVideo.editedPath || preferredVideo.originalPath : null
  };
};

export const markVariantMediaQueued = async (variantId: string, jobId?: string | null) => {
  const variant = await ContentVariantModel.findById(variantId);
  if (!variant) {
    return null;
  }

  variant.media = {
    ...(variant.media ?? {}),
    status: 'queued',
    jobId: jobId ?? variant.media?.jobId,
    errorMessage: undefined,
    lastQueuedAt: new Date()
  } as never;
  await variant.save();
  return variant;
};

export const markVariantMediaProcessing = async (variantId: string, jobId?: string | null) => {
  const variant = await ContentVariantModel.findById(variantId);
  if (!variant) {
    return null;
  }

  variant.media = {
    ...(variant.media ?? {}),
    status: 'processing',
    jobId: jobId ?? variant.media?.jobId,
    errorMessage: undefined,
    lastStartedAt: new Date()
  } as never;
  await variant.save();
  return variant;
};

export const markVariantMediaFailed = async (variantId: string, message: string, jobId?: string | null) => {
  const variant = await ContentVariantModel.findById(variantId);
  if (!variant) {
    return null;
  }

  variant.media = {
    ...(variant.media ?? {}),
    status: 'failed',
    jobId: jobId ?? variant.media?.jobId,
    errorMessage: message,
    lastFinishedAt: new Date()
  } as never;
  await variant.save();
  return variant;
};

export const createMediaForVariant = async (variantId: string) => {
  const startedAt = Date.now();
  const variant = await ContentVariantModel.findById(variantId).populate({
    path: 'creativeBriefId',
    populate: {
      path: 'contentIdeaId'
    }
  });

  if (!variant) {
    throw new AppError('Content variant not found', 404);
  }

  const brief = variant.creativeBriefId as any;
  const idea = brief?.contentIdeaId as any;
  const { assets, imagePath: preferredImagePath, videoPath: preferredVideoPath } = await getAssetPathsForVariant(
    variant,
    brief,
    idea
  );

  logInfo({
    area: 'media',
    action: 'render-variant-media',
    status: 'started',
    variantId: String(variant._id),
    contentItemId: variant.contentItemId ? String(variant.contentItemId) : null,
    message: 'Starting variant media generation'
  });

  const image = await renderCreativeImage({
    id: `variant-${String(variant._id)}`,
    hook: variant.hook,
    caption: variant.caption,
    overlayText: variant.overlayText || variant.hook,
    hashtags: variant.hashtags ?? [],
    backgroundImagePath: preferredImagePath
  });
  await assertStoredArtifact({
    localPath: image.localPath,
    publicUrl: image.publicUrl,
    label: `Variant ${variant._id} image`
  });

  let video:
    | Awaited<ReturnType<typeof renderCreativeVideo>>
    | undefined;
  if (env.ENABLE_VIDEO_GENERATION) {
    try {
      video = await renderCreativeVideo({
        imagePath: image.localPath,
        id: `variant-${String(variant._id)}`,
        sourceVideoPath: preferredVideoPath
      });
      await assertStoredArtifact({
        localPath: video.localPath,
        publicUrl: video.publicUrl,
        label: `Variant ${variant._id} video`
      });
    } catch (error) {
      logWarn({
        area: 'media',
        action: 'render-variant-video',
        status: 'warning',
        variantId: String(variant._id),
        contentItemId: variant.contentItemId ? String(variant.contentItemId) : null,
        durationMs: getDurationMs(startedAt),
        error: error instanceof Error ? error.message : 'Video generation failed',
        message: 'Video generation failed; image output remains available'
      });
    }
  }

  variant.media = {
    ...(variant.media ?? {}),
    status: 'completed',
    imagePath: image.localPath,
    videoPath: video?.localPath,
    imagePublicUrl: image.publicUrl,
    videoPublicUrl: video?.publicUrl,
    imageRemoteUrl: image.remoteUrl ?? undefined,
    videoRemoteUrl: video?.remoteUrl ?? undefined,
    errorMessage: undefined,
    lastFinishedAt: new Date()
  } as never;
  variant.status = 'ready';
  await variant.save();

  logInfo({
    area: 'media',
    action: 'render-variant-media',
    status: 'completed',
    variantId: String(variant._id),
    contentItemId: variant.contentItemId ? String(variant.contentItemId) : null,
    durationMs: getDurationMs(startedAt),
    message: 'Variant media generation completed'
  });

  return serializeVariant(variant.toObject(), brief?.toObject?.() ?? brief, idea?.toObject?.() ?? idea, assets);
};

export const queueMediaForVariant = async (variantId: string) => {
  let jobId = '';
  try {
    const job = await enqueueMediaCreation({
      targetType: 'variant',
      variantId
    });
    jobId = String(job.id);
  } catch (error) {
    if (env.isProduction) {
      throw error;
    }

    jobId = `inline-${variantId}`;
    logWarn({
      area: 'media',
      action: 'queue-variant-media',
      status: 'warning',
      variantId,
      error: error instanceof Error ? error.message : 'Media queue unavailable',
      message: 'Media queue unavailable; rendering inline for local HQ development'
    });
  }

  await markVariantMediaQueued(variantId, jobId);

  if (!env.isProduction && env.NODE_ENV === 'development') {
    await markVariantMediaProcessing(variantId, jobId);
    await createMediaForVariant(variantId);
  }

  return {
    id: jobId
  };
};

const ensurePublishingJobInsight = async (job: any, variant: any, brief: any, idea: any) => {
  return PerformanceInsightModel.findOneAndUpdate(
    { publishingJobId: job._id },
    {
      $setOnInsert: {
        publishingJobId: job._id,
        contentVariantId: variant._id,
        platform: job.platform,
        clicks: 0,
        signups: 0,
        deposits: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        impressions: 0,
        hookStyle: variant.hookStyle || '',
        contentType: idea?.ideaType || '',
        assetType: variant.media?.videoPath ? 'video' : variant.media?.imagePath ? 'image' : 'none',
        variantLabel: variant.variantLabel,
        performanceScore: 0
      }
    },
    { upsert: true, new: true }
  );
};

export const scheduleVariantPublishing = async (input: {
  variantId: string;
  scheduledFor: string;
  platforms?: string[];
}) => {
  const variant = await ContentVariantModel.findById(input.variantId).populate({
    path: 'creativeBriefId',
    populate: {
      path: 'contentIdeaId'
    }
  });

  if (!variant) {
    throw new AppError('Content variant not found', 404);
  }

  if (!isCompletedMediaStatus(variant.media?.status) || (!variant.media?.imagePath && !variant.media?.videoPath)) {
    throw new AppError('Create media before scheduling the variant', 409);
  }

  const brief = variant.creativeBriefId as any;
  const idea = brief?.contentIdeaId as any;
  const platforms = input.platforms?.length ? input.platforms : [brief?.platform || 'instagram'];
  const scheduledForDate = new Date(input.scheduledFor);

  if (Number.isNaN(scheduledForDate.getTime())) {
    throw new AppError('Invalid scheduledFor value', 400);
  }

  const jobs = [];
  for (const platform of platforms) {
    const job = await PublishingJobModel.findOneAndUpdate(
      {
        contentVariantId: variant._id,
        platform
      },
      {
        $set: {
          contentVariantId: variant._id,
          contentItemId: variant.contentItemId,
          platform,
          scheduledFor: scheduledForDate,
          status: 'scheduled',
          captionSnapshot: `${variant.hook}\n\n${variant.caption}\n\n${(variant.hashtags ?? []).join(' ')}`.trim(),
          mediaSnapshot: {
            imagePath: variant.media?.imagePath,
            videoPath: variant.media?.videoPath,
            imagePublicUrl: variant.media?.imagePublicUrl,
            videoPublicUrl: variant.media?.videoPublicUrl,
            imageRemoteUrl: variant.media?.imageRemoteUrl,
            videoRemoteUrl: variant.media?.videoRemoteUrl
          },
          errorMessage: null
        }
      },
      { new: true, upsert: true }
    );

    await schedulePublishingJobExecution({
      targetType: 'publishing-job',
      publishingJobId: String(job._id),
      scheduledFor: scheduledForDate.toISOString()
    });

    await ensurePublishingJobInsight(job, variant, brief, idea);
    jobs.push(job);
  }

  variant.status = 'scheduled';
  await variant.save();
  await ContentIdeaModel.findByIdAndUpdate(idea?._id, { status: 'scheduled' });

  return jobs.map((job) => serializePublishingJob(job.toObject(), variant.toObject()));
};

export const executePublishingJob = async (publishingJobId: string) => {
  const startedAt = Date.now();
  const job = await PublishingJobModel.findById(publishingJobId).populate({
    path: 'contentVariantId',
    populate: {
      path: 'creativeBriefId',
      populate: {
        path: 'contentIdeaId'
      }
    }
  });

  if (!job) {
    throw new AppError('Publishing job not found', 404);
  }

  const variant = job.contentVariantId as any;
  const brief = variant?.creativeBriefId as any;
  const idea = brief?.contentIdeaId as any;
  if (!variant) {
    throw new AppError('Variant not found for publishing job', 404);
  }

  job.status = 'processing';
  await job.save();

  try {
    logInfo({
      area: 'publishing',
      action: 'execute-publishing-job',
      status: 'started',
      publishingJobId: String(job._id),
      contentItemId: job.contentItemId ? String(job.contentItemId) : null,
      variantId: variant ? String(variant._id) : null,
      message: 'Publishing job started'
    });

    const publishableMediaUrl =
      resolvePublishableMediaUrl({
        remoteUrl: job.mediaSnapshot?.videoRemoteUrl,
        publicUrl: job.mediaSnapshot?.videoPublicUrl,
        filePath: job.mediaSnapshot?.videoPath
      }) ||
      resolvePublishableMediaUrl({
        remoteUrl: job.mediaSnapshot?.imageRemoteUrl,
        publicUrl: job.mediaSnapshot?.imagePublicUrl,
        filePath: job.mediaSnapshot?.imagePath
      });

    const providerResponse = await publishToSocialPlatform({
      platform: job.platform,
      postId: String(job._id),
      caption: job.captionSnapshot,
      mediaUrl: publishableMediaUrl ?? undefined
    });

    job.status = 'published';
    job.publishedAt = new Date();
    job.providerResponse = providerResponse;
    job.errorMessage = undefined;
    await job.save();

    variant.status = 'published';
    await variant.save();
    await ContentIdeaModel.findByIdAndUpdate(idea?._id, { status: 'published' });

    const insight = await ensurePublishingJobInsight(job, variant, brief, idea);
    logInfo({
      area: 'publishing',
      action: 'execute-publishing-job',
      status: 'completed',
      publishingJobId: String(job._id),
      contentItemId: job.contentItemId ? String(job.contentItemId) : null,
      variantId: variant ? String(variant._id) : null,
      durationMs: getDurationMs(startedAt),
      message: 'Publishing job completed'
    });
    return serializePublishingJob(job.toObject(), variant.toObject(), insight.toObject());
  } catch (error) {
    job.status = 'failed';
    job.errorMessage = error instanceof Error ? error.message : 'Publishing failed';
    await job.save();
    logError({
      area: 'publishing',
      action: 'execute-publishing-job',
      status: 'failed',
      publishingJobId: String(job._id),
      contentItemId: job.contentItemId ? String(job.contentItemId) : null,
      variantId: variant ? String(variant._id) : null,
      durationMs: getDurationMs(startedAt),
      error: error instanceof Error ? error.message : 'Publishing failed',
      message: 'Publishing job failed'
    });
    throw error;
  }
};

export const publishVariantNow = async (variantId: string, platforms?: string[]) => {
  const scheduledJobs = await scheduleVariantPublishing({
    variantId,
    scheduledFor: new Date().toISOString(),
    platforms
  });

  return Promise.all(scheduledJobs.map((job) => executePublishingJob(job.id)));
};

export const listPublishingJobs = async (limit = 40) => {
  const jobs = await PublishingJobModel.find()
    .populate('contentVariantId')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const variantIds = jobs.map((job: any) => String(job.contentVariantId?._id ?? job.contentVariantId));
  const insights = await PerformanceInsightModel.find({
    publishingJobId: { $in: jobs.map((job: any) => job._id) }
  }).lean();

  const insightByJobId = new Map(insights.map((insight) => [String(insight.publishingJobId), insight]));
  const variantById = new Map(jobs.map((job: any) => [String(job.contentVariantId?._id ?? job.contentVariantId), job.contentVariantId]));

  return jobs.map((job: any) =>
    serializePublishingJob(job, variantById.get(String(job.contentVariantId?._id ?? job.contentVariantId)), insightByJobId.get(String(job._id)))
  );
};

export const recordPublishingJobMetrics = async (input: {
  publishingJobId: string;
  clicks?: number;
  signups?: number;
  deposits?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  impressions?: number;
}) => {
  const job = await PublishingJobModel.findById(input.publishingJobId).populate({
    path: 'contentVariantId',
    populate: {
      path: 'creativeBriefId',
      populate: {
        path: 'contentIdeaId'
      }
    }
  });

  if (!job) {
    throw new AppError('Publishing job not found', 404);
  }

  const variant = job.contentVariantId as any;
  const brief = variant?.creativeBriefId as any;
  const idea = brief?.contentIdeaId as any;
  const current =
    (await ensurePublishingJobInsight(job, variant, brief, idea)) ||
    (await PerformanceInsightModel.findOne({ publishingJobId: job._id }));

  if (!current) {
    throw new AppError('Failed to initialize performance insight', 500);
  }

  current.clicks += input.clicks ?? 0;
  current.signups += input.signups ?? 0;
  current.deposits += input.deposits ?? 0;
  current.likes += input.likes ?? 0;
  current.comments += input.comments ?? 0;
  current.shares += input.shares ?? 0;
  current.saves += input.saves ?? 0;
  current.impressions += input.impressions ?? 0;
  current.performanceScore = scorePerformance(current);
  await current.save();

  return serializePublishingJob(job.toObject(), variant?.toObject?.() ?? variant, current.toObject());
};

export const getInsightsDashboard = async () => {
  const [insights, jobs, ideas, strategy] = await Promise.all([
    PerformanceInsightModel.find().sort({ performanceScore: -1 }).lean(),
    PublishingJobModel.find().sort({ createdAt: -1 }).limit(12).lean(),
    ContentIdeaModel.find().sort({ priorityScore: -1 }).limit(8).lean(),
    getGrowthStrategySnapshot()
  ]);

  const totals = insights.reduce(
    (accumulator, insight) => {
      accumulator.clicks += insight.clicks;
      accumulator.signups += insight.signups;
      accumulator.deposits += insight.deposits;
      accumulator.likes += insight.likes;
      accumulator.comments += insight.comments;
      accumulator.shares += insight.shares;
      accumulator.saves += insight.saves;
      accumulator.impressions += insight.impressions;
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
    topJobs: jobs.map((job) => ({
      id: String(job._id),
      platform: job.platform,
      status: job.status,
      scheduledFor: job.scheduledFor,
      publishedAt: job.publishedAt
    })),
    topIdeas: ideas.map((idea) => serializeIdea(idea, (idea.signalIds ?? []).length)),
    strategy,
    bestPerformers: insights.slice(0, 8).map((insight) => ({
      id: String(insight._id),
      publishingJobId: String(insight.publishingJobId),
      platform: insight.platform,
      contentType: insight.contentType,
      assetType: insight.assetType,
      hookStyle: insight.hookStyle,
      performanceScore: insight.performanceScore
    }))
  };
};

export const getGrowthDashboard = async () => {
  const [ideas, briefs, variants, jobs, insights, strategy, signals] = await Promise.all([
    listContentIdeas(8),
    listCreativeBriefs(6),
    listContentVariants(8),
    listPublishingJobs(8),
    getInsightsDashboard(),
    getGrowthStrategySnapshot(),
    GameSignalModel.find().sort({ 'scores.overallPriorityScore': -1, occurredAt: -1 }).limit(8).lean()
  ]);

  return {
    headline: {
      totalIdeas: await ContentIdeaModel.countDocuments(),
      totalBriefs: await CreativeBriefModel.countDocuments(),
      totalVariants: await ContentVariantModel.countDocuments(),
      totalPublishingJobs: await PublishingJobModel.countDocuments()
    },
    strategy,
    todayQueue: ideas,
    signalInbox: signals.map((signal) => ({
      id: String(signal._id),
      signalType: signal.signalType,
      username: signal.username,
      priorityScore: signal.scores?.overallPriorityScore ?? 0,
      amount: signal.amount,
      occurredAt: signal.occurredAt,
      status: signal.status
    })),
    briefs,
    variants,
    publishingJobs: jobs,
    insights
  };
};
