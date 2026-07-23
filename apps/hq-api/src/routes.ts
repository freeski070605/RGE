import { Router } from 'express';
import { z } from 'zod';
import { campaignTypes, growthPlayTypes, hqRoles, playerTags, signalTypes } from '@reemteam/shared';
import { authenticateOperator, attachSession, clearSession, requireAuth, requireRoles } from './auth.js';
import { logAdminAction } from './audit.js';
import {
  buildContentDraft,
  createGrowthPlayFromSignal,
  generateGrowthPlaysFromSignals,
  getCommandCenter,
  getSystemHealth,
  hqModels,
  serialize
} from './services.js';
import { defaultPlayerSourceCollections, importExistingPlayers } from './playerImport.js';
import { adjustReemTeamWallet, getPlayerDataIntegrity, getReemTeamPlayer, getReemTeamWalletProfile, listReemTeamPlayers, listReemTeamWallets, patchReemTeamUser, syncPlayerOverlays } from './services/hq/players/reemTeamPlayerAdapter.js';

export const router = Router();

const idParam = z.object({ id: z.string().min(1) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const roleSchema = z.enum(hqRoles);
const tagSchema = z.enum(playerTags);
const signalTypeSchema = z.enum(signalTypes);
const growthPlayTypeSchema = z.enum(growthPlayTypes);
const campaignTypeSchema = z.enum(campaignTypes);
const object = z.record(z.string(), z.unknown());

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
  rtcBalance: z.number().optional(),
  contentSafe: z.boolean().optional(),
  riskFlags: z.array(z.string()).optional()
});
const userUpdateSchema = userSchema.partial();
const statusSchema = z.object({ status: z.enum(['active', 'disabled', 'suspended']) });
const playerImportSchema = z.object({
  collections: z.array(z.string().min(1)).optional(),
  limit: z.number().int().positive().max(100000).optional(),
  dryRun: z.boolean().optional()
});
const tagUpdateSchema = z.object({ add: z.array(tagSchema).optional(), remove: z.array(tagSchema).optional(), set: z.array(tagSchema).optional() });
const noteSchema = z.object({ note: z.string().min(1), visibility: z.enum(['internal', 'owner_only']).optional() });
const cribSchema = z.object({
  cribName: z.string().min(1),
  description: z.string().optional(),
  stakeTier: z.string().min(1),
  theme: z.string().optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
  featured: z.boolean().optional(),
  growthPriority: z.number().optional(),
  eventEligible: z.boolean().optional(),
  visualStyle: object.optional()
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
  rewardRules: object.optional(),
  leaderboardRules: object.optional(),
  contentGoal: z.string().optional(),
  growthGoal: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'running', 'paused', 'ended', 'archived']).optional()
});
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
  scoringBoosts: object.optional()
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
  metadata: object.optional(),
  visibilitySafe: z.boolean().optional(),
  status: z.enum(['new', 'ranked', 'converted', 'dismissed']).optional()
});
const growthPlayCreateSchema = z.object({ signalId: z.string().min(1), playType: growthPlayTypeSchema.optional(), activeCampaign: campaignTypeSchema.optional() });
const growthPlayPatchSchema = z.object({ status: z.enum(['open', 'approved', 'dismissed', 'executed', 'expired']).optional(), urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(), recommendedAction: z.string().optional() });
const draftSchema = z.object({
  growthPlayId: z.string().optional(),
  title: z.string().min(1),
  format: z.string().min(1),
  channel: z.string().min(1),
  caption: z.string().optional(),
  hook: z.string().optional(),
  overlayText: z.string().optional(),
  cta: z.string().optional(),
  selectedAssets: z.array(z.string()).optional(),
  previewUrl: z.string().optional(),
  status: z.enum(['draft', 'needs_review', 'approved', 'scheduled', 'published', 'archived']).optional(),
  scheduledFor: z.coerce.date().optional(),
  publishedDestination: z.string().optional(),
  publishMode: z.enum(['internal_record', 'external_adapter']).optional(),
  publishNotes: z.string().optional()
});
const referralSchema = z.object({ ownerUserId: z.string().min(1), code: z.string().min(2), invitedUserId: z.string().optional(), status: z.enum(['active', 'converted', 'rewarded', 'flagged']).optional(), rewardAmount: z.number().optional(), abuseFlags: z.array(z.string()).optional() });
const walletAdjustmentSchema = z.object({ userId: z.string().min(1), amount: z.number(), reason: z.string().min(1) });
const liveWalletAdjustmentSchema = walletAdjustmentSchema.extend({ currency: z.enum(['USD', 'RTC']).optional() });
const supportSchema = z.object({ userId: z.string().optional(), title: z.string().min(1), status: z.enum(['open', 'resolved']).optional(), severity: z.enum(['low', 'medium', 'high']).optional(), notes: z.array(z.string()).optional() });
const performanceSchema = z.object({ contentDraftId: z.string().optional(), growthPlayId: z.string().optional(), campaignId: z.string().optional(), channel: z.string().min(1), format: z.string().optional(), metric: z.string().min(1), value: z.number(), learning: z.string().min(1), metadata: object.optional() });

