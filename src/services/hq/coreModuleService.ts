import { AppError } from '../../utils/errors';
import { AdminActionLogModel, AdminNoteModel, HQUserModel, UserProfileModel } from '../../db/models/hq/User';
import { CribModel, GameEventModel, LeaderboardModel, TableModel } from '../../db/models/hq/GameOperations';
import { GameIntelligenceSignalModel, GrowthPlayModel } from '../../db/models/hq/GrowthIntelligence';
import { HQEventModel, WalletLedgerModel } from '../../db/models/hq/Operations';
import { hqRoles, userTags } from '../../hq/domain';

const toId = (value: unknown) => String(value ?? '');
const roleSet = new Set<string>(hqRoles);
const tagSet = new Set<string>(userTags);

type ActorContext = {
  actorId?: string;
  actorRole?: string;
  actorName?: string;
};

const normalizeActorRole = (role?: string) => (role && roleSet.has(role) ? role : 'operator');

const recordAdminAction = async (input: ActorContext & {
  actionType: string;
  targetType: string;
  targetId: string;
  description: string;
  metadata?: Record<string, unknown>;
}) => {
  await AdminActionLogModel.create({
    actorId: input.actorId,
    actorRole: normalizeActorRole(input.actorRole),
    action: input.actionType,
    actionType: input.actionType,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: input.description,
    description: input.description,
    metadata: {
      ...(input.metadata ?? {}),
      actorName: input.actorName
    }
  });
};

const mapUser = (user: any, profile?: any) => ({
  id: toId(user._id),
  username: user.username,
  displayName: user.displayName,
  email: user.email ?? null,
  status: user.status,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  profile: profile
    ? {
        id: toId(profile._id),
        displayName: profile.displayName,
        contact: profile.contact ?? {},
        tags: profile.tags ?? [],
        lastActiveAt: profile.lastActiveAt ?? null,
        gamesPlayed: profile.gamesPlayed ?? 0,
        wins: profile.wins ?? 0,
        losses: profile.losses ?? 0,
        reems: profile.reems ?? 0,
        drops: profile.drops ?? 0,
        caughtDrops: profile.caughtDrops ?? 0,
        favoriteCribId: profile.favoriteCribId ? toId(profile.favoriteCribId) : null,
        averageStake: profile.averageStake ?? 0,
        highestStake: profile.highestStake ?? 0,
        referralCount: profile.referralCount ?? 0,
        walletSummary: profile.walletSummary ?? {},
        supportHistory: profile.supportHistory ?? [],
        riskFlags: profile.riskFlags ?? []
      }
    : null
});

const mapCrib = (crib: any, tableCount = 0) => ({
  id: toId(crib._id),
  cribName: crib.cribName,
  description: crib.description,
  stakeTier: crib.stakeTier,
  theme: crib.theme,
  status: crib.status,
  featured: crib.featured,
  growthPriority: crib.growthPriority,
  eventEligible: crib.eventEligible,
  visualStyle: crib.visualStyle ?? {},
  tableCount,
  createdAt: crib.createdAt,
  updatedAt: crib.updatedAt
});

const mapTable = (table: any) => ({
  id: toId(table._id),
  tableName: table.tableName,
  cribId: table.cribId ? toId(table.cribId) : null,
  cribName: table.cribId?.cribName ?? null,
  stake: table.stake,
  maxSeats: table.maxSeats,
  status: table.status,
  visibility: table.visibility,
  eventTable: table.eventTable,
  aiFillEnabled: table.aiFillEnabled,
  minimumBalance: table.minimumBalance,
  ruleset: table.ruleset,
  theme: table.theme,
  priority: table.priority,
  featuredAt: table.featuredAt ?? null,
  createdAt: table.createdAt,
  updatedAt: table.updatedAt
});

