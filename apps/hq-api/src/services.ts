import { explainGrowthPlay, scoreGrowthPlay } from '@reemteam/intelligence';
import { CampaignType, GrowthPlayType, SignalType } from '@reemteam/shared';
import { Operator } from './auth.js';
import { logAdminAction } from './audit.js';
import {
  AdminActionLog,
  Campaign,
  ContentDraft,
  Crib,
  Event,
  GameIntelligenceSignal,
  GrowthPlay,
  SupportIssue,
  Table,
  User,
  WalletLedger
} from './models.js';

const id = (value: unknown) => String(value ?? '');
const now = () => new Date();

export const serialize = (document: any) => {
  const source = typeof document?.toObject === 'function' ? document.toObject() : document;
  if (!source) return source;
  return {
    ...source,
    id: id(source._id),
    _id: undefined,
    __v: undefined
  };
};

export const getCommandCenter = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [activePlayersToday, gamesPlayedToday, tablesActiveNow, hottestCrib, latestReem, biggestPayout, topPlayer, growthPlays, supportIssues] =
    await Promise.all([
      User.countDocuments({ lastActiveAt: { $gte: today } }),
      GameIntelligenceSignal.countDocuments({ sourceType: 'gameplay', occurredAt: { $gte: today } }),
      Table.countDocuments({ status: 'active' }),
      Crib.findOne({ status: 'active' }).sort({ growthPriority: -1 }).lean(),
      GameIntelligenceSignal.findOne({ signalType: 'reem_detected' }).sort({ occurredAt: -1 }).lean(),
      GameIntelligenceSignal.findOne({ signalType: 'big_payout_detected' }).sort({ 'metadata.amount': -1 }).lean(),
      User.findOne().sort({ wins: -1, reems: -1 }).lean(),
      GrowthPlay.find({ status: 'open' }).sort({ finalScore: -1 }).limit(5).lean(),
      SupportIssue.countDocuments({ status: 'open' })
    ]);

  return {
    product: 'ReemTeamHQ',
    sentence: 'ReemTeamHQ is the command center that turns ReemTeam activity into smarter operations, stronger player management, and real growth moves.',
    loop: ['Game Activity', 'HQ Intelligence', 'Recommended Action', 'Operator Approval', 'Execution', 'Performance Feedback', 'Smarter Recommendations'],
    metrics: [
      { label: 'Active players today', value: activePlayersToday, tone: 'green' },
      { label: 'Games played today', value: gamesPlayedToday, tone: 'gold' },
      { label: 'Tables active now', value: tablesActiveNow, tone: 'blue' },
      { label: 'Hottest crib', value: hottestCrib?.cribName ?? 'None yet', tone: 'purple' },
      { label: 'Latest Reem', value: latestReem?.title ?? 'Waiting for signal', tone: 'gold' },
      { label: 'Biggest payout', value: biggestPayout?.title ?? 'Waiting for signal', tone: 'green' },
      { label: 'Top player', value: topPlayer?.displayName ?? 'None yet', tone: 'blue' },
      { label: 'Support issues', value: supportIssues, tone: supportIssues ? 'orange' : 'green' }
    ],
    recommendedActions: growthPlays.map(serialize),
    urgentAlerts: growthPlays.filter((play) => play.urgency === 'critical' || play.urgency === 'high').map(serialize),
    bestGrowthMove: growthPlays[0] ? serialize(growthPlays[0]) : null,
    systemHealth: 'Healthy'
  };
};

export const getSystemHealth = async () => {
  const [users, tables, cribs, events, signals, growthPlays] = await Promise.all([
    User.countDocuments(),
    Table.countDocuments(),
    Crib.countDocuments(),
    Event.countDocuments(),
    GameIntelligenceSignal.countDocuments(),
    GrowthPlay.countDocuments()
  ]);
  return {
    status: 'Healthy',
    checks: [
      { component: 'API', status: 'Healthy', detail: 'Express API is responding.' },
      { component: 'Database', status: 'Healthy', detail: 'MongoDB queries completed.' },
      { component: 'Redis/jobs', status: 'Warning', detail: 'Redis is configured for worker expansion but no worker is required for this clean slate yet.' },
      { component: 'Game data ingestion', status: signals > 0 ? 'Healthy' : 'Warning', detail: `${signals} intelligence signals stored.` },
      { component: 'Publishing', status: 'Warning', detail: 'Publishing adapters are intentionally stubbed until credentials are connected.' }
    ],
    counts: { users, tables, cribs, events, signals, growthPlays }
  };
};

