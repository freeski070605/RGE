import { Router } from 'express';
import { z } from 'zod';
import { campaignTypes, growthPlayTypes, hqRoles, playerTags, signalTypes } from '@reemteam/shared';
import { authenticateOperator, attachSession, clearSession, requireAuth, requireRoles } from './auth.js';
import { logAdminAction } from './audit.js';
import {
  buildContentDraft,
  createGrowthPlayFromSignal,
  dashboardCollections,
  getCommandCenter,
  getSystemHealth,
  logStatusAction,
  serialize
} from './services.js';

export const router = Router();

const idParam = z.object({ id: z.string().min(1) });
const roleSchema = z.enum(hqRoles);
const tagSchema = z.enum(playerTags);
const signalTypeSchema = z.enum(signalTypes);
const growthPlayTypeSchema = z.enum(growthPlayTypes);
const campaignTypeSchema = z.enum(campaignTypes);

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const userSchema = z.object({
  displayName: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: roleSchema.optional(),
  status: z.enum(['active', 'disabled', 'suspended']).optional(),
  tags: z.array(tagSchema).optional(),
  lastActiveAt: z.coerce.date().optional(),
  favoriteCrib: z.string().optional(),
  averageStake: z.number().optional(),
  highestStake: z.number().optional(),
  gamesPlayed: z.number().optional(),
  wins: z.number().optional(),
  losses: z.number().optional(),
  reems: z.number().optional(),
  drops: z.number().optional(),
  caughtDrops: z.number().optional(),
  referrals: z.number().optional(),
  contentSafe: z.boolean().optional(),
  riskFlags: z.array(z.string()).optional()
});
const userUpdateSchema = userSchema.partial();
const tagUpdateSchema = z.object({ add: z.array(tagSchema).optional(), remove: z.array(tagSchema).optional(), set: z.array(tagSchema).optional() });
const noteSchema = z.object({ note: z.string().min(1) });
const cribSchema = z.object({
  cribName: z.string().min(1),
  description: z.string().optional(),
  stakeTier: z.string().min(1),
  theme: z.string().optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
  featured: z.boolean().optional(),
  growthPriority: z.number().optional(),
  eventEligible: z.boolean().optional(),
  visualStyle: z.record(z.string(), z.unknown()).optional()
});
const tableSchema = z.object({
  tableName: z.string().min(1),
  cribId: z.string().min(1),
  stake: z.number(),
  maxSeats: z.number().int().min(2).max(8).optional(),
  status: z.enum(['open', 'active', 'paused', 'closed']).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  eventTable: z.boolean().optional(),
  aiFillEnabled: z.boolean().optional(),
  minimumBalance: z.number().optional(),
  ruleset: z.string().optional(),
  theme: z.string().optional(),
  priority: z.number().optional(),
  featured: z.boolean().optional()
});
const eventSchema = z.object({
  eventName: z.string().min(1),
  eventType: z.string().min(1),
  description: z.string().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  eligibleCribs: z.array(z.string()).optional(),
  eligibleTables: z.array(z.string()).optional(),
  stakeRange: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
  rewardRules: z.record(z.string(), z.unknown()).optional(),
  leaderboardRules: z.record(z.string(), z.unknown()).optional(),
  contentGoal: z.string().optional(),
  growthGoal: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'running', 'paused', 'ended', 'archived']).optional()
});
const signalSchema = z.object({
  signalType: signalTypeSchema,
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  playerId: z.string().optional(),
  tableId: z.string().optional(),
  cribId: z.string().optional(),
  eventId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  occurredAt: z.coerce.date().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  confidence: z.number().min(0).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  visibilitySafe: z.boolean().optional(),
  status: z.enum(['new', 'ranked', 'converted', 'dismissed']).optional()
});
const growthPlayCreateSchema = z.object({ signalId: z.string().min(1), playType: growthPlayTypeSchema.optional(), activeCampaign: campaignTypeSchema.optional() });
const growthPlayStatusSchema = z.object({ status: z.enum(['open', 'approved', 'dismissed', 'executed', 'expired']) });
const campaignSchema = z.object({
  campaignName: z.string().min(1),
  campaignType: campaignTypeSchema,
  description: z.string().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  targetCribs: z.array(z.string()).optional(),
  targetTables: z.array(z.string()).optional(),
  targetSegments: z.array(z.string()).optional(),
  priority: z.number().optional(),
  status: z.enum(['draft', 'active', 'paused', 'ended']).optional(),
  scoringBoosts: z.record(z.string(), z.unknown()).optional()
});