const mapEvent = (event: any) => ({
  id: toId(event._id),
  eventName: event.eventName,
  eventType: event.eventType,
  startTime: event.startTime,
  endTime: event.endTime,
  eligibleCribs: (event.eligibleCribs ?? []).map(toId),
  eligibleTables: (event.eligibleTables ?? []).map(toId),
  stakeRange: event.stakeRange ?? {},
  rewardRules: event.rewardRules ?? {},
  leaderboardRules: event.leaderboardRules ?? {},
  contentGoal: event.contentGoal,
  growthGoal: event.growthGoal,
  status: event.status,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt
});

const mapSignal = (signal: any) => ({
  id: toId(signal._id),
  signalType: signal.signalType,
  sourceType: signal.sourceType ?? signal.source,
  source: signal.source,
  sourceId: signal.sourceId,
  playerId: signal.playerId ? toId(signal.playerId) : signal.targetUserId ? toId(signal.targetUserId) : null,
  tableId: signal.tableId ? toId(signal.tableId) : signal.targetTableId ? toId(signal.targetTableId) : null,
  cribId: signal.cribId ? toId(signal.cribId) : signal.targetCribId ? toId(signal.targetCribId) : null,
  eventId: signal.eventId ? toId(signal.eventId) : signal.targetEventId ? toId(signal.targetEventId) : null,
  targetUserId: signal.targetUserId ? toId(signal.targetUserId) : signal.playerId ? toId(signal.playerId) : null,
  targetCribId: signal.targetCribId ? toId(signal.targetCribId) : signal.cribId ? toId(signal.cribId) : null,
  targetTableId: signal.targetTableId ? toId(signal.targetTableId) : signal.tableId ? toId(signal.tableId) : null,
  targetEventId: signal.targetEventId ? toId(signal.targetEventId) : signal.eventId ? toId(signal.eventId) : null,
  title: signal.title ?? signal.summary,
  description: signal.description ?? signal.summary,
  summary: signal.summary,
  details: signal.details ?? signal.metadata ?? {},
  metadata: signal.metadata ?? signal.details ?? {},
  severity: signal.severity ?? 'medium',
  confidence: signal.confidence,
  visibilitySafe: signal.visibilitySafe ?? true,
  occurredAt: signal.occurredAt,
  status: signal.status,
  createdAt: signal.createdAt,
  updatedAt: signal.updatedAt
});

const mapGrowthPlay = (play: any) => ({
  id: toId(play._id),
  title: play.title,
  goal: play.goal,
  playType: play.playType,
  sourceSignalIds: (play.sourceSignalIds ?? []).map(toId),
  targetUserId: play.targetUserId ? toId(play.targetUserId) : null,
  targetCribId: play.targetCribId ? toId(play.targetCribId) : null,
  targetTableId: play.targetTableId ? toId(play.targetTableId) : null,
  targetEventId: play.targetEventId ? toId(play.targetEventId) : null,
  recommendedAction: play.recommendedAction,
  recommendedChannel: play.recommendedChannel,
  recommendedFormat: play.recommendedFormat,
  whyItMatters: play.whyItMatters,
  whyThis: play.whyThis ?? {
    sourceSignals: [],
    scoreBoosts: [],
    penalties: [],
    campaignFit: '',
    recommendedActionReason: ''
  },
  urgency: play.urgency,
  confidence: play.confidence,
  estimatedValue: play.estimatedValue,
  scoreParts: play.scoreParts ?? {},
  finalScore: play.finalScore,
  riskFlags: play.riskFlags ?? [],
  status: play.status,
  expiresAt: play.expiresAt ?? null,
  createdAt: play.createdAt,
  updatedAt: play.updatedAt
});

