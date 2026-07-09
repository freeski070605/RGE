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
import { attachAssetsToPost, autoEditAsset, createAssetRecord, deleteAsset, listAssets } from '../services/assets/assetService';
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
  createHqAdminNote,
  createHqEvent,
  getCoreModuleReadiness,
  getHqUserProfile,
  listHqCribs,
  listHqEvents,
  listHqGameIntelligenceSignals,
  listHqTables,
  listHqUsers,
  updateHqCrib,
  updateHqEvent,
  updateHqTable,
  updateHqUser
} from '../services/hq/coreModuleService';
import {
  getIntelligenceOverview,
  listLeaderboards,
  listPlayerSnapshots,
  listSignals,
  syncGameIntelligence
} from '../services/intelligence/intelligenceService';
import { createReferralCode, recordReferralInvite, rewardReferralInvite } from '../services/referral/referralService';
import { publishPost, queuePostForPublishing } from '../services/scheduler/schedulerService';
import { getCommandCenter } from '../services/operator/commandCenterService';
import {
  approveContentItem,
  archiveContentItem,
  createContentItemFromOpportunity,
  dismissOpportunity,
  generateContentItemCopy,
  generateContentItemMedia,
  getCalendarView,
  getContentItemById,
  listPipeline,
  publishContentItemNow,
  saveContentItemDraft,
  saveOpportunityForLater,
  scheduleContentItem,
  selectContentItemVariant,
  selectContentItemVisualPreset
} from '../services/operator/contentItemService';
import { getGrowthLoopsView } from '../services/operator/growthLoopsService';
import { getHqBlueprint } from '../services/hq/hqBlueprintService';
import { getLibraryView } from '../services/operator/libraryService';
import { listOpportunities } from '../services/operator/opportunityService';
import { getPerformanceView } from '../services/operator/performanceService';
import { getOperatorSettings, updateOperatorSettings } from '../services/operator/settingsService';
import { markPostMediaQueued } from '../services/media-engine/mediaEngine';
import { getImplementationSpec } from '../services/spec/implementationSpecService';
import { getMediaDiagnostics, getSystemHealth } from '../services/system/systemHealthService';
import { getSystemIntegrity } from '../services/system/systemIntegrityService';
import { getWorkersStatus } from '../services/system/workerStatusService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';

const router = Router();
const supportedPublishPlatforms = ['instagram', 'story'] as const;
const supportedPublishPlatformSet = new Set<string>(supportedPublishPlatforms);
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
const optionalPlatformsSchema = z.array(z.enum(supportedPublishPlatforms)).optional();

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
  platforms: optionalPlatformsSchema
});

const createMediaSchema = z.object({
  postId: z.string().min(1)
});

