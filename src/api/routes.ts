import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env';
import { requireAuthenticatedAccess, requireOperatorAccess } from '../middleware/auth';
import { enqueueContentGeneration, enqueueIntelligenceSync, enqueueMediaCreation } from '../queues';
import {
  attachOperatorSession,
  authenticateOperator,
  clearOperatorSession
} from '../services/auth/operatorAuthService';
import { getAnalyticsDashboard, recordAnalyticsDelta } from '../services/analytics/analyticsService';
import { attachAssetsToPost, autoEditAsset, createAssetRecord, listAssets } from '../services/assets/assetService';
import {
  getDashboardSummary,
  getPostById,
  listPosts,
  listRecentEvents,
  listReferrals
} from '../services/dashboard/dashboardService';
import {
  createBriefFromIdea,
  generateVariantsForBrief,
  getGrowthDashboard,
  getInsightsDashboard,
  listContentIdeas,
  listContentVariants,
  listCreativeBriefs,
  listPublishingJobs,
  publishVariantNow,
  queueMediaForVariant,
  recordPublishingJobMetrics,
  scheduleVariantPublishing
} from '../services/growth/opsService';
import { createEventAndDraftPost } from '../services/data-layer/eventService';
import {
  getIntelligenceOverview,
  listLeaderboards,
  listPlayerSnapshots,
  listSignals,
  syncGameIntelligence
} from '../services/intelligence/intelligenceService';
import { createReferralCode, recordReferralInvite, rewardReferralInvite } from '../services/referral/referralService';
import { publishPost, queuePostForPublishing } from '../services/scheduler/schedulerService';
import { getImplementationSpec } from '../services/spec/implementationSpecService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';