export const getCoreModuleReadiness = async () => {
  const [
    users,
    profiles,
    cribs,
    tables,
    hqEvents,
    gameEvents,
    hqSignals,
    growthPlays,
    walletLedger,
    leaderboards,
    adminNotes
  ] = await Promise.all([
    HQUserModel.countDocuments(),
    UserProfileModel.countDocuments(),
    CribModel.countDocuments(),
    TableModel.countDocuments(),
    HQEventModel.countDocuments(),
    GameEventModel.countDocuments(),
    GameIntelligenceSignalModel.countDocuments(),
    GrowthPlayModel.countDocuments(),
    WalletLedgerModel.countDocuments(),
    LeaderboardModel.countDocuments(),
    AdminNoteModel.countDocuments()
  ]);

  return {
    modules: [
      { id: 'command_center', status: 'connected', detail: 'Aggregates live HQ operations, Growth Plays, health, and performance views.' },
      { id: 'crm', status: 'connected', detail: 'User profiles, tags, notes, wallet summaries, and action history are database-backed.', counts: { users, profiles, adminNotes, walletLedger } },
      { id: 'users', status: 'connected', detail: 'Users can be listed, inspected, and updated through HQ APIs.', counts: { users } },
      { id: 'tables', status: 'connected', detail: 'Tables are stored in Mongo and can be listed or updated.', counts: { tables } },
      { id: 'cribs', status: 'connected', detail: 'Cribs are stored in Mongo and can be listed or updated.', counts: { cribs } },
      { id: 'events', status: 'connected', detail: 'HQ events are stored in Mongo and can be created, listed, and updated.', counts: { hqEvents } },
      { id: 'game_intelligence', status: 'connected', detail: 'HQ signals and normalized RGE signals are exposed through API routes.', counts: { hqSignals, gameEvents, leaderboards } },
      { id: 'growth_plays', status: 'connected', detail: 'Growth Plays are generated from intelligence and can become operator content items.', counts: { growthPlays } },
      { id: 'content_studio', status: 'connected', detail: 'Content items support copy generation, media rendering, approval, scheduling, publishing, and archiving.' },
      { id: 'referrals', status: 'connected', detail: 'Referral create, invite, reward, and reporting flows are wired.' },
      { id: 'wallet_ops', status: 'connected', detail: 'Wallet summaries and HQ wallet ledger records are queryable.', counts: { walletLedger } },
      { id: 'system_health', status: 'connected', detail: 'Backend, Mongo, Redis, workers, media, and publishing diagnostics are live.' }
    ]
  };
};

export const listHqUsers = async (input?: { status?: string; role?: string; search?: string; limit?: number }) => {
  const query: Record<string, unknown> = {};
  if (input?.status) query.status = input.status;
  if (input?.role) query.role = input.role;
  if (input?.search) {
    const search = new RegExp(input.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ username: search }, { displayName: search }, { email: search }];
  }

  const users = await HQUserModel.find(query).sort({ updatedAt: -1 }).limit(input?.limit ?? 50).lean();
  const profiles = await UserProfileModel.find({ userId: { $in: users.map((user) => user._id) } }).lean();
  const profileByUserId = new Map(profiles.map((profile) => [toId(profile.userId), profile]));
  return users.map((user) => mapUser(user, profileByUserId.get(toId(user._id))));
};

export const getHqUserProfile = async (userId: string) => {
  const [user, profile, notes, actions, walletLedger] = await Promise.all([
    HQUserModel.findById(userId).lean(),
    UserProfileModel.findOne({ userId }).lean(),
    AdminNoteModel.find({ userId }).sort({ createdAt: -1 }).limit(25).lean(),
    AdminActionLogModel.find({ targetType: 'user', targetId: userId }).sort({ createdAt: -1 }).limit(25).lean(),
    WalletLedgerModel.find({ userId }).sort({ createdAt: -1 }).limit(25).lean()
  ]);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return {
    ...mapUser(user, profile),
    notes: notes.map((note) => ({
      id: toId(note._id),
      note: note.note,
      visibility: note.visibility,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    })),
    actions: actions.map((action) => ({
      id: toId(action._id),
      action: action.actionType ?? action.action,
      actionType: action.actionType ?? action.action,
      summary: action.description ?? action.summary,
      description: action.description ?? action.summary,
      actorRole: action.actorRole ?? 'operator',
      metadata: action.metadata ?? {},
      createdAt: action.createdAt
    })),
    walletLedger: walletLedger.map((entry) => ({
      id: toId(entry._id),
      type: entry.type,
      amountCents: entry.amountCents,
      reason: entry.reason,
      referenceType: entry.referenceType ?? null,
      referenceId: entry.referenceId ?? null,
      balanceAfterCents: entry.balanceAfterCents,
      createdAt: entry.createdAt
    }))
  };
};