const asyncRoute = (fn: any) => async (request: any, response: any, next: any) => {
  try {
    await fn(request, response, next);
  } catch (error) {
    next(error);
  }
};

const list = async (model: any, response: any, query: Record<string, unknown> = {}) => {
  response.json((await model.find(query).sort({ updatedAt: -1, createdAt: -1 }).limit(250).lean()).map(serialize));
};

const getOne = async (model: any, id: string, response: any, notFound = 'Record not found') => {
  const item = await model.findById(id).lean();
  if (!item) return response.status(404).json({ message: notFound });
  return response.json(serialize(item));
};

const patchOne = async (request: any, response: any, model: any, schema: z.ZodTypeAny, targetType: string, actionType: string) => {
  const { id } = idParam.parse(request.params);
  const body = schema.parse(request.body ?? {}) as Record<string, unknown>;
  const item = await model.findByIdAndUpdate(id, { $set: body }, { returnDocument: 'after', runValidators: true });
  if (!item) return response.status(404).json({ message: `${targetType} not found` });
  await logAdminAction(request.operator, { actionType, targetType, targetId: id, description: `Updated ${targetType}.`, metadata: body });
  response.json(serialize(item));
};

const archiveOne = async (request: any, response: any, model: any, targetType: string) => {
  const { id } = idParam.parse(request.params);
  const status = targetType === 'table' ? 'closed' : 'archived';
  const item = await model.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: 'after' });
  if (!item) return response.status(404).json({ message: `${targetType} not found` });
  await logAdminAction(request.operator, { actionType: `${targetType}_updated`, targetType, targetId: id, description: `Archived ${targetType}.` });
  response.json(serialize(item));
};

router.get('/hq/system-health', asyncRoute(async (_request: any, response: any) => response.json(await getSystemHealth())));

router.post('/auth/login', asyncRoute(async (request: any, response: any) => {
  const body = loginSchema.parse(request.body);
  const operator = authenticateOperator(body.email, body.password);
  if (!operator) return response.status(401).json({ message: 'Invalid email or password' });
  attachSession(response, operator);
  response.json({ authenticated: true, operator });
}));
router.post('/auth/logout', (_request, response) => {
  clearSession(response);
  response.status(204).send();
});
router.get('/auth/me', requireAuth, (request, response) => response.json({ authenticated: true, operator: request.operator }));

router.use('/hq', requireAuth);
router.get('/hq/command-center', asyncRoute(async (_request: any, response: any) => response.json(await getCommandCenter())));