const handle = (fn: Parameters<Router['get']>[1]) => fn;

router.get('/hq/system-health', async (_request, response, next) => {
  try {
    response.json(await getSystemHealth());
  } catch (error) {
    next(error);
  }
});

router.post('/auth/login', async (request, response) => {
  const body = loginSchema.parse(request.body);
  const operator = authenticateOperator(body.email, body.password);
  if (!operator) {
    response.status(401).json({ message: 'Invalid email or password' });
    return;
  }
  attachSession(response, operator);
  response.json({ authenticated: true, operator });
});

router.post('/auth/logout', (_request, response) => {
  clearSession(response);
  response.status(204).send();
});

router.get('/auth/me', requireAuth, (request, response) => {
  response.json({ authenticated: true, operator: request.operator });
});

router.use('/hq', requireAuth);

router.get('/hq/command-center', async (_request, response, next) => {
  try {
    response.json(await getCommandCenter());
  } catch (error) {
    next(error);
  }
});

router.get('/hq/users', async (_request, response, next) => {
  try {
    response.json((await dashboardCollections.users.find().sort({ updatedAt: -1 }).lean()).map(serialize));
  } catch (error) {
    next(error);
  }
});

router.post('/hq/users', requireRoles(['owner', 'admin', 'operator']), async (request, response, next) => {
  try {
    const body = userSchema.parse(request.body);
    const user = await dashboardCollections.users.create(body);
    await logAdminAction(request.operator!, { actionType: 'user_created', targetType: 'user', targetId: String(user._id), description: `Created ${user.displayName}.` });
    response.status(201).json(serialize(user));
  } catch (error) {
    next(error);
  }
});

router.get('/hq/users/:id', async (request, response, next) => {
  try {
    const { id } = idParam.parse(request.params);
    const user = await dashboardCollections.users.findById(id).lean();
    if (!user) return response.status(404).json({ message: 'User not found' });
    const [wallet, support, actions] = await Promise.all([
      dashboardCollections.wallet.find({ userId: id }).sort({ createdAt: -1 }).limit(25).lean(),
      dashboardCollections.support.find({ userId: id }).sort({ createdAt: -1 }).limit(25).lean(),
      dashboardCollections.adminActions.find({ targetType: 'user', targetId: id }).sort({ createdAt: -1 }).limit(25).lean()
    ]);
    response.json({ ...serialize(user), walletLedger: wallet.map(serialize), supportHistory: support.map(serialize), adminActions: actions.map(serialize) });
  } catch (error) {
    next(error);
  }
});

router.patch('/hq/users/:id', requireRoles(['owner', 'admin', 'operator', 'support']), async (request, response, next) => {
  try {
    const { id } = idParam.parse(request.params);
    const body = userUpdateSchema.parse(request.body);
    const user = await dashboardCollections.users.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: true });
    if (!user) return response.status(404).json({ message: 'User not found' });
    await logAdminAction(request.operator!, {
      actionType: body.status === 'suspended' ? 'user_suspended' : 'user_updated',
      targetType: 'user',
      targetId: id,
      description: `Updated ${user.displayName}.`,
      metadata: body
    });
    response.json(serialize(user));
  } catch (error) {
    next(error);
  }
});

router.post('/hq/users/:id/notes', requireRoles(['owner', 'admin', 'operator', 'support', 'moderator']), async (request, response, next) => {
  try {
    const { id } = idParam.parse(request.params);
    const body = noteSchema.parse(request.body);
    const user = await dashboardCollections.users.findByIdAndUpdate(
      id,
      { $push: { adminNotes: { note: body.note, actorId: request.operator!.id, createdAt: new Date() } } },
      { new: true }
    );
    if (!user) return response.status(404).json({ message: 'User not found' });
    await logAdminAction(request.operator!, { actionType: 'note_added', targetType: 'user', targetId: id, description: `Added note for ${user.displayName}.` });
    response.status(201).json(serialize(user));
  } catch (error) {
    next(error);
  }
});