export const createHqUser = async (
  input: {
    username: string;
    displayName: string;
    email?: string;
    phone?: string;
    status?: string;
    role?: string;
    tags?: string[];
    adminNote?: string;
  },
  actor?: ActorContext
) => {
  const user = await HQUserModel.create({
    username: input.username,
    displayName: input.displayName,
    email: input.email,
    status: input.status ?? 'active',
    role: input.role ?? 'player'
  });
  const tags = (input.tags ?? []).filter((tag) => tagSet.has(tag));
  const profile = await UserProfileModel.create({
    userId: user._id,
    displayName: input.displayName,
    contact: {
      email: input.email,
      phone: input.phone
    },
    tags
  });

  if (input.adminNote) {
    await AdminNoteModel.create({ userId: user._id, note: input.adminNote, visibility: 'internal' });
  }

  await recordAdminAction({
    ...actor,
    actionType: 'user_created',
    targetType: 'user',
    targetId: toId(user._id),
    description: `Created HQ user ${input.displayName}.`,
    metadata: { username: input.username, role: input.role ?? 'player', tags }
  });

  return mapUser(user.toObject(), profile.toObject());
};

export const updateHqUser = async (userId: string, input: { status?: string; role?: string; displayName?: string; email?: string }, actor?: ActorContext) => {
  const user = await HQUserModel.findByIdAndUpdate(userId, { $set: input }, { new: true, runValidators: true }).lean();
  if (!user) {
    throw new AppError('User not found', 404);
  }
  if (input.displayName || input.email) {
    await UserProfileModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...(input.displayName ? { displayName: input.displayName } : {}),
          ...(input.email ? { 'contact.email': input.email } : {})
        }
      },
      { new: true }
    );
  }
  await recordAdminAction({
    ...actor,
    actionType: input.status === 'suspended' ? 'user_suspended' : 'user_updated',
    targetType: 'user',
    targetId: userId,
    description: `Updated HQ user ${user.displayName}.`,
    metadata: { changes: input }
  });
  const profile = await UserProfileModel.findOne({ userId }).lean();
  return mapUser(user, profile);
};

export const updateHqUserTags = async (userId: string, input: { add?: string[]; remove?: string[]; set?: string[] }, actor?: ActorContext) => {
  const user = await HQUserModel.findById(userId).lean();
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const profile = await UserProfileModel.findOne({ userId });
  if (!profile) {
    throw new AppError('User profile not found', 404);
  }

  const current = new Set<string>((profile.tags ?? []) as string[]);
  if (input.set) {
    current.clear();
    input.set.filter((tag) => tagSet.has(tag)).forEach((tag) => current.add(tag));
  }
  (input.add ?? []).filter((tag) => tagSet.has(tag)).forEach((tag) => current.add(tag));
  (input.remove ?? []).forEach((tag) => current.delete(tag));

  profile.tags = Array.from(current) as any;
  await profile.save();
  await recordAdminAction({
    ...actor,
    actionType: 'user_updated',
    targetType: 'user',
    targetId: userId,
    description: `Updated tags for ${user.displayName}.`,
    metadata: { tags: profile.tags, add: input.add, remove: input.remove, set: input.set }
  });

  return mapUser(user, profile.toObject());
};