router.get('/hq/users', asyncRoute(async (request: any, response: any) => {
  const search = typeof request.query.search === 'string' ? request.query.search : '';
  response.json(await listReemTeamPlayers(search));
}));
router.post('/hq/users', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => {
  const body = userSchema.parse(request.body);
  const user = await hqModels.User.create(body);
  await hqModels.UserProfile.findOneAndUpdate({ userId: user._id }, { $set: { userId: user._id, displayName: user.displayName, contact: { email: user.email, phone: user.phone }, tags: user.tags, contentSafe: user.contentSafe } }, { upsert: true });
  await logAdminAction(request.operator, { actionType: 'user_created', targetType: 'user', targetId: String(user._id), description: `Created ${user.displayName}.` });
  response.status(201).json(serialize(user));
}));
router.post('/hq/users/import-existing', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => {
  const body = playerImportSchema.parse(request.body ?? {});
  const result = await importExistingPlayers(body.collections ?? defaultPlayerSourceCollections, body.limit ?? 10000, body.dryRun ?? false);
  await logAdminAction(request.operator, {
    actionType: 'players_imported',
    targetType: 'user',
    targetId: 'legacy-player-import',
    description: `${body.dryRun ? 'Checked' : 'Imported'} existing players from legacy HQ collections.`,
    metadata: result
  });
  response.json(result);
}));
router.get('/hq/users/:id', asyncRoute(async (request: any, response: any) => {
  const { id } = idParam.parse(request.params);
  const realPlayer = await getReemTeamPlayer(id);
  if (realPlayer) {
    const [notes, walletLedger, supportHistory, referrals, adminActions] = await Promise.all([
      hqModels.AdminNote.find({ userId: realPlayer.hqOverlay?.id ?? realPlayer.id }).sort({ createdAt: -1 }).lean(),
      hqModels.WalletLedger.find({ userId: realPlayer.hqOverlay?.id ?? realPlayer.id }).sort({ createdAt: -1 }).lean(),
      hqModels.SupportIssue.find({ userId: realPlayer.hqOverlay?.id ?? realPlayer.id }).sort({ createdAt: -1 }).lean(),
      hqModels.Referral.find({ $or: [{ ownerUserId: realPlayer.hqOverlay?.id ?? realPlayer.id }, { invitedUserId: realPlayer.hqOverlay?.id ?? realPlayer.id }] }).sort({ createdAt: -1 }).lean(),
      hqModels.AdminActionLog.find({ targetType: 'user', targetId: { $in: [realPlayer.id, realPlayer.hqOverlay?.id].filter(Boolean) } }).sort({ createdAt: -1 }).lean()
    ]);
    return response.json({ ...realPlayer, notes: notes.map(serialize), walletLedger: walletLedger.map(serialize), supportHistory: supportHistory.map(serialize), referralHistory: referrals.map(serialize), adminActions: adminActions.map(serialize) });
  }
  const user = await hqModels.User.findById(id).lean();
  if (!user) return response.status(404).json({ message: 'User not found' });
  const [profile, notes, walletLedger, supportHistory, referrals, adminActions] = await Promise.all([
    hqModels.UserProfile.findOne({ userId: id }).lean(),
    hqModels.AdminNote.find({ userId: id }).sort({ createdAt: -1 }).lean(),
    hqModels.WalletLedger.find({ userId: id }).sort({ createdAt: -1 }).lean(),
    hqModels.SupportIssue.find({ userId: id }).sort({ createdAt: -1 }).lean(),
    hqModels.Referral.find({ $or: [{ ownerUserId: id }, { invitedUserId: id }] }).sort({ createdAt: -1 }).lean(),
    hqModels.AdminActionLog.find({ targetType: 'user', targetId: id }).sort({ createdAt: -1 }).lean()
  ]);
  response.json({ ...serialize(user), profile: serialize(profile), notes: notes.map(serialize), walletLedger: walletLedger.map(serialize), supportHistory: supportHistory.map(serialize), referralHistory: referrals.map(serialize), adminActions: adminActions.map(serialize) });
}));
router.patch('/hq/users/:id', requireRoles(['owner', 'admin', 'operator', 'support']), asyncRoute(async (request: any, response: any) => patchOne(request, response, hqModels.User, userUpdateSchema, 'user', request.body?.status === 'suspended' ? 'user_suspended' : 'user_updated')));
router.patch('/hq/users/:id/status', requireRoles(['owner', 'admin', 'operator', 'support']), asyncRoute(async (request: any, response: any) => patchOne(request, response, hqModels.User, statusSchema, 'user', request.body?.status === 'suspended' ? 'user_suspended' : 'user_updated')));
router.post('/hq/users/:id/ban', requireRoles(['owner', 'admin', 'operator', 'support']), asyncRoute(async (request: any, response: any) => {
  const { id } = idParam.parse(request.params);
  const player = await patchReemTeamUser(id, { isBanned: request.body?.isBanned !== false });
  if (!player) return response.status(404).json({ message: 'User not found' });
  await logAdminAction(request.operator, { actionType: 'user_ban_updated', targetType: 'user', targetId: id, description: `Updated ban state for ${player.username}.`, metadata: { isBanned: player.isBanned } });
  response.json(player);
}));
router.post('/hq/users/:id/freeze', requireRoles(['owner', 'admin', 'operator', 'support']), asyncRoute(async (request: any, response: any) => {
  const { id } = idParam.parse(request.params);
  const player = await patchReemTeamUser(id, { isFrozen: request.body?.isFrozen !== false });
  if (!player) return response.status(404).json({ message: 'User not found' });
  await logAdminAction(request.operator, { actionType: 'user_freeze_updated', targetType: 'user', targetId: id, description: `Updated freeze state for ${player.username}.`, metadata: { isFrozen: player.isFrozen } });
  response.json(player);
}));
router.post('/hq/users/:id/role', requireRoles(['owner', 'admin']), asyncRoute(async (request: any, response: any) => {
  const { id } = idParam.parse(request.params);
  const role = roleSchema.parse(request.body?.role);
  const player = await patchReemTeamUser(id, { role });
  if (!player) return response.status(404).json({ message: 'User not found' });
  await logAdminAction(request.operator, { actionType: 'user_role_updated', targetType: 'user', targetId: id, description: `Updated role for ${player.username}.`, metadata: { role } });
  response.json(player);
}));
router.post('/hq/users/:id/vip', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => {
  const { id } = idParam.parse(request.params);
  const isVip = request.body?.isVip !== false;
  const patch = { vipStatus: isVip ? 'ACTIVE' : 'NONE', vipSince: isVip ? new Date() : null, vipExpiresAt: request.body?.vipExpiresAt ? new Date(request.body.vipExpiresAt) : null };
  const player = await patchReemTeamUser(id, patch);
  if (!player) return response.status(404).json({ message: 'User not found' });
  await logAdminAction(request.operator, { actionType: 'user_vip_updated', targetType: 'user', targetId: id, description: `Updated VIP state for ${player.username}.`, metadata: patch });
  response.json(player);
}));
router.post('/hq/users/:id/notes', requireRoles(['owner', 'admin', 'operator', 'support', 'moderator']), asyncRoute(async (request: any, response: any) => {
  const { id } = idParam.parse(request.params);
  const body = noteSchema.parse(request.body);
  const user = await hqModels.User.findById(id);
  if (!user) return response.status(404).json({ message: 'User not found' });
  const note = await hqModels.AdminNote.create({ userId: id, actorId: request.operator.id, note: body.note, visibility: body.visibility });
  user.adminNotes.push({ note: body.note, actorId: request.operator.id, createdAt: new Date() } as any);
  await user.save();
  await logAdminAction(request.operator, { actionType: 'note_added', targetType: 'user', targetId: id, description: `Added note for ${user.displayName}.` });
  response.status(201).json(serialize(note));
}));
router.post('/hq/users/:id/tags', requireRoles(['owner', 'admin', 'operator', 'support', 'moderator']), asyncRoute(async (request: any, response: any) => {
  const { id } = idParam.parse(request.params);
  const body = tagUpdateSchema.parse(request.body);
  const user = await hqModels.User.findById(id);
  if (!user) return response.status(404).json({ message: 'User not found' });
  const tags = new Set<string>(body.set ?? user.tags);
  body.add?.forEach((tag) => tags.add(tag));
  body.remove?.forEach((tag) => tags.delete(tag));
  user.tags = Array.from(tags) as any;
  await user.save();
  await logAdminAction(request.operator, { actionType: 'user_updated', targetType: 'user', targetId: id, description: `Updated tags for ${user.displayName}.`, metadata: { tags: user.tags } });
  response.json(serialize(user));
}));
router.patch('/hq/users/:id/tags', requireRoles(['owner', 'admin', 'operator', 'support', 'moderator']), asyncRoute(async (request: any, response: any) => {
  const { id } = idParam.parse(request.params);
  const body = tagUpdateSchema.parse(request.body);
  const user = await hqModels.User.findById(id);
  if (!user) return response.status(404).json({ message: 'User not found' });
  const tags = new Set<string>(body.set ?? user.tags);
  body.add?.forEach((tag) => tags.add(tag));
  body.remove?.forEach((tag) => tags.delete(tag));
  user.tags = Array.from(tags) as any;
  await user.save();
  await logAdminAction(request.operator, { actionType: 'user_updated', targetType: 'user', targetId: id, description: `Updated tags for ${user.displayName}.`, metadata: { tags: user.tags } });
  response.json(serialize(user));
}));
router.delete('/hq/users/:id/tags/:tag', requireRoles(['owner', 'admin', 'operator', 'support', 'moderator']), asyncRoute(async (request: any, response: any) => {
  const user = await hqModels.User.findByIdAndUpdate(request.params.id, { $pull: { tags: request.params.tag } }, { returnDocument: 'after' });
  if (!user) return response.status(404).json({ message: 'User not found' });
  await logAdminAction(request.operator, { actionType: 'user_updated', targetType: 'user', targetId: request.params.id, description: `Removed tag ${request.params.tag}.` });
  response.json(serialize(user));
}));