router.patch('/hq/users/:id/tags', requireRoles(['owner', 'admin', 'operator', 'support', 'moderator']), async (request, response, next) => {
  try {
    const { id } = idParam.parse(request.params);
    const body = tagUpdateSchema.parse(request.body);
    const user = await dashboardCollections.users.findById(id);
    if (!user) return response.status(404).json({ message: 'User not found' });
    const tags = new Set<string>(body.set ?? user.tags);
    body.add?.forEach((tag) => tags.add(tag));
    body.remove?.forEach((tag) => tags.delete(tag));
    user.tags = Array.from(tags) as any;
    await user.save();
    await logAdminAction(request.operator!, { actionType: 'user_updated', targetType: 'user', targetId: id, description: `Updated tags for ${user.displayName}.`, metadata: { tags: user.tags } });
    response.json(serialize(user));
  } catch (error) {
    next(error);
  }
});

const crud = (path: string, collectionKey: keyof typeof dashboardCollections, schema: z.ZodObject<any>, actionBase: string) => {
  router.get(`/hq/${path}`, async (_request, response, next) => {
    try {
      const collection = dashboardCollections[collectionKey] as any;
      response.json((await collection.find().sort({ updatedAt: -1 }).lean()).map(serialize));
    } catch (error) {
      next(error);
    }
  });
  router.post(`/hq/${path}`, requireRoles(['owner', 'admin', 'operator']), async (request, response, next) => {
    try {
      const body = schema.parse(request.body);
      const item = await (dashboardCollections[collectionKey] as any).create(body);
      await logAdminAction(request.operator!, { actionType: `${actionBase}_created`, targetType: actionBase, targetId: String(item._id), description: `Created ${actionBase}.`, metadata: body });
      response.status(201).json(serialize(item));
    } catch (error) {
      next(error);
    }
  });
  router.patch(`/hq/${path}/:id`, requireRoles(['owner', 'admin', 'operator']), async (request, response, next) => {
    try {
      const { id } = idParam.parse(request.params);
      const body = schema.partial().parse(request.body);
      const item = await (dashboardCollections[collectionKey] as any).findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: true });
      if (!item) return response.status(404).json({ message: `${actionBase} not found` });
      const statusAction = actionBase === 'table' && body.status === 'paused' ? 'table_paused' : actionBase === 'event' && body.status === 'running' ? 'event_started' : actionBase === 'event' && body.status === 'ended' ? 'event_ended' : `${actionBase}_updated`;
      await logAdminAction(request.operator!, { actionType: statusAction, targetType: actionBase, targetId: id, description: `Updated ${actionBase}.`, metadata: body });
      response.json(serialize(item));
    } catch (error) {
      next(error);
    }
  });
};

crud('cribs', 'cribs', cribSchema, 'crib');
crud('tables', 'tables', tableSchema, 'table');
crud('events', 'events', eventSchema, 'event');
crud('campaigns', 'campaigns', campaignSchema, 'campaign');

router.get('/hq/game-intelligence/signals', async (_request, response, next) => {
  try {
    response.json((await dashboardCollections.signals.find().sort({ occurredAt: -1 }).limit(100).lean()).map(serialize));
  } catch (error) {
    next(error);
  }
});

router.post('/hq/game-intelligence/signals', requireRoles(['owner', 'admin', 'operator']), async (request, response, next) => {
  try {
    const body = signalSchema.parse(request.body);
    const signal = await dashboardCollections.signals.create({ ...body, occurredAt: body.occurredAt ?? new Date() });
    await logAdminAction(request.operator!, { actionType: 'signal_created', targetType: 'game_intelligence_signal', targetId: String(signal._id), description: `Created signal ${signal.title}.` });
    response.status(201).json(serialize(signal));
  } catch (error) {
    next(error);
  }
});

router.get('/hq/growth-plays', async (_request, response, next) => {
  try {
    response.json((await dashboardCollections.growthPlays.find().sort({ finalScore: -1, createdAt: -1 }).lean()).map(serialize));
  } catch (error) {
    next(error);
  }
});

router.post('/hq/growth-plays', requireRoles(['owner', 'admin', 'operator']), async (request, response, next) => {
  try {
    const body = growthPlayCreateSchema.parse(request.body);
    response.status(201).json(await createGrowthPlayFromSignal(request.operator!, body.signalId, body));
  } catch (error) {
    next(error);
  }
});