const schedulePostSchema = z.object({
  postId: z.string().min(1),
  scheduledFor: z.string().min(1),
  platforms: optionalPlatformsSchema
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
  platforms: optionalPlatformsSchema
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

const updateOperatorSettingsSchema = z.object({
  mode: z.enum(['autopilot', 'assisted', 'manual']).optional(),
  activeCampaign: z
    .enum([
      'none',
      'weekend_push',
      'event_night',
      'referral_growth',
      'leaderboard_race',
      'high_stakes_promo',
      'new_player_activation',
      'inactive_player_reactivation'
    ])
    .optional()
});

const generateCopySchema = z.object({
  count: z.number().int().min(1).max(5).optional()
});

const contentItemScheduleSchema = z.object({
  scheduledFor: z.string().min(1),
  platforms: optionalPlatformsSchema
});

const selectVariantSchema = z.object({
  variantId: z.string().min(1)
});

const selectVisualPresetSchema = z.object({
  preset: z.string().min(1)
});

const archiveContentItemSchema = z.object({
  reason: z.string().optional()
});
const listHqUsersQuerySchema = z.object({
  status: z.string().optional(),
  role: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});
const updateHqUserSchema = z.object({
  status: z.enum(['active', 'disabled', 'suspended']).optional(),
  role: z.enum(['owner', 'admin', 'operator', 'moderator', 'support', 'player']).optional()
});
const createAdminNoteSchema = z.object({
  note: z.string().min(1),
  visibility: z.enum(['internal', 'owner_only']).optional()
});
const listByStatusQuerySchema = z.object({
  status: z.string().optional()
});
const listHqTablesQuerySchema = z.object({
  status: z.string().optional(),
  cribId: z.string().optional()
});
const updateHqCribSchema = z.object({
  description: z.string().optional(),
  stakeTier: z.string().optional(),
  theme: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'retired']).optional(),
  featured: z.boolean().optional(),
  growthPriority: z.number().optional(),
  eventEligible: z.boolean().optional(),
  visualStyle: z.record(z.string(), z.unknown()).optional()
});
const updateHqTableSchema = z.object({
  tableName: z.string().min(1).optional(),
  stake: z.number().optional(),
  maxSeats: z.number().int().min(2).max(8).optional(),
  status: z.enum(['open', 'active', 'paused', 'closed']).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  eventTable: z.boolean().optional(),
  aiFillEnabled: z.boolean().optional(),
  minimumBalance: z.number().optional(),
  ruleset: z.string().optional(),
  theme: z.string().optional(),
  priority: z.number().optional(),
  featuredAt: z.string().datetime().nullable().optional()
});
const hqEventPayloadSchema = z.object({
  eventName: z.string().min(1),
  eventType: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  eligibleCribs: z.array(z.string()).optional(),
  eligibleTables: z.array(z.string()).optional(),
  stakeRange: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
  rewardRules: z.record(z.string(), z.unknown()).optional(),
  leaderboardRules: z.record(z.string(), z.unknown()).optional(),
  contentGoal: z.string().optional(),
  growthGoal: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'running', 'completed', 'cancelled']).optional()
});
const updateHqEventSchema = hqEventPayloadSchema.partial();
const listHqSignalsQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
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
      service: 'ReemTeam HQ',
      module: 'RGE Growth Engine'
    });
  })
);

router.get(
  '/hq/blueprint',
  asyncHandler(async (_req, res) => {
    res.json(getHqBlueprint());
  })
);

router.get(
  '/hq/modules/readiness',
  asyncHandler(async (_req, res) => {
    res.json(await getCoreModuleReadiness());
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
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await getOperatorSettings(req.operator?.email || env.OPERATOR_EMAIL);
    res.json(settings);
  })
);

router.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const body = updateOperatorSettingsSchema.parse(req.body ?? {});
    const settings = await updateOperatorSettings(req.operator?.email || env.OPERATOR_EMAIL, body);
    res.json(settings);
  })
);

router.get(
  '/command-center',
  asyncHandler(async (_req, res) => {
    res.json(await getCommandCenter());
  })
);

router.get(
  '/hq/users',
  asyncHandler(async (req, res) => {
    const query = listHqUsersQuerySchema.parse(req.query);
    res.json(await listHqUsers(query));
  })
);

router.get(
  '/hq/users/:userId/profile',
  asyncHandler(async (req, res) => {
    const userId = z.string().parse(req.params.userId);
    res.json(await getHqUserProfile(userId));
  })
);

router.patch(
  '/hq/users/:userId',
  asyncHandler(async (req, res) => {
    const userId = z.string().parse(req.params.userId);
    const body = updateHqUserSchema.parse(req.body ?? {});
    res.json(await updateHqUser(userId, body));
  })
);

router.post(
  '/hq/users/:userId/notes',
  asyncHandler(async (req, res) => {
    const userId = z.string().parse(req.params.userId);
    const body = createAdminNoteSchema.parse(req.body ?? {});
    res.status(201).json(await createHqAdminNote({ userId, ...body }));
  })
);

router.get(
  '/hq/cribs',
  asyncHandler(async (req, res) => {
    const query = listByStatusQuerySchema.parse(req.query);
    res.json(await listHqCribs(query));
  })
);

router.patch(
  '/hq/cribs/:cribId',
  asyncHandler(async (req, res) => {
    const cribId = z.string().parse(req.params.cribId);
    const body = updateHqCribSchema.parse(req.body ?? {});
    res.json(await updateHqCrib(cribId, body));
  })
);

router.get(
  '/hq/tables',
  asyncHandler(async (req, res) => {
    const query = listHqTablesQuerySchema.parse(req.query);
    res.json(await listHqTables(query));
  })
);