const resource = (path: string, model: any, schema: z.ZodObject<any>, targetType: string) => {
  router.get(`/hq/${path}`, asyncRoute(async (_request: any, response: any) => list(model, response)));
  router.post(`/hq/${path}`, requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => {
    const body = schema.parse(request.body);
    const item = await model.create(body);
    await logAdminAction(request.operator, { actionType: `${targetType}_created`, targetType, targetId: String(item._id), description: `Created ${targetType}.`, metadata: body });
    response.status(201).json(serialize(item));
  }));
  router.get(`/hq/${path}/:id`, asyncRoute(async (request: any, response: any) => getOne(model, idParam.parse(request.params).id, response, `${targetType} not found`)));
  router.patch(`/hq/${path}/:id`, requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne(request, response, model, schema.partial(), targetType, `${targetType}_updated`)));
  router.delete(`/hq/${path}/:id`, requireRoles(['owner', 'admin']), asyncRoute(async (request: any, response: any) => archiveOne(request, response, model, targetType)));
};
resource('cribs', hqModels.Crib, cribSchema, 'crib');
resource('tables', hqModels.Table, tableSchema, 'table');
resource('events', hqModels.Event, eventSchema, 'event');
resource('campaigns', hqModels.Campaign, campaignSchema, 'campaign');

