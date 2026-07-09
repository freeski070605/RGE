import { createHash } from 'crypto';
import { env } from '../../config/env';
import { ContentIdeaModel } from '../../db/models/ContentIdea';
import { GameSignalModel } from '../../db/models/GameSignal';
import { CribModel, TableModel } from '../../db/models/hq/GameOperations';
import { HQUserModel, UserProfileModel } from '../../db/models/hq/User';
import { LeaderboardSnapshotModel } from '../../db/models/LeaderboardSnapshot';
import { PlayerStatsDailyModel } from '../../db/models/PlayerStatsDaily';
import { buildOpportunityDraftFromSignal, isOperatorFacingSignal } from '../operator/opportunityRules';
import { AppError } from '../../utils/errors';
import { getDurationMs, logError, logInfo } from '../../utils/structuredLogger';
import { syncRgeFeedV3 } from './rgeFeedV3Service';

type WindowKey = '24h' | '7d' | '30d';

type BackendPlayerWindowStats = {
  matchesPlayed: number;
  wins: number;
  reems: number;
  regularWins: number;
  autoTripleWins: number;
  caughtDropWins: number;
  netPayout: number;
  grossPayout: number;
  biggestPayout: number;
  avgStake: number;
  highestStakeWin: number;
  depositCount: number;
  depositAmount: number;
  inviteCount: number;
  rewardedInvites: number;
  currentWinStreak: number;
  bestWinStreak: number;
};

type BackendFeed = {
  generatedAt: string;
  statsDate: string;
  windows: WindowKey[];
  summary: {
    totalPlayers: number;
    totalCompletedMatches: number;
    totalTables?: number;
    totalPromoTables?: number;
    totalSignals: number;
  };
  players: Array<{
    playerId: string;
    username: string;
    vipStatus: string;
    vipSince: string | null;
    windows: Record<WindowKey, BackendPlayerWindowStats>;
  }>;
  leaderboards: Array<{
    metric: string;
    window: WindowKey;
    title: string;
    description: string;
    rankings: Array<{
      rank: number;
      playerId: string;
      username: string;
      value: number;
      secondaryValue?: number;
      metadata?: Record<string, unknown>;
    }>;
  }>;
  tables?: Array<{
    tableId: string;
    name: string;
    mode?: string;
    stake?: number;
    status?: string;
    isPrivate?: boolean;
    isPromo?: boolean;
    minPlayers?: number;
    maxPlayers?: number;
    currentPlayerCount?: number;
    activeContestId?: string | null;
    currentMatchId?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    players?: Array<{
      playerId: string;
      username: string;
      isAI: boolean;
      seat: number;
      avatarUrl?: string;
    }>;
  }>;
  signals: Array<{
    signalType: string;
    sourceType: string;
    sourceId: string;
    playerId?: string;
    username?: string;
    tableId?: string;
    tableName?: string;
    matchId?: string;
    mode?: string;
    stake?: number;
    amount?: number;
    occurredAt: string;
    window: WindowKey;
    metadata?: Record<string, unknown>;
    scores?: {
      noveltyScore?: number;
      performancePotentialScore?: number;
      brandFitScore?: number;
      urgencyScore?: number;
      overallPriorityScore?: number;
    };
    recommendedPlatforms?: string[];
  }>;
};