router.patch(
  '/hq/tables/:tableId',
  asyncHandler(async (req, res) => {
    const tableId = z.string().parse(req.params.tableId);
    const body = updateHqTableSchema.parse(req.body ?? {});
    res.json(await updateHqTable(tableId, body));
  })
);

router.get(
  '/hq/events',
  asyncHandler(async (req, res) => {
    const query = listByStatusQuerySchema.parse(req.query);
    res.json(await listHqEvents(query));
  })
);

router.post(
  '/hq/events',
  asyncHandler(async (req, res) => {
    const body = hqEventPayloadSchema.parse(req.body ?? {});
    res.status(201).json(await createHqEvent(body));
  })
);

router.patch(
  '/hq/events/:eventId',
  asyncHandler(async (req, res) => {
    const eventId = z.string().parse(req.params.eventId);
    const body = updateHqEventSchema.parse(req.body ?? {});
    res.json(await updateHqEvent(eventId, body));
  })
);

router.get(
  '/hq/game-intelligence/signals',
  asyncHandler(async (req, res) => {
    const query = listHqSignalsQuerySchema.parse(req.query);
    res.json(await listHqGameIntelligenceSignals(query));
  })
);

router.get(
  '/opportunities',
  asyncHandler(async (_req, res) => {
    res.json(await listOpportunities());
  })
);

router.get(
  '/growth-plays',
  asyncHandler(async (_req, res) => {
    res.json(await listOpportunities());
  })
);

router.post(
  '/opportunities/:id/create-content-item',
  asyncHandler(async (req, res) => {
    const opportunityId = z.string().parse(req.params.id);
    const item = await createContentItemFromOpportunity({
      opportunityId,
      operatorEmail: req.operator?.email || env.OPERATOR_EMAIL
    });
    res.status(201).json(item);
  })
);

router.post(
  '/growth-plays/:id/create-content-item',
  asyncHandler(async (req, res) => {
    const opportunityId = z.string().parse(req.params.id);
    const item = await createContentItemFromOpportunity({
      opportunityId,
      operatorEmail: req.operator?.email || env.OPERATOR_EMAIL
    });
    res.status(201).json(item);
  })
);

router.post(
  '/opportunities/:id/save-for-later',
  asyncHandler(async (req, res) => {
    const opportunityId = z.string().parse(req.params.id);
    const saved = await saveOpportunityForLater(opportunityId);
    res.json({
      id: String(saved._id),
      operatorStatus: saved.operatorStatus,
      savedForLaterAt: saved.savedForLaterAt
    });
  })
);

router.post(
  '/growth-plays/:id/save-for-later',
  asyncHandler(async (req, res) => {
    const opportunityId = z.string().parse(req.params.id);
    const saved = await saveOpportunityForLater(opportunityId);
    res.json({
      id: String(saved._id),
      operatorStatus: saved.operatorStatus,
      savedForLaterAt: saved.savedForLaterAt
    });
  })
);

router.post(
  '/opportunities/:id/dismiss',
  asyncHandler(async (req, res) => {
    const opportunityId = z.string().parse(req.params.id);
    const dismissed = await dismissOpportunity(opportunityId);
    res.json({
      id: String(dismissed._id),
      operatorStatus: dismissed.operatorStatus,
      dismissedAt: dismissed.dismissedAt
    });
  })
);

router.post(
  '/growth-plays/:id/dismiss',
  asyncHandler(async (req, res) => {
    const opportunityId = z.string().parse(req.params.id);
    const dismissed = await dismissOpportunity(opportunityId);
    res.json({
      id: String(dismissed._id),
      operatorStatus: dismissed.operatorStatus,
      dismissedAt: dismissed.dismissedAt
    });
  })
);

router.get(
  '/pipeline',
  asyncHandler(async (_req, res) => {
    res.json(await listPipeline());
  })
);

router.get(
  '/content-items/:id',
  asyncHandler(async (req, res) => {
    const itemId = z.string().parse(req.params.id);
    res.json(await getContentItemById(itemId));
  })
);