router.post('/hq/tables/:id/pause', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { status: 'paused' } }, response, hqModels.Table, tableSchema.partial(), 'table', 'table_paused')));
router.post('/hq/tables/:id/feature', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { featured: true, priority: 100 } }, response, hqModels.Table, tableSchema.partial(), 'table', 'table_updated')));
router.post('/hq/cribs/:id/feature', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { featured: true, growthPriority: 100 } }, response, hqModels.Crib, cribSchema.partial(), 'crib', 'crib_updated')));
router.post('/hq/events/:id/start', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { status: 'running' } }, response, hqModels.Event, eventSchema.partial(), 'event', 'event_started')));
router.post('/hq/events/:id/pause', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { status: 'paused' } }, response, hqModels.Event, eventSchema.partial(), 'event', 'event_updated')));
router.post('/hq/events/:id/end', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { status: 'ended' } }, response, hqModels.Event, eventSchema.partial(), 'event', 'event_ended')));
router.post('/hq/campaigns/:id/activate', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { status: 'active' } }, response, hqModels.Campaign, campaignSchema.partial(), 'campaign', 'campaign_activated')));
router.post('/hq/campaigns/:id/deactivate', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { status: 'paused' } }, response, hqModels.Campaign, campaignSchema.partial(), 'campaign', 'campaign_deactivated')));