export const createGrowthPlayFromSignal = async (actor: Operator, signalId: string, input: Partial<{ playType: GrowthPlayType; activeCampaign: CampaignType }>) => {
  const signal = await GameIntelligenceSignal.findById(signalId);
  if (!signal) throw new Error('Signal not found');
  const playType = input.playType ?? inferPlayType(signal.signalType as SignalType);
  const score = scoreGrowthPlay({
    playType,
    signalTypes: [signal.signalType as SignalType],
    confidence: signal.confidence,
    occurredAt: signal.occurredAt,
    visibilitySafe: signal.visibilitySafe,
    activeCampaign: input.activeCampaign,
    hasRiskFlags: signal.signalType === 'suspicious_activity_detected'
  });
  const recommendedAction = recommendedActionFor(playType);
  const whyThis = explainGrowthPlay({
    signalTitles: [signal.title],
    scoreParts: score.scoreParts,
    activeCampaign: input.activeCampaign,
    recommendedAction,
    visibilitySafe: signal.visibilitySafe,
    riskFlags: signal.signalType === 'suspicious_activity_detected' ? ['suspicious_activity'] : []
  });
  const play = await GrowthPlay.create({
    title: signal.title,
    goal: goalFor(playType),
    playType,
    sourceSignalIds: [signal._id],
    targetUserId: signal.playerId,
    targetCribId: signal.cribId,
    targetTableId: signal.tableId,
    targetEventId: signal.eventId,
    recommendedAction,
    recommendedChannel: playType === 'risk_review' ? 'Support' : 'Content Studio',
    recommendedFormat: playType === 'risk_review' ? 'Admin alert' : 'IG Story',
    whyItMatters: signal.description,
    whyThis,
    urgency: score.urgency,
    confidence: signal.confidence,
    estimatedValue: score.finalScore * 10,
    scoreParts: score.scoreParts,
    finalScore: score.finalScore,
    riskFlags: signal.signalType === 'suspicious_activity_detected' ? ['suspicious_activity'] : [],
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });
  signal.status = 'converted';
  await signal.save();
  await logAdminAction(actor, {
    actionType: 'growth_play_created',
    targetType: 'growth_play',
    targetId: id(play._id),
    description: `Created Growth Play "${play.title}".`,
    metadata: { signalId }
  });
  return serialize(play);
};

export const buildContentDraft = async (actor: Operator, growthPlayId: string) => {
  const play = await GrowthPlay.findById(growthPlayId);
  if (!play) throw new Error('Growth Play not found');
  const draft = await ContentDraft.create({
    growthPlayId: play._id,
    title: play.title,
    format: play.recommendedFormat,
    channel: play.recommendedChannel,
    hook: play.title,
    caption: `${play.whyItMatters} ${play.recommendedAction}`,
    overlayText: play.title,
    cta: 'Join the action',
    status: 'needs_review'
  });
  play.status = 'approved';
  await play.save();
  await logAdminAction(actor, {
    actionType: 'content_created',
    targetType: 'content_draft',
    targetId: id(draft._id),
    description: `Built Content Studio draft from "${play.title}".`,
    metadata: { growthPlayId }
  });
  return serialize(draft);
};

export const logStatusAction = async (actor: Operator, targetType: string, targetId: string, actionType: string, description: string, metadata?: Record<string, unknown>) => {
  await logAdminAction(actor, { actionType, targetType, targetId, description, metadata });
};

export const dashboardCollections = {
  users: User,
  cribs: Crib,
  tables: Table,
  events: Event,
  signals: GameIntelligenceSignal,
  growthPlays: GrowthPlay,
  campaigns: Campaign,
  contentDrafts: ContentDraft,
  wallet: WalletLedger,
  support: SupportIssue,
  adminActions: AdminActionLog
};

const inferPlayType = (signalType: SignalType): GrowthPlayType => {
  if (signalType === 'crib_heating_up_detected') return 'crib_promo';
  if (signalType === 'hot_table_detected' || signalType === 'dead_table_detected') return 'table_fill';
  if (signalType === 'referral_momentum_detected') return 'referral_push';
  if (signalType === 'inactive_player_segment_detected') return 'player_reactivation';
  if (signalType === 'suspicious_activity_detected') return 'risk_review';
  if (signalType === 'leaderboard_jump_detected') return 'leaderboard_story';
  return 'gameplay_highlight';
};

const recommendedActionFor = (playType: GrowthPlayType) =>
  ({
    gameplay_highlight: 'Create a highlight and feature it in the lobby.',
    crib_promo: 'Promote the crib and raise its lobby priority.',
    table_fill: 'Feature the table and send an in-app nudge.',
    event_promo: 'Boost the event and schedule a reminder.',
    leaderboard_story: 'Feature the leaderboard movement.',
    referral_push: 'Push the referral reward today.',
    player_reactivation: 'Send a reactivation message to the segment.',
    new_player_activation: 'Guide new players toward a low-stake table.',
    vip_highlight: 'Feature the VIP if content-safe.',
    support_alert: 'Alert support and link the issue to the player profile.',
    admin_alert: 'Notify operators for review.',
    content_recommendation: 'Build a Content Studio draft.',
    risk_review: 'Review suspicious behavior before public action.'
  })[playType];

const goalFor = (playType: GrowthPlayType) =>
  ({
    gameplay_highlight: 'Turn gameplay heat into table joins.',
    crib_promo: 'Drive players into the right crib.',
    table_fill: 'Fill a table that needs momentum.',
    event_promo: 'Increase event participation.',
    leaderboard_story: 'Create competition and social proof.',
    referral_push: 'Increase referral conversions.',
    player_reactivation: 'Bring inactive players back.',
    new_player_activation: 'Help new players reach their first good session.',
    vip_highlight: 'Reward and retain high-value players.',
    support_alert: 'Protect player trust.',
    admin_alert: 'Keep operators ahead of risk.',
    content_recommendation: 'Create a useful promotional asset.',
    risk_review: 'Protect ReemTeam before amplifying activity.'
  })[playType];