router.post(
  '/content-items/:id/generate-copy',
  asyncHandler(async (req, res) => {
    const itemId = z.string().parse(req.params.id);
    const body = generateCopySchema.parse(req.body ?? {});
    res.json(await generateContentItemCopy({ itemId, count: body.count }));
  })
);

router.post(
  '/content-items/:id/generate-media',
  asyncHandler(async (req, res) => {
    const itemId = z.string().parse(req.params.id);
    res.json(await generateContentItemMedia(itemId));
  })
);

router.post(
  '/content-items/:id/approve',
  asyncHandler(async (req, res) => {
    const itemId = z.string().parse(req.params.id);
    res.json(await approveContentItem(itemId));
  })
);

router.post(
  '/content-items/:id/save-draft',
  asyncHandler(async (req, res) => {
    const itemId = z.string().parse(req.params.id);
    res.json(await saveContentItemDraft(itemId));
  })
);

router.post(
  '/content-items/:id/select-variant',
  asyncHandler(async (req, res) => {
    const itemId = z.string().parse(req.params.id);
    const body = selectVariantSchema.parse(req.body ?? {});
    res.json(await selectContentItemVariant({ itemId, variantId: body.variantId }));
  })
);

router.post(
  '/content-items/:id/select-visual-preset',
  asyncHandler(async (req, res) => {
    const itemId = z.string().parse(req.params.id);
    const body = selectVisualPresetSchema.parse(req.body ?? {});
    res.json(await selectContentItemVisualPreset({ itemId, preset: body.preset }));
  })
);

router.post(
  '/content-items/:id/schedule',
  asyncHandler(async (req, res) => {
    const itemId = z.string().parse(req.params.id);
    const body = contentItemScheduleSchema.parse(req.body ?? {});
    res.json(
      await scheduleContentItem({
        itemId,
        scheduledFor: body.scheduledFor,
        platforms: body.platforms,
        operatorEmail: req.operator?.email || env.OPERATOR_EMAIL
      })
    );
  })
);

router.post(
  '/content-items/:id/publish-now',
  asyncHandler(async (req, res) => {
    const itemId = z.string().parse(req.params.id);
    res.json(await publishContentItemNow({ itemId, operatorEmail: req.operator?.email || env.OPERATOR_EMAIL }));
  })
);

router.post(
  '/content-items/:id/archive',
  asyncHandler(async (req, res) => {
    const itemId = z.string().parse(req.params.id);
    const body = archiveContentItemSchema.parse(req.body ?? {});
    res.json(await archiveContentItem({ itemId, reason: body.reason }));
  })
);

router.get(
  '/calendar',
  asyncHandler(async (_req, res) => {
    res.json(await getCalendarView());
  })
);

router.get(
  '/performance',
  asyncHandler(async (_req, res) => {
    res.json(await getPerformanceView());
  })
);

router.get(
  '/library',
  asyncHandler(async (_req, res) => {
    res.json(await getLibraryView());
  })
);

router.get(
  '/growth-loops',
  asyncHandler(async (_req, res) => {
    res.json(await getGrowthLoopsView());
  })
);

router.get(
  '/system-health',
  asyncHandler(async (_req, res) => {
    res.json(await getSystemHealth());
  })
);

router.get(
  '/system-integrity',
  asyncHandler(async (_req, res) => {
    res.json(await getSystemIntegrity());
  })
);

router.get(
  '/workers/status',
  asyncHandler(async (_req, res) => {
    res.json(await getWorkersStatus());
  })
);

router.get(
  '/media/diagnostics',
  asyncHandler(async (_req, res) => {
    res.json(await getMediaDiagnostics());
  })
);

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
    const platforms = optionalPlatformsSchema.parse(req.body?.platforms);
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

    for (const platform of platforms) {
      if (!supportedPublishPlatformSet.has(platform)) {
        throw new AppError(`Unsupported publish platform: ${platform}`, 400);
      }
    }

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

router.delete(
  '/assets/:assetId',
  asyncHandler(async (req, res) => {
    const assetId = z.string().parse(req.params.assetId);
    res.json(await deleteAsset(assetId));
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
    await markPostMediaQueued(body.postId, String(job.id));

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
    await markPostMediaQueued(postId, String(job.id));

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
    const platforms = optionalPlatformsSchema.parse(req.body?.platforms);
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