router.get('/hq/game-intelligence/signals', asyncRoute(async (request: any, response: any) => {
  const query: Record<string, unknown> = {};
  if (request.query.status) query.status = request.query.status;
  if (request.query.signalType) query.signalType = request.query.signalType;
  if (request.query.severity) query.severity = request.query.severity;
  response.json((await hqModels.GameIntelligenceSignal.find(query).sort({ occurredAt: -1 }).limit(250).lean()).map(serialize));
}));
router.post('/hq/game-intelligence/signals', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => {
  const body = signalSchema.parse(request.body);
  const signal = await hqModels.GameIntelligenceSignal.create({ ...body, occurredAt: body.occurredAt ?? new Date() });
  await logAdminAction(request.operator, { actionType: 'signal_created', targetType: 'game_intelligence_signal', targetId: String(signal._id), description: `Created signal ${signal.title}.` });
  response.status(201).json(serialize(signal));
}));
router.post('/hq/game-intelligence/run', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => response.json({ generated: await generateGrowthPlaysFromSignals(request.operator) })));
router.get('/hq/game-intelligence/summary', asyncRoute(async (_request: any, response: any) => {
  const [signals, newSignals, converted, critical] = await Promise.all([
    hqModels.GameIntelligenceSignal.countDocuments(),
    hqModels.GameIntelligenceSignal.countDocuments({ status: 'new' }),
    hqModels.GameIntelligenceSignal.countDocuments({ status: 'converted' }),
    hqModels.GameIntelligenceSignal.countDocuments({ severity: 'critical' })
  ]);
  response.json({ signals, newSignals, converted, critical });
}));

router.get('/hq/growth-plays', asyncRoute(async (request: any, response: any) => {
  const query: Record<string, unknown> = {};
  if (request.query.status) query.status = request.query.status;
  if (request.query.playType) query.playType = request.query.playType;
  if (request.query.urgency) query.urgency = request.query.urgency;
  response.json((await hqModels.GrowthPlay.find(query).sort({ finalScore: -1, createdAt: -1 }).limit(250).lean()).map(serialize));
}));
router.post('/hq/growth-plays', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => {
  const body = growthPlayCreateSchema.parse(request.body);
  response.status(201).json(await createGrowthPlayFromSignal(request.operator, body.signalId, body));
}));
router.post('/hq/growth-plays/generate-from-signals', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => response.json({ generated: await generateGrowthPlaysFromSignals(request.operator) })));
router.get('/hq/growth-plays/:id', asyncRoute(async (request: any, response: any) => getOne(hqModels.GrowthPlay, idParam.parse(request.params).id, response, 'Growth Play not found')));
router.patch('/hq/growth-plays/:id', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne(request, response, hqModels.GrowthPlay, growthPlayPatchSchema, 'growth_play', 'growth_play_updated')));
router.post('/hq/growth-plays/:id/approve', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { status: 'approved' } }, response, hqModels.GrowthPlay, growthPlayPatchSchema, 'growth_play', 'growth_play_approved')));
router.post('/hq/growth-plays/:id/dismiss', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { status: 'dismissed' } }, response, hqModels.GrowthPlay, growthPlayPatchSchema, 'growth_play', 'growth_play_dismissed')));
router.post('/hq/growth-plays/:id/build-content', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => response.status(201).json(await buildContentDraft(request.operator, idParam.parse(request.params).id))));