const fetchBackendFeed = async (days = env.RGE_SYNC_DAYS): Promise<BackendFeed> => {
  const headers: Record<string, string> = {};
  if (env.BACKEND_INTERNAL_TOKEN) {
    headers['x-rge-token'] = env.BACKEND_INTERNAL_TOKEN;
  }

  const backendBaseUrl = env.BACKEND_API_BASE_URL.replace(/\/+$/, '');
  let response: Response;

  try {
    response = await fetch(`${backendBaseUrl}/api/rge/feed?days=${days}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(env.BACKEND_HEALTH_TIMEOUT_MS)
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown backend sync error';
    throw new AppError(
      `Failed to reach the live ReemTeam backend feed at ${backendBaseUrl}. Check BACKEND_API_BASE_URL, BACKEND_INTERNAL_TOKEN, and backend availability. ${detail}`,
      502
    );
  }

  if (!response.ok) {
    const message = await response.text();
    throw new AppError(
      `Failed to sync the live ReemTeam backend feed at ${backendBaseUrl}: ${message || response.statusText}`,
      response.status
    );
  }

  return (await response.json()) as BackendFeed;
};

const scoreSignal = (signal: BackendFeed['signals'][number]) => ({
  noveltyScore: signal.scores?.noveltyScore ?? 50,
  performancePotentialScore: signal.scores?.performancePotentialScore ?? 50,
  brandFitScore: signal.scores?.brandFitScore ?? 50,
  urgencyScore: signal.scores?.urgencyScore ?? 50,
  overallPriorityScore: signal.scores?.overallPriorityScore ?? 50
});

const toMongoObjectIdString = (value: string) =>
  /^[a-f\d]{24}$/i.test(value) ? value : createHash('sha1').update(value).digest('hex').slice(0, 24);

const mapBackendRoleToHqRole = (role?: string) => {
  if (['owner', 'admin', 'operator', 'moderator', 'support', 'player'].includes(role ?? '')) {
    return role;
  }

  if (role === 'superadmin') {
    return 'owner';
  }

  if (role === 'user') {
    return 'player';
  }

  return 'player';
};

const getCribIdentityForBackendTable = (table: NonNullable<BackendFeed['tables']>[number]) => {
  if (table.isPrivate) {
    return {
      cribName: 'Da Crown Room',
      description: 'Invite-only crew tables, rivalries, and high-intent social play.',
      stakeTier: 'private',
      theme: 'crown',
      growthPriority: 90
    };
  }

  const stake = Number(table.stake ?? 0);
  if (stake <= 1) {
    return {
      cribName: 'The Basement',
      description: 'Fast hands and new-player friendly tables.',
      stakeTier: 'low',
      theme: 'basement',
      growthPriority: 70
    };
  }

  if (stake <= 10) {
    return {
      cribName: 'The Back Room',
      description: 'Mid-stakes tables for players who know when to drop.',
      stakeTier: 'mid',
      theme: 'back_room',
      growthPriority: 76
    };
  }

  if (stake <= 50) {
    return {
      cribName: 'Kitchen Table',
      description: 'Bigger swings, strong table talk, and visible momentum.',
      stakeTier: 'high',
      theme: 'kitchen_table',
      growthPriority: 84
    };
  }

  return {
    cribName: 'Da Crown Room',
    description: 'High-stakes tables for VIPs, Reems, and serious social proof.',
    stakeTier: 'vip',
    theme: 'crown',
    growthPriority: 95
  };
};

const mapBackendTableStatusToHq = (status?: string) => {
  if (status === 'in-game') {
    return 'active';
  }

  if (status === 'waiting') {
    return 'open';
  }

  return 'open';
};

const syncHqCoreDataFromBackendFeed = async (feed: BackendFeed) => {
  const latestWindow = '30d' as WindowKey;

  const userOperations = feed.players.map((player) => {
    const stats = player.windows?.[latestWindow] ?? player.windows?.['24h'];
    const userId = toMongoObjectIdString(player.playerId);
    return {
      updateOne: {
        filter: { _id: userId },
        update: {
          $setOnInsert: {
            _id: userId
          },
          $set: {
            username: player.username,
            displayName: player.username,
            status: 'active',
            role: mapBackendRoleToHqRole((player as any).role)
          }
        },
        upsert: true
      }
    };
  });

  const profileOperations = feed.players.map((player) => {
    const stats = player.windows?.[latestWindow] ?? player.windows?.['24h'];
    const userId = toMongoObjectIdString(player.playerId);
    const tags = [
      stats?.matchesPlayed ? null : 'new_player',
      (stats?.wins ?? 0) >= 3 || (stats?.currentWinStreak ?? 0) >= 3 ? 'hot_player' : null,
      player.vipStatus === 'ACTIVE' ? 'vip' : null,
      (stats?.highestStakeWin ?? 0) >= 25 || (stats?.avgStake ?? 0) >= 25 ? 'high_stakes' : null,
      (stats?.inviteCount ?? 0) >= 2 ? 'strong_referrer' : null,
      (stats?.matchesPlayed ?? 0) === 0 ? 'inactive' : null,
      (stats?.wins ?? 0) > 0 || (stats?.reems ?? 0) > 0 ? 'content_safe' : null
    ].filter(Boolean);

    return {
      updateOne: {
        filter: { userId },
        update: {
          $set: {
            userId,
            displayName: player.username,
            contact: {},
            tags,
            lastActiveAt: feed.generatedAt ? new Date(feed.generatedAt) : new Date(),
            gamesPlayed: stats?.matchesPlayed ?? 0,
            wins: stats?.wins ?? 0,
            losses: Math.max(0, (stats?.matchesPlayed ?? 0) - (stats?.wins ?? 0)),
            reems: stats?.reems ?? 0,
            drops: 0,
            caughtDrops: stats?.caughtDropWins ?? 0,
            averageStake: stats?.avgStake ?? 0,
            highestStake: stats?.highestStakeWin ?? 0,
            referralCount: stats?.inviteCount ?? 0,
            walletSummary: {
              balanceCents: 0,
              pendingCents: 0,
              lifetimeCreditsCents: Math.round((stats?.grossPayout ?? 0) * 100)
            },
            riskFlags: []
          }
        },
        upsert: true
      }
    };
  });

  const cribByName = new Map<string, ReturnType<typeof getCribIdentityForBackendTable>>();
  for (const table of feed.tables ?? []) {
    const crib = getCribIdentityForBackendTable(table);
    cribByName.set(crib.cribName, crib);
  }

  const cribDocs = await Promise.all(
    [...cribByName.values()].map((crib) =>
      CribModel.findOneAndUpdate(
        { cribName: crib.cribName },
        {
          $set: {
            ...crib,
            status: 'active',
            featured: crib.growthPriority >= 90,
            eventEligible: true,
            visualStyle: {
              source: 'reemteam_frontend_crib_identity'
            }
          }
        },
        { upsert: true, new: true }
      )
    )
  );
  const cribIdByName = new Map(cribDocs.map((crib) => [crib.cribName, crib._id]));

  const tableOperations = (feed.tables ?? []).map((table) => {
    const crib = getCribIdentityForBackendTable(table);
    const cribId = cribIdByName.get(crib.cribName);
    const tableId = toMongoObjectIdString(table.tableId);
    return {
      updateOne: {
        filter: { _id: tableId },
        update: {
          $setOnInsert: {
            _id: tableId
          },
          $set: {
            tableName: table.name,
            cribId,
            stake: table.stake ?? 0,
            maxSeats: table.maxPlayers ?? 4,
            status: mapBackendTableStatusToHq(table.status),
            visibility: table.isPrivate ? 'private' : 'public',
            eventTable: Boolean(table.activeContestId),
            aiFillEnabled: Boolean(table.players?.some((player) => player.isAI)),
            minimumBalance: table.stake ?? 0,
            ruleset: table.mode ?? 'standard',
            theme: crib.theme,
            priority: Math.round((table.currentPlayerCount ?? 0) * 15 + (table.stake ?? 0) + crib.growthPriority),
            featuredAt: table.isPromo ? new Date(table.updatedAt ?? feed.generatedAt) : undefined
          }
        },
        upsert: true
      }
    };
  });

  if (userOperations.length) {
    await HQUserModel.bulkWrite(userOperations as any);
  }
  if (profileOperations.length) {
    await UserProfileModel.bulkWrite(profileOperations as any);
  }
  if (tableOperations.length) {
    await TableModel.bulkWrite(tableOperations as any);
  }

  return {
    hqUsers: userOperations.length,
    hqProfiles: profileOperations.length,
    hqCribs: cribDocs.length,
    hqTables: tableOperations.length
  };
};

export const syncGameIntelligence = async (days = env.RGE_SYNC_DAYS) => {
  const startedAt = Date.now();
  logInfo({
    area: 'sync',
    action: 'sync-game-intelligence',
    status: 'started',
    message: 'Starting live backend intelligence sync',
    days
  });

  try {
    const feed = await fetchBackendFeed(days);
    const hqCoreSync = await syncHqCoreDataFromBackendFeed(feed);

    const playerOperations = feed.players.flatMap((player) =>
      feed.windows.map((window) => ({
        updateOne: {
          filter: {
            date: feed.statsDate,
            window,
            playerId: player.playerId
          },
          update: {
            $set: {
              date: feed.statsDate,
              window,
              playerId: player.playerId,
              username: player.username,
              vipStatus: player.vipStatus,
              ...player.windows[window],
              metadata: {
                vipSince: player.vipSince
              }
            }
          },
          upsert: true
        }
      }))
    );

    if (playerOperations.length) {
      await PlayerStatsDailyModel.bulkWrite(playerOperations);
    }

    await Promise.all(
      feed.leaderboards.map((leaderboard) =>
        LeaderboardSnapshotModel.findOneAndUpdate(
          {
            metric: leaderboard.metric,
            window: leaderboard.window,
          },
          {
            $set: {
              metric: leaderboard.metric,
              window: leaderboard.window,
              title: leaderboard.title,
              description: leaderboard.description,
              generatedAt: new Date(feed.generatedAt),
              rankings: leaderboard.rankings
            }
          },
          { upsert: true, new: true }
        )
      )
    );

    await Promise.all(
      feed.signals.map((signal) =>
        GameSignalModel.findOneAndUpdate(
          {
            signalType: signal.signalType,
            sourceType: signal.sourceType,
            sourceId: signal.sourceId
          },
          {
            $setOnInsert: {
              status: 'new' as const
            },
            $set: {
              signalType: signal.signalType,
              sourceType: signal.sourceType,
              sourceId: signal.sourceId,
              playerId: signal.playerId,
              username: signal.username,
              tableId: signal.tableId,
              tableName: signal.tableName,
              matchId: signal.matchId,
              mode: signal.mode,
              stake: signal.stake,
              amount: signal.amount,
              occurredAt: new Date(signal.occurredAt),
              window: signal.window,
              metadata: signal.metadata ?? {},
              scores: scoreSignal(signal),
              recommendedPlatforms: signal.recommendedPlatforms?.length ? signal.recommendedPlatforms : ['instagram']
            }
          },
          { upsert: true, new: true }
        )
      )
    );

    const existingIdeas = await ContentIdeaModel.find()
      .select('signalIds')
      .lean();
    const coveredSignalIds = new Set(existingIdeas.flatMap((idea: any) => (idea.signalIds ?? []).map((id: any) => String(id))));

    const eligibleSignals = await GameSignalModel.find({
      status: { $in: ['new', 'ranked'] }
    })
      .sort({ 'scores.overallPriorityScore': -1, occurredAt: -1 })
      .limit(40);

    const signalsNeedingIdeas = eligibleSignals.filter((signal) => !coveredSignalIds.has(String(signal._id)));
    const ideaDocs = signalsNeedingIdeas
      .filter((signal) => !coveredSignalIds.has(String(signal._id)) && isOperatorFacingSignal(signal.signalType))
      .map((signal) => ({
        ...buildOpportunityDraftFromSignal({
          signalType: signal.signalType,
          sourceType: signal.sourceType,
          sourceId: signal.sourceId,
          playerId: signal.playerId ?? undefined,
          username: signal.username ?? undefined,
          tableId: signal.tableId ?? undefined,
          tableName: signal.tableName ?? undefined,
          matchId: signal.matchId ?? undefined,
          mode: signal.mode ?? undefined,
          stake: signal.stake ?? undefined,
          amount: signal.amount ?? undefined,
          occurredAt: signal.occurredAt.toISOString(),
          window: signal.window as WindowKey,
          metadata: (signal.metadata as Record<string, unknown>) ?? {},
          scores: signal.scores as Record<string, number>,
          recommendedPlatforms: signal.recommendedPlatforms
        }),
        signalIds: [signal._id]
      }))
      .filter(Boolean);

    if (ideaDocs.length) {
      await ContentIdeaModel.insertMany(ideaDocs);
      await GameSignalModel.updateMany(
        {
          _id: { $in: signalsNeedingIdeas.map((signal) => signal._id) }
        },
        {
          $set: {
            status: 'idea_created'
          }
        }
      );
    }

    const v3 = await syncRgeFeedV3({ days, preloadedFeed: feed });

    const result = {
      syncedAt: new Date().toISOString(),
      summary: feed.summary,
      upsertedPlayerSnapshots: playerOperations.length,
      upsertedLeaderboards: feed.leaderboards.length,
      upsertedSignals: feed.signals.length,
      createdIdeas: ideaDocs.length,
      hqCoreSync,
      v3
    };

    logInfo({
      area: 'sync',
      action: 'sync-game-intelligence',
      status: 'completed',
      durationMs: getDurationMs(startedAt),
      message: 'Live backend intelligence sync completed',
      ...result
    });

    return result;
  } catch (error) {
    logError({
      area: 'sync',
      action: 'sync-game-intelligence',
      status: 'failed',
      durationMs: getDurationMs(startedAt),
      error: error instanceof Error ? error.message : 'Live backend sync failed',
      message: 'Live backend intelligence sync failed'
    });
    throw error;
  }
};

export const listPlayerSnapshots = async (input?: { window?: WindowKey; limit?: number }) => {
  const window = input?.window ?? '24h';
  const limit = input?.limit ?? 30;
  const latestDateDoc = await PlayerStatsDailyModel.findOne({ window }).sort({ date: -1 }).lean();
  if (!latestDateDoc) {
    return [];
  }

  const rows = await PlayerStatsDailyModel.find({
    window,
    date: latestDateDoc.date
  })
    .sort({ netPayout: -1, wins: -1 })
    .limit(limit)
    .lean();

  return rows.map((row) => ({
    id: String(row._id),
    date: row.date,
    window: row.window,
    playerId: row.playerId,
    username: row.username,
    vipStatus: row.vipStatus,
    matchesPlayed: row.matchesPlayed,
    wins: row.wins,
    reems: row.reems,
    netPayout: row.netPayout,
    biggestPayout: row.biggestPayout,
    depositAmount: row.depositAmount,
    currentWinStreak: row.currentWinStreak,
    bestWinStreak: row.bestWinStreak
  }));
};

export const listLeaderboards = async (window?: WindowKey) => {
  const query = window ? { window } : {};
  const rows = await LeaderboardSnapshotModel.find(query).sort({ generatedAt: -1, metric: 1 }).lean();
  return rows.map((row) => ({
    id: String(row._id),
    metric: row.metric,
    window: row.window,
    title: row.title,
    description: row.description,
    generatedAt: row.generatedAt,
    rankings: row.rankings ?? []
  }));
};

export const listSignals = async (input?: { status?: string; limit?: number }) => {
  const query = input?.status ? { status: input.status } : {};
  const limit = input?.limit ?? 50;

  const signals = await GameSignalModel.find(query)
    .sort({ 'scores.overallPriorityScore': -1, occurredAt: -1 })
    .limit(limit)
    .lean();

  return signals.map((signal) => ({
    id: String(signal._id),
    signalType: signal.signalType,
    sourceType: signal.sourceType,
    sourceId: signal.sourceId,
    playerId: signal.playerId,
    username: signal.username,
    tableId: signal.tableId,
    tableName: signal.tableName,
    matchId: signal.matchId,
    mode: signal.mode,
    stake: signal.stake,
    amount: signal.amount,
    occurredAt: signal.occurredAt,
    window: signal.window,
    metadata: (signal.metadata as Record<string, unknown>) ?? {},
    scores: signal.scores,
    recommendedPlatforms: signal.recommendedPlatforms,
    status: signal.status
  }));
};

export const getIntelligenceOverview = async () => {
  const [signalCount, ideaCount, playerCount, leaderboards] = await Promise.all([
    GameSignalModel.countDocuments(),
    ContentIdeaModel.countDocuments(),
    PlayerStatsDailyModel.countDocuments(),
    listLeaderboards('24h')
  ]);

  return {
    totals: {
      signals: signalCount,
      ideas: ideaCount,
      playerSnapshots: playerCount,
      leaderboards: leaderboards.length
    },
    leaderboards
  };
};
