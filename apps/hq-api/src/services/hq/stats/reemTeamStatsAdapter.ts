import { ObjectId, type Db } from 'mongodb';

type AnyDoc = Record<string, any>;

const toNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const firstPositive = (source: AnyDoc, keys: string[]) => {
  for (const key of keys) {
    const value = toNumber(source[key]);
    if (value > 0) return value;
  }
  return 0;
};

export const mapProfileStats = (profile: AnyDoc | null, dailyStats: AnyDoc | null = null) => {
  const source = profile ?? {};
  const fallback = dailyStats ?? {};
  const gamesPlayed = firstPositive(source, ['gamesPlayed', 'matchesPlayed', 'gameCount', 'totalGames']) || toNumber(fallback.gamesPlayed);
  const wins = firstPositive(source, ['wins', 'winCount']) || toNumber(fallback.wins);
  const losses = firstPositive(source, ['losses', 'lossCount']) || toNumber(fallback.losses);

  return {
    gamesPlayed,
    matchesPlayed: gamesPlayed,
    wins,
    totalWins: wins,
    losses,
    winRate: gamesPlayed > 0 ? Number(((wins / gamesPlayed) * 100).toFixed(2)) : 0,
    reems: firstPositive(source, ['reems', 'reemCount']) || toNumber(fallback.reems),
    totalReems: firstPositive(source, ['reems', 'reemCount']) || toNumber(fallback.totalReems ?? fallback.reems),
    drops: firstPositive(source, ['drops', 'dropCount']) || toNumber(fallback.drops),
    caughtDrops: firstPositive(source, ['caughtDrops', 'caughtDropCount']) || toNumber(fallback.caughtDrops),
    referrals: firstPositive(source, ['referralCount', 'referrals']) || toNumber(fallback.referrals),
    totalWinnings: firstPositive(source, ['totalWinnings', 'winnings']) || toNumber(fallback.totalWinnings),
    usdEarned: toNumber(fallback.usdEarned),
    rtcEarned: toNumber(fallback.rtcEarned),
    usdNet: toNumber(fallback.usdNet),
    rtcNet: toNumber(fallback.rtcNet),
    biggestUsdPayout: toNumber(fallback.biggestUsdPayout),
    biggestRtcPayout: toNumber(fallback.biggestRtcPayout),
    averageStake: firstPositive(source, ['averageStake', 'avgStake']) || toNumber(fallback.averageStake),
    highestStake: firstPositive(source, ['highestStake', 'highestStakeWin']) || toNumber(fallback.highestStake),
    lastActiveAt: source.lastActiveAt ?? fallback.lastActiveAt ?? source.updatedAt
  };
};

export const getDailyStatsRollup = async (db: Db, playerId: unknown, username?: string) => {
  const collections = new Set((await db.listCollections().toArray()).map((collection) => collection.name));
  if (!collections.has('player_stats_daily')) return null;

  const id = String(playerId ?? '');
  const rows = await db.collection('player_stats_daily').find({
    $or: [
      { playerId },
      { playerId: id },
      ...(username ? [{ username }] : [])
    ]
  }).toArray();

  if (!rows.length) return null;
  const totals = rows.reduce((sum: AnyDoc, row) => {
    sum.gamesPlayed += toNumber(row.matchesPlayed);
    sum.wins += toNumber(row.wins);
    sum.losses = Math.max(0, sum.gamesPlayed - sum.wins);
    sum.reems += toNumber(row.reems);
    sum.caughtDrops += toNumber(row.caughtDropWins);
    sum.referrals += toNumber(row.inviteCount);
    sum.totalWinnings += toNumber(row.grossPayout);
    sum.highestStake = Math.max(sum.highestStake, toNumber(row.highestStakeWin));
    if (toNumber(row.avgStake) > 0) {
      sum.avgStakeTotal += toNumber(row.avgStake);
      sum.avgStakeRows += 1;
    }
    const date = row.date ? new Date(row.date) : undefined;
    if (date && !Number.isNaN(date.getTime()) && (!sum.lastActiveAt || date > sum.lastActiveAt)) sum.lastActiveAt = date;
    return sum;
  }, { gamesPlayed: 0, wins: 0, losses: 0, reems: 0, caughtDrops: 0, referrals: 0, totalWinnings: 0, highestStake: 0, avgStakeTotal: 0, avgStakeRows: 0, lastActiveAt: undefined });

  return {
    ...totals,
    averageStake: totals.avgStakeRows ? totals.avgStakeTotal / totals.avgStakeRows : 0
  };
};