export const createHqAdminNote = async (input: { userId: string; note: string; visibility?: string }, actor?: ActorContext) => {
  const user = await HQUserModel.findById(input.userId).lean();
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const note = await AdminNoteModel.create(input);
  await recordAdminAction({
    ...actor,
    actionType: 'note_added',
    targetType: 'user',
    targetId: input.userId,
    description: `Added admin note for ${user.displayName}.`,
    metadata: { visibility: input.visibility ?? 'internal' }
  });
  return {
    id: toId(note._id),
    userId: toId(note.userId),
    note: note.note,
    visibility: note.visibility,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  };
};

export const createHqCrib = async (input: Record<string, unknown>, actor?: ActorContext) => {
  const crib = await CribModel.create(input);
  await recordAdminAction({
    ...actor,
    actionType: 'crib_created',
    targetType: 'crib',
    targetId: toId(crib._id),
    description: `Created crib ${crib.cribName}.`,
    metadata: input
  });
  return mapCrib(crib.toObject(), 0);
};

export const listHqCribs = async (input?: { status?: string }) => {
  const query = input?.status ? { status: input.status } : {};
  const cribs = await CribModel.find(query).sort({ growthPriority: -1, updatedAt: -1 }).lean();
  const counts = await TableModel.aggregate([{ $group: { _id: '$cribId', count: { $sum: 1 } } }]);
  const countByCrib = new Map(counts.map((row) => [toId(row._id), row.count]));
  return cribs.map((crib) => mapCrib(crib, countByCrib.get(toId(crib._id)) ?? 0));
};

export const updateHqCrib = async (cribId: string, input: Record<string, unknown>, actor?: ActorContext) => {
  const crib = await CribModel.findByIdAndUpdate(cribId, { $set: input }, { new: true, runValidators: true }).lean();
  if (!crib) {
    throw new AppError('Crib not found', 404);
  }
  await recordAdminAction({
    ...actor,
    actionType: 'crib_updated',
    targetType: 'crib',
    targetId: cribId,
    description: `Updated crib ${crib.cribName}.`,
    metadata: { changes: input }
  });
  const tableCount = await TableModel.countDocuments({ cribId });
  return mapCrib(crib, tableCount);
};

export const createHqTable = async (input: Record<string, unknown>, actor?: ActorContext) => {
  const table = await TableModel.create(input);
  await recordAdminAction({
    ...actor,
    actionType: 'table_created',
    targetType: 'table',
    targetId: toId(table._id),
    description: `Created table ${table.tableName}.`,
    metadata: input
  });
  const populated = await TableModel.findById(table._id).populate('cribId', 'cribName').lean();
  return mapTable(populated ?? table.toObject());
};

export const listHqTables = async (input?: { status?: string; cribId?: string }) => {
  const query: Record<string, unknown> = {};
  if (input?.status) query.status = input.status;
  if (input?.cribId) query.cribId = input.cribId;
  const tables = await TableModel.find(query).populate('cribId', 'cribName').sort({ priority: -1, updatedAt: -1 }).lean();
  return tables.map(mapTable);
};

export const updateHqTable = async (tableId: string, input: Record<string, unknown>, actor?: ActorContext) => {
  const table = await TableModel.findByIdAndUpdate(tableId, { $set: input }, { new: true, runValidators: true })
    .populate('cribId', 'cribName')
    .lean();
  if (!table) {
    throw new AppError('Table not found', 404);
  }
  await recordAdminAction({
    ...actor,
    actionType: input.status === 'paused' ? 'table_paused' : 'table_updated',
    targetType: 'table',
    targetId: tableId,
    description: `Updated table ${table.tableName}.`,
    metadata: { changes: input }
  });
  return mapTable(table);
};

export const listHqEvents = async (input?: { status?: string }) => {
  const query = input?.status ? { status: input.status } : {};
  const events = await HQEventModel.find(query).sort({ startTime: -1 }).lean();
  return events.map(mapEvent);
};