router.patch('/hq/growth-plays/:id', requireRoles(['owner', 'admin', 'operator']), async (request, response, next) => {
  try {
    const { id } = idParam.parse(request.params);
    const body = growthPlayStatusSchema.parse(request.body);
    const play = await dashboardCollections.growthPlays.findByIdAndUpdate(id, { $set: { status: body.status } }, { new: true });
    if (!play) return response.status(404).json({ message: 'Growth Play not found' });
    await logStatusAction(request.operator!, 'growth_play', id, body.status === 'dismissed' ? 'growth_play_dismissed' : 'growth_play_approved', `Set Growth Play to ${body.status}.`);
    response.json(serialize(play));
  } catch (error) {
    next(error);
  }
});

router.post('/hq/growth-plays/:id/approve', requireRoles(['owner', 'admin', 'operator']), async (request, response, next) => {
  try {
    request.body = { status: 'approved' };
    const { id } = idParam.parse(request.params);
    const play = await dashboardCollections.growthPlays.findByIdAndUpdate(id, { $set: { status: 'approved' } }, { new: true });
    if (!play) return response.status(404).json({ message: 'Growth Play not found' });
    await logStatusAction(request.operator!, 'growth_play', id, 'growth_play_approved', `Approved Growth Play "${play.title}".`);
    response.json(serialize(play));
  } catch (error) {
    next(error);
  }
});

router.post('/hq/growth-plays/:id/dismiss', requireRoles(['owner', 'admin', 'operator']), async (request, response, next) => {
  try {
    const { id } = idParam.parse(request.params);
    const play = await dashboardCollections.growthPlays.findByIdAndUpdate(id, { $set: { status: 'dismissed' } }, { new: true });
    if (!play) return response.status(404).json({ message: 'Growth Play not found' });
    await logStatusAction(request.operator!, 'growth_play', id, 'growth_play_dismissed', `Dismissed Growth Play "${play.title}".`);
    response.json(serialize(play));
  } catch (error) {
    next(error);
  }
});

router.post('/hq/growth-plays/:id/build-content', requireRoles(['owner', 'admin', 'operator']), async (request, response, next) => {
  try {
    const { id } = idParam.parse(request.params);
    response.status(201).json(await buildContentDraft(request.operator!, id));
  } catch (error) {
    next(error);
  }
});

router.get('/hq/content-drafts', async (_request, response, next) => {
  try {
    response.json((await dashboardCollections.contentDrafts.find().sort({ updatedAt: -1 }).lean()).map(serialize));
  } catch (error) {
    next(error);
  }
});

router.patch('/hq/content-drafts/:id', requireRoles(['owner', 'admin', 'operator']), async (request, response, next) => {
  try {
    const { id } = idParam.parse(request.params);
    const draft = await dashboardCollections.contentDrafts.findByIdAndUpdate(id, { $set: request.body }, { new: true });
    if (!draft) return response.status(404).json({ message: 'Content draft not found' });
    const actionType = draft.status === 'scheduled' ? 'content_scheduled' : draft.status === 'published' ? 'content_published' : 'content_created';
    await logStatusAction(request.operator!, 'content_draft', id, actionType, `Updated content draft "${draft.title}".`);
    response.json(serialize(draft));
  } catch (error) {
    next(error);
  }
});

router.get('/hq/referrals', async (_request, response) => {
  response.json({ topReferrers: [], inviteChains: [], rewardActivity: [], abuseFlags: [] });
});

router.get('/hq/wallet', async (_request, response, next) => {
  try {
    response.json((await dashboardCollections.wallet.find().sort({ createdAt: -1 }).limit(100).lean()).map(serialize));
  } catch (error) {
    next(error);
  }
});

router.get('/hq/support', async (_request, response, next) => {
  try {
    response.json((await dashboardCollections.support.find().sort({ updatedAt: -1 }).lean()).map(serialize));
  } catch (error) {
    next(error);
  }
});

router.get('/hq/analytics', async (_request, response) => {
  response.json({
    learnings: [
      'Big payout stories drove the most table joins.',
      'Referral pushes perform better during live events.',
      'Reem content is outperforming normal win content.'
    ]
  });
});

router.get('/hq/settings', (request, response) => {
  response.json({ operator: request.operator, automationMode: 'assisted', activeCampaign: null });
});