const router = Router();
const supportedUploadMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm'
]);
const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts, please try again later.'
  }
});
const upload = multer({
  storage: multer.diskStorage({
    destination: env.assetOriginalDir,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${path.extname(file.originalname)}`);
    }
  }),
  fileFilter: (_req, file, callback) => {
    if (!supportedUploadMimeTypes.has(file.mimetype)) {
      callback(new AppError(`Unsupported upload type: ${file.mimetype}`, 400));
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: env.UPLOAD_MAX_FILE_SIZE_BYTES
  }
});

const generateContentSchema = z.object({
  event: z.object({
    eventType: z.enum(['reem', 'win', 'streak', 'table_amount', 'deposit', 'signup', 'custom']),
    playerId: z.string().min(1),
    amount: z.number().optional(),
    turns: z.number().optional(),
    streak: z.number().optional(),
    tableAmount: z.number().optional(),
    source: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  }),
  platforms: z.array(z.string()).optional()
});

const createMediaSchema = z.object({
  postId: z.string().min(1)
});

const schedulePostSchema = z.object({
  postId: z.string().min(1),
  scheduledFor: z.string().min(1),
  platforms: z.array(z.string()).optional()
});

const referralSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    ownerUserId: z.string().min(1)
  }),
  z.object({
    action: z.literal('invite'),
    code: z.string().min(1),
    invitedUserId: z.string().min(1)
  }),
  z.object({
    action: z.literal('reward'),
    code: z.string().min(1),
    invitedUserId: z.string().min(1),
    rewardCents: z.number().optional()
  })
]);

const listPostsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
  status: z.string().optional()
});

const analyticsTrackSchema = z.object({
  postId: z.string().min(1),
  clicks: z.number().optional(),
  signups: z.number().optional(),
  deposits: z.number().optional(),
  engagement: z
    .object({
      likes: z.number().optional(),
      comments: z.number().optional(),
      shares: z.number().optional(),
      saves: z.number().optional(),
      impressions: z.number().optional()
    })
    .optional()
});

const assetEditSchema = z.object({
  preset: z.enum(['square', 'story', 'reel']).optional(),
  overlayText: z.string().optional()
});

const attachAssetsSchema = z.object({
  assetIds: z.array(z.string().min(1)).min(1)
});

const syncIntelligenceSchema = z.object({
  days: z.number().int().min(1).max(30).optional(),
  mode: z.enum(['sync', 'queue']).optional()
});

const createBriefSchema = z.object({
  platform: z.string().optional(),
  format: z.string().optional(),
  tone: z.string().optional(),
  objective: z.string().optional(),
  assetIds: z.array(z.string().min(1)).optional(),
  notes: z.array(z.string()).optional()
});

const generateVariantsSchema = z.object({
  count: z.number().int().min(1).max(5).optional()
});

const variantScheduleSchema = z.object({
  scheduledFor: z.string().min(1),
  platforms: z.array(z.string()).optional()
});

const publishMetricsSchema = z.object({
  clicks: z.number().optional(),
  signups: z.number().optional(),
  deposits: z.number().optional(),
  likes: z.number().optional(),
  comments: z.number().optional(),
  shares: z.number().optional(),
  saves: z.number().optional(),
  impressions: z.number().optional()
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    res.json({
      status: 'ok',
      service: 'ReemGrowth Engine'
    });
  })
);

router.post(
  '/auth/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const credentials = loginSchema.parse(req.body ?? {});
    const operator = authenticateOperator(credentials.email, credentials.password);

    if (!operator) {
      throw new AppError('Invalid email or password', 401);
    }

    attachOperatorSession(res, operator);
    res.json({
      authenticated: true,
      operator
    });
  })
);

router.post(
  '/auth/logout',
  asyncHandler(async (_req, res) => {
    clearOperatorSession(res);
    res.status(204).send();
  })
);

router.get(
  '/auth/me',
  requireOperatorAccess,
  asyncHandler(async (req, res) => {
    res.json({
      authenticated: true,
      operator: req.operator
    });
  })
);

router.use(requireAuthenticatedAccess);

router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const summary = await getDashboardSummary();
    res.json(summary);
  })
);

router.get(
  '/v2/spec',
  asyncHandler(async (_req, res) => {
    res.json(getImplementationSpec());
  })
);

router.post(
  '/v2/intelligence/sync',
  asyncHandler(async (req, res) => {
    const body = syncIntelligenceSchema.parse(req.body ?? {});
    if (body.mode === 'queue') {
      const job = await enqueueIntelligenceSync({
        days: body.days
      });
      res.status(202).json({
        message: 'Intelligence sync queued',
        jobId: job.id
      });
      return;
    }

    const result = await syncGameIntelligence(body.days ?? env.RGE_SYNC_DAYS);
    res.json(result);
  })
);

router.get(
  '/v2/intelligence/overview',
  asyncHandler(async (_req, res) => {
    const overview = await getIntelligenceOverview();
    res.json(overview);
  })
);

router.get(
  '/v2/player-snapshots',
  asyncHandler(async (req, res) => {
    const window = z.enum(['24h', '7d', '30d']).optional().parse(req.query.window);
    const limit = z.coerce.number().min(1).max(100).optional().parse(req.query.limit);
    const rows = await listPlayerSnapshots({ window, limit });
    res.json(rows);
  })
);

router.get(
  '/v2/leaderboards',
  asyncHandler(async (req, res) => {
    const window = z.enum(['24h', '7d', '30d']).optional().parse(req.query.window);
    const rows = await listLeaderboards(window);
    res.json(rows);
  })
);

router.get(
  '/v2/signals',
  asyncHandler(async (req, res) => {
    const status = z.string().optional().parse(req.query.status);
    const limit = z.coerce.number().min(1).max(100).optional().parse(req.query.limit);
    const rows = await listSignals({ status, limit });
    res.json(rows);
  })
);

router.get(
  '/v2/content-ideas',
  asyncHandler(async (req, res) => {
    const limit = z.coerce.number().min(1).max(100).optional().parse(req.query.limit);
    const ideas = await listContentIdeas(limit);
    res.json(ideas);
  })
);

router.post(
  '/v2/content-ideas/:ideaId/briefs',
  asyncHandler(async (req, res) => {
    const ideaId = z.string().parse(req.params.ideaId);
    const body = createBriefSchema.parse(req.body ?? {});
    const brief = await createBriefFromIdea({
      ideaId,
      ...body
    });
    res.status(201).json(brief);
  })
);

router.get(
  '/v2/creative-briefs',
  asyncHandler(async (req, res) => {
    const limit = z.coerce.number().min(1).max(100).optional().parse(req.query.limit);
    const briefs = await listCreativeBriefs(limit);
    res.json(briefs);
  })
);

router.post(
  '/v2/creative-briefs/:briefId/variants',
  asyncHandler(async (req, res) => {
    const briefId = z.string().parse(req.params.briefId);
    const body = generateVariantsSchema.parse(req.body ?? {});
    const variants = await generateVariantsForBrief(briefId, body.count ?? 3);
    res.status(201).json(variants);
  })
);

router.get(
  '/v2/content-variants',
  asyncHandler(async (req, res) => {
    const limit = z.coerce.number().min(1).max(100).optional().parse(req.query.limit);
    const variants = await listContentVariants(limit);
    res.json(variants);
  })
);

router.post(
  '/v2/content-variants/:variantId/create-media',
  asyncHandler(async (req, res) => {
    const variantId = z.string().parse(req.params.variantId);
    const job = await queueMediaForVariant(variantId);
    res.status(202).json({
      message: 'Variant media generation queued',
      jobId: job.id,
      variantId
    });
  })
);

router.post(
  '/v2/content-variants/:variantId/schedule',
  asyncHandler(async (req, res) => {
    const variantId = z.string().parse(req.params.variantId);
    const body = variantScheduleSchema.parse(req.body);
    const jobs = await scheduleVariantPublishing({
      variantId,
      scheduledFor: body.scheduledFor,
      platforms: body.platforms
    });
    res.status(202).json(jobs);
  })
);

router.post(
  '/v2/content-variants/:variantId/publish-now',
  asyncHandler(async (req, res) => {
    const variantId = z.string().parse(req.params.variantId);
    const platforms = z.array(z.string()).optional().parse(req.body?.platforms);
    const jobs = await publishVariantNow(variantId, platforms);
    res.json(jobs);
  })
);

router.get(
  '/v2/publishing-jobs',
  asyncHandler(async (req, res) => {
    const limit = z.coerce.number().min(1).max(100).optional().parse(req.query.limit);
    const jobs = await listPublishingJobs(limit);
    res.json(jobs);
  })
);

router.post(
  '/v2/publishing-jobs/:publishingJobId/track',
  asyncHandler(async (req, res) => {
    const publishingJobId = z.string().parse(req.params.publishingJobId);
    const body = publishMetricsSchema.parse(req.body ?? {});
    const job = await recordPublishingJobMetrics({
      publishingJobId,
      ...body
    });
    res.json(job);
  })
);

router.get(
  '/v2/insights',
  asyncHandler(async (_req, res) => {
    const insights = await getInsightsDashboard();
    res.json(insights);
  })
);

router.get(
  '/v2/dashboard',
  asyncHandler(async (_req, res) => {
    const dashboard = await getGrowthDashboard();
    res.json(dashboard);
  })
);

router.post(
  '/generate-content',
  asyncHandler(async (req, res) => {
    const body = generateContentSchema.parse(req.body);
    const platforms = body.platforms?.length ? body.platforms : env.defaultPlatforms;
    const { event, post } = await createEventAndDraftPost(body.event, platforms);
    const job = await enqueueContentGeneration({
      postId: String(post._id)
    });

    res.status(202).json({
      message: 'Content generation queued',
      eventId: String(event._id),
      postId: String(post._id),
      jobId: job.id,
      platforms
    });
  })
);

router.get(
  '/assets',
  asyncHandler(async (_req, res) => {
    const assets = await listAssets();
    res.json(assets);
  })
);

router.post('/assets/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Upload file is required', 400);
  }

  const tags =
    typeof req.body?.tags === 'string'
      ? req.body.tags
          .split(',')
          .map((tag: string) => tag.trim())
          .filter(Boolean)
      : [];

  const asset = await createAssetRecord({
    originalName: req.file.originalname,
    storedFilename: req.file.filename,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    tempFilePath: req.file.path,
    title: typeof req.body?.title === 'string' ? req.body.title : '',
    tags
  });

  res.status(201).json({
    id: String(asset._id),
    message: 'Asset uploaded successfully'
  });
}));

router.post(
  '/assets/:assetId/auto-edit',
  asyncHandler(async (req, res) => {
    const assetId = z.string().parse(req.params.assetId);
    const body = assetEditSchema.parse(req.body);
    const asset = await autoEditAsset({
      assetId,
      preset: body.preset,
      overlayText: body.overlayText
    });

    res.json({
      id: String(asset._id),
      message: 'Asset auto-edited successfully'
    });
  })
);

router.get(
  '/posts',
  asyncHandler(async (req, res) => {
    const query = listPostsQuerySchema.parse(req.query);
    const posts = await listPosts(query);
    res.json(posts);
  })
);

router.post(
  '/posts/:postId/assets',
  asyncHandler(async (req, res) => {
    const postId = z.string().parse(req.params.postId);
    const body = attachAssetsSchema.parse(req.body);
    await attachAssetsToPost(postId, body.assetIds);
    const post = await getPostById(postId);
    res.json(post);
  })
);

router.get(
  '/posts/:postId',
  asyncHandler(async (req, res) => {
    const postId = z.string().parse(req.params.postId);
    const post = await getPostById(postId);
    if (!post) {
      throw new AppError('Post not found', 404);
    }

    res.json(post);
  })
);

router.post(
  '/create-media',
  asyncHandler(async (req, res) => {
    const body = createMediaSchema.parse(req.body);
    const job = await enqueueMediaCreation({
      targetType: 'post',
      postId: body.postId
    });

    res.status(202).json({
      message: 'Media generation queued',
      postId: body.postId,
      jobId: job.id
    });
  })
);

router.post(
  '/posts/:postId/create-media',
  asyncHandler(async (req, res) => {
    const postId = z.string().parse(req.params.postId);
    const job = await enqueueMediaCreation({
      targetType: 'post',
      postId
    });

    res.status(202).json({
      message: 'Media generation queued',
      postId,
      jobId: job.id
    });
  })
);

router.post(
  '/schedule-post',
  asyncHandler(async (req, res) => {
    const body = schedulePostSchema.parse(req.body);
    const result = await queuePostForPublishing(body);

    res.status(202).json({
      message: 'Post scheduled',
      postId: body.postId,
      scheduledFor: body.scheduledFor,
      jobId: result.jobId
    });
  })
);

router.post(
  '/posts/:postId/publish-now',
  asyncHandler(async (req, res) => {
    const postId = z.string().parse(req.params.postId);
    const platforms = z.array(z.string()).optional().parse(req.body?.platforms);
    const result = await publishPost(postId, platforms);
    res.json(result);
  })
);

router.get(
  '/analytics',
  asyncHandler(async (_req, res) => {
    const dashboard = await getAnalyticsDashboard();
    res.json(dashboard);
  })
);

router.post(
  '/analytics/track',
  asyncHandler(async (req, res) => {
    const body = analyticsTrackSchema.parse(req.body);
    const analytics = await recordAnalyticsDelta(body);
    res.status(200).json(analytics);
  })
);

router.get(
  '/events',
  asyncHandler(async (_req, res) => {
    const events = await listRecentEvents();
    res.json(events);
  })
);

router.post(
  '/referral',
  asyncHandler(async (req, res) => {
    const body = referralSchema.parse(req.body);

    if (body.action === 'create') {
      const referral = await createReferralCode(body.ownerUserId);
      res.status(201).json(referral);
      return;
    }

    if (body.action === 'invite') {
      const referral = await recordReferralInvite(body.code, body.invitedUserId);
      res.status(200).json(referral);
      return;
    }

    const referral = await rewardReferralInvite(body.code, body.invitedUserId, body.rewardCents);
    res.status(200).json(referral);
  })
);

router.get(
  '/referrals',
  asyncHandler(async (_req, res) => {
    const referrals = await listReferrals();
    res.json(referrals);
  })
);

export default router;