export const createHqEvent = async (input: Record<string, unknown>, actor?: ActorContext) => {
  const event = await HQEventModel.create(input);
  await recordAdminAction({
    ...actor,
    actionType: 'event_created',
    targetType: 'event',
    targetId: toId(event._id),
    description: `Created event ${event.eventName}.`,
    metadata: input
  });
  return mapEvent(event.toObject());
};

export const updateHqEvent = async (eventId: string, input: Record<string, unknown>, actor?: ActorContext) => {
  const event = await HQEventModel.findByIdAndUpdate(eventId, { $set: input }, { new: true, runValidators: true }).lean();
  if (!event) {
    throw new AppError('Event not found', 404);
  }
  const actionType = input.status === 'running' ? 'event_started' : input.status === 'completed' ? 'event_ended' : 'event_created';
  await recordAdminAction({
    ...actor,
    actionType,
    targetType: 'event',
    targetId: eventId,
    description: `Updated event ${event.eventName}.`,
    metadata: { changes: input }
  });
  return mapEvent(event);
};

export const listHqGameIntelligenceSignals = async (input?: { status?: string; limit?: number }) => {
  const query = input?.status ? { status: input.status } : {};
  const signals = await GameIntelligenceSignalModel.find(query).sort({ occurredAt: -1 }).limit(input?.limit ?? 50).lean();
  return signals.map(mapSignal);
};

export const createHqGameIntelligenceSignal = async (input: Record<string, any>, actor?: ActorContext) => {
  const sourceType = input.sourceType ?? input.source;
  const signal = await GameIntelligenceSignalModel.create({
    signalType: input.signalType,
    source: sourceType,
    sourceType,
    sourceId: input.sourceId,
    targetUserId: input.playerId ?? input.targetUserId,
    playerId: input.playerId ?? input.targetUserId,
    targetTableId: input.tableId ?? input.targetTableId,
    tableId: input.tableId ?? input.targetTableId,
    targetCribId: input.cribId ?? input.targetCribId,
    cribId: input.cribId ?? input.targetCribId,
    targetEventId: input.eventId ?? input.targetEventId,
    eventId: input.eventId ?? input.targetEventId,
    title: input.title,
    description: input.description,
    summary: input.title ?? input.description,
    details: input.metadata ?? input.details ?? {},
    metadata: input.metadata ?? input.details ?? {},
    severity: input.severity ?? 'medium',
    confidence: input.confidence ?? 50,
    visibilitySafe: input.visibilitySafe ?? true,
    occurredAt: input.occurredAt ?? new Date(),
    status: input.status ?? 'new'
  });
  await recordAdminAction({
    ...actor,
    actionType: 'growth_play_created',
    targetType: 'game_intelligence_signal',
    targetId: toId(signal._id),
    description: `Created Game Intelligence signal ${signal.signalType}.`,
    metadata: { signalType: signal.signalType, sourceType }
  });
  return mapSignal(signal.toObject());
};

export const listHqGrowthPlays = async (input?: { status?: string; limit?: number }) => {
  const query = input?.status ? { status: input.status } : {};
  const plays = await GrowthPlayModel.find(query).sort({ finalScore: -1, createdAt: -1 }).limit(input?.limit ?? 50).lean();
  return plays.map(mapGrowthPlay);
};

export const updateHqGrowthPlayStatus = async (playId: string, status: string, actor?: ActorContext) => {
  const play = await GrowthPlayModel.findByIdAndUpdate(playId, { $set: { status } }, { new: true, runValidators: true }).lean();
  if (!play) {
    throw new AppError('Growth Play not found', 404);
  }
  await recordAdminAction({
    ...actor,
    actionType: status === 'approved' ? 'growth_play_approved' : status === 'dismissed' ? 'growth_play_dismissed' : 'growth_play_created',
    targetType: 'growth_play',
    targetId: playId,
    description: `Changed Growth Play "${play.title}" to ${status}.`,
    metadata: { status }
  });
  return mapGrowthPlay(play);
};