router.get('/hq/content-drafts', asyncRoute(async (_request: any, response: any) => list(hqModels.ContentDraft, response)));
router.post('/hq/content-drafts', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => {
  const draft = await hqModels.ContentDraft.create(draftSchema.parse(request.body));
  await logAdminAction(request.operator, { actionType: 'content_created', targetType: 'content_draft', targetId: String(draft._id), description: `Created content draft ${draft.title}.` });
  response.status(201).json(serialize(draft));
}));
router.get('/hq/content-drafts/:id', asyncRoute(async (request: any, response: any) => getOne(hqModels.ContentDraft, idParam.parse(request.params).id, response, 'Content draft not found')));
router.patch('/hq/content-drafts/:id', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne(request, response, hqModels.ContentDraft, draftSchema.partial(), 'content_draft', 'content_created')));
router.delete('/hq/content-drafts/:id', requireRoles(['owner', 'admin']), asyncRoute(async (request: any, response: any) => archiveOne(request, response, hqModels.ContentDraft, 'content_draft')));
router.post('/hq/content-drafts/:id/approve', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { status: 'approved' } }, response, hqModels.ContentDraft, draftSchema.partial(), 'content_draft', 'content_created')));
router.post('/hq/content-drafts/:id/schedule', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { status: 'scheduled', scheduledFor: request.body?.scheduledFor ?? new Date(Date.now() + 3600000) } }, response, hqModels.ContentDraft, draftSchema.partial(), 'content_draft', 'content_scheduled')));
router.post('/hq/content-drafts/:id/publish-now', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => patchOne({
  ...request,
  body: {
    status: 'published',
    publishedAt: new Date(),
    previewUrl: request.body?.previewUrl,
    publishedDestination: request.body?.publishedDestination ?? request.body?.channel ?? 'Content Studio',
    publishMode: 'internal_record',
    publishNotes: 'Marked as published inside ReemTeamHQ. External channel adapters are not connected yet.'
  }
}, response, hqModels.ContentDraft, draftSchema.partial().extend({ publishedAt: z.coerce.date().optional() }), 'content_draft', 'content_published')));

router.get('/hq/referrals', asyncRoute(async (_request: any, response: any) => list(hqModels.Referral, response)));
router.post('/hq/referrals', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => {
  const referral = await hqModels.Referral.create(referralSchema.parse(request.body));
  await logAdminAction(request.operator, { actionType: 'referral_created', targetType: 'referral', targetId: String(referral._id), description: `Created referral ${referral.code}.` });
  response.status(201).json(serialize(referral));
}));
router.get('/hq/referrals/summary', asyncRoute(async (_request: any, response: any) => {
  const [total, converted, rewarded, flagged, topReferrers] = await Promise.all([
    hqModels.Referral.countDocuments(),
    hqModels.Referral.countDocuments({ status: 'converted' }),
    hqModels.Referral.countDocuments({ status: 'rewarded' }),
    hqModels.Referral.countDocuments({ status: 'flagged' }),
    hqModels.Referral.aggregate([{ $group: { _id: '$ownerUserId', invites: { $sum: 1 }, rewards: { $sum: '$rewardAmount' } } }, { $sort: { invites: -1 } }, { $limit: 10 }])
  ]);
  response.json({ total, converted, rewarded, flagged, topReferrers });
}));

router.get('/hq/wallet', asyncRoute(async (request: any, response: any) => {
  const search = typeof request.query.search === 'string' ? request.query.search : '';
  response.json(await listReemTeamWallets(search));
}));
router.get('/hq/wallet/:userId', asyncRoute(async (request: any, response: any) => {
  const profile = await getReemTeamWalletProfile(request.params.userId);
  const ledger = (await hqModels.WalletLedger.find({ userId: request.params.userId }).sort({ createdAt: -1 }).lean()).map(serialize);
  response.json({
    playerId: request.params.userId,
    ...(profile ?? { wallet: null, transactions: [] }),
    walletSummary: profile?.wallet ?? null,
    ledger,
    source: profile ? 'original_reemteam_admin_wallets' : 'hq_wallet_ledger_only'
  });
}));
router.post('/hq/wallet/adjustment-request', requireRoles(['owner', 'admin']), asyncRoute(async (request: any, response: any) => {
  const body = walletAdjustmentSchema.parse(request.body);
  const entry = await hqModels.WalletLedger.create({ ...body, type: 'adjustment', suspicious: Math.abs(body.amount) >= 10000 });
  await logAdminAction(request.operator, { actionType: 'wallet_adjustment_requested', targetType: 'wallet', targetId: String(entry._id), description: `Requested wallet adjustment for ${body.userId}.`, metadata: body });
  response.status(201).json(serialize(entry));
}));
router.post('/hq/wallet/adjust', requireRoles(['owner', 'admin']), asyncRoute(async (request: any, response: any) => {
  const body = liveWalletAdjustmentSchema.parse(request.body);
  const result = await adjustReemTeamWallet({ ...body, actorId: request.operator.id });
  if (!result) return response.status(404).json({ message: 'User not found' });
  await logAdminAction(request.operator, { actionType: 'wallet_adjusted', targetType: 'wallet', targetId: body.userId, description: `Adjusted ${body.currency ?? 'RTC'} wallet.`, metadata: body });
  response.json(result);
}));