const USD_GAME_MODES = new Set(['PRIVATE_USD_TABLE', 'USD_CONTEST']);

export const getMatchStatsRollup = async (db: Db, playerId: unknown, username?: string) => {
  const collections = new Set((await db.listCollections().toArray()).map((collection) => collection.name));
  if (!collections.has('matches')) return null;
  const playerIdString = String(playerId ?? '');
  const playerIdQuery = ObjectId.isValid(playerIdString) ? [playerId, playerIdString, new ObjectId(playerIdString)] : [playerId, playerIdString];
  const playerClauses: AnyDoc[] = [{ 'players.userId': { $in: playerIdQuery } }];
  if (username) playerClauses.push({ 'players.username': username });

  const matches = await db.collection('matches').find({
    status: 'completed',
    $or: playerClauses
  }).project({ tableId: 1, players: 1, winner: 1, winType: 1, endTime: 1, updatedAt: 1, createdAt: 1 }).toArray();

  if (!matches.length) return null;

  const tableIds = [...new Set(matches.map((match) => String(match.tableId ?? '')).filter(Boolean))];
  const tables = collections.has('tables') && tableIds.length
    ? await db.collection('tables').find({ _id: { $in: tableIds.map((id) => (ObjectId.isValid(id) ? new ObjectId(id) : id)) as any[] } }).project({ mode: 1 }).toArray()
    : [];
  const tableModeById = new Map(tables.map((table) => [String(table._id), table.mode]));

  const summary = {
    gamesPlayed: 0,
    matchesPlayed: 0,
    wins: 0,
    totalWins: 0,
    losses: 0,
    reems: 0,
    totalReems: 0,
    winRate: 0,
    usdEarned: 0,
    rtcEarned: 0,
    usdNet: 0,
    rtcNet: 0,
    totalWinnings: 0,
    highestStake: 0,
    biggestUsdPayout: 0,
    biggestRtcPayout: 0,
    lastActiveAt: undefined as Date | undefined
  };

  for (const match of matches) {
    const player = Array.isArray(match.players)
      ? match.players.find((entry: AnyDoc) => String(entry.userId) === playerIdString || (username && entry.username === username))
      : null;
    if (!player) continue;

    const payout = toNumber(player.payout);
    const earned = Math.max(0, payout);
    const isUsdMode = USD_GAME_MODES.has(String(tableModeById.get(String(match.tableId ?? '')) ?? ''));
    const endTime = match.endTime ?? match.updatedAt ?? match.createdAt;
    const date = endTime ? new Date(endTime) : undefined;

    summary.gamesPlayed += 1;
    summary.matchesPlayed += 1;
    summary.highestStake = Math.max(summary.highestStake, toNumber(player.stake));
    const wonById = String(match.winner ?? '') === playerIdString;
    const wonByUsernameFallback = username && player.username === username && payout > 0;
    if (wonById || wonByUsernameFallback) {
      summary.wins += 1;
      summary.totalWins += 1;
      if (match.winType === 'REEM') summary.reems += 1;
      if (match.winType === 'REEM') summary.totalReems += 1;
    }
    if (date && !Number.isNaN(date.getTime()) && (!summary.lastActiveAt || date > summary.lastActiveAt)) {
      summary.lastActiveAt = date;
    }

    if (isUsdMode) {
      summary.usdEarned += earned;
      summary.usdNet += payout;
      summary.biggestUsdPayout = Math.max(summary.biggestUsdPayout, earned);
    } else {
      summary.rtcEarned += earned;
      summary.rtcNet += payout;
      summary.biggestRtcPayout = Math.max(summary.biggestRtcPayout, earned);
    }
  }

  summary.losses = Math.max(0, summary.gamesPlayed - summary.wins);
  summary.winRate = summary.gamesPlayed > 0 ? Number(((summary.wins / summary.gamesPlayed) * 100).toFixed(2)) : 0;
  summary.totalWinnings = summary.usdEarned + summary.rtcEarned;

  return summary;
};