router.get('/hq/support', asyncRoute(async (_request: any, response: any) => list(hqModels.SupportIssue, response)));
router.post('/hq/support', requireRoles(['owner', 'admin', 'operator', 'support', 'moderator']), asyncRoute(async (request: any, response: any) => {
  const issue = await hqModels.SupportIssue.create(supportSchema.parse(request.body));
  await logAdminAction(request.operator, { actionType: 'support_issue_created', targetType: 'support_issue', targetId: String(issue._id), description: `Created support issue ${issue.title}.` });
  response.status(201).json(serialize(issue));
}));
router.get('/hq/support/:id', asyncRoute(async (request: any, response: any) => getOne(hqModels.SupportIssue, idParam.parse(request.params).id, response, 'Support issue not found')));
router.patch('/hq/support/:id', requireRoles(['owner', 'admin', 'operator', 'support', 'moderator']), asyncRoute(async (request: any, response: any) => patchOne(request, response, hqModels.SupportIssue, supportSchema.partial(), 'support_issue', 'support_issue_updated')));
router.post('/hq/support/:id/resolve', requireRoles(['owner', 'admin', 'operator', 'support', 'moderator']), asyncRoute(async (request: any, response: any) => patchOne({ ...request, body: { status: 'resolved' } }, response, hqModels.SupportIssue, supportSchema.partial(), 'support_issue', 'support_issue_resolved')));

router.get('/hq/analytics', asyncRoute(async (_request: any, response: any) => {
  const results = await hqModels.PerformanceResult.find().sort({ createdAt: -1 }).limit(100).lean();
  response.json({ results: results.map(serialize), totals: { results: results.length, value: results.reduce((sum: number, row: any) => sum + (row.value ?? 0), 0) } });
}));
router.get('/hq/analytics/what-worked', asyncRoute(async (_request: any, response: any) => {
  const results = await hqModels.PerformanceResult.find().sort({ value: -1, createdAt: -1 }).limit(12).lean();
  response.json({ learnings: results.length ? results.map((row: any) => row.learning) : ['No performance results yet. Publish content and record outcomes to build What Worked.'] });
}));
router.post('/hq/analytics/performance-results', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => {
  const result = await hqModels.PerformanceResult.create(performanceSchema.parse(request.body));
  response.status(201).json(serialize(result));
}));

router.get('/hq/data-integrity/players', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (_request: any, response: any) => {
  response.json(await getPlayerDataIntegrity());
}));
router.post('/hq/data-integrity/players/sync-overlays', requireRoles(['owner', 'admin']), asyncRoute(async (_request: any, response: any) => {
  response.json(await syncPlayerOverlays());
}));

router.get('/hq/settings', asyncRoute(async (_request: any, response: any) => {
  const setting = await hqModels.HQSetting.findOne({ key: 'operator_settings' }).lean();
  response.json(setting?.value ?? { automationMode: 'assisted', approvedChannels: ['Content Studio', 'In-app banner', 'Push notification'], approvedFormats: ['IG Story', 'Leaderboard card', 'Referral promo'], activeCampaign: null });
}));
router.patch('/hq/settings', requireRoles(['owner', 'admin', 'operator']), asyncRoute(async (request: any, response: any) => {
  const setting = await hqModels.HQSetting.findOneAndUpdate({ key: 'operator_settings' }, { $set: { value: request.body ?? {}, updatedBy: request.operator.email } }, { upsert: true, returnDocument: 'after' });
  await logAdminAction(request.operator, { actionType: 'settings_changed', targetType: 'settings', targetId: 'operator_settings', description: 'Updated HQ settings.', metadata: request.body });
  response.json(setting.value);
}));

router.get('/hq/admin-actions', asyncRoute(async (_request: any, response: any) => list(hqModels.AdminActionLog, response)));
