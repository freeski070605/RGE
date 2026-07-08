export type NormalizedEventInput = {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  playerId?: string;
  playerDisplayName?: string;
  tableId?: string;
  cribId?: string;
  cribName?: string;
  stake?: number;
  mode?: string;
  roundId?: string;
  matchId?: string;
  amountWon?: number;
  payoutMultiplier?: number;
  handResult?: Record<string, unknown>;
  winType?: string;
  participants?: unknown[];
  playerBeforeStats?: Record<string, unknown>;
  playerAfterStats?: Record<string, unknown>;
  leaderboardMovement?: Record<string, unknown>;
  referralSource?: string;
  isNewPlayer?: boolean;
  isReturningPlayer?: boolean;
  visibilitySafe: boolean;
  sourceVersion: string;
  raw: Record<string, unknown>;
};

const signalToEventType: Record<string, string> = {
  reem_moment: 'reem_achieved',
  promo_table_active: 'promo_table_active',
  big_payout: 'big_payout',
  high_stakes_win: 'high_stakes_win',
  win_streak: 'player_streak_changed',
  vip_win: 'high_stakes_win',
  referral_momentum: 'referral_completed',
  leaderboard_most_reems: 'leaderboard_changed',
  leaderboard_biggest_earner: 'leaderboard_changed',
  leaderboard_movement: 'leaderboard_changed',
  hot_player: 'player_streak_changed',
  deposit_momentum: 'wallet_credit_awarded',
  wallet_credit_momentum: 'wallet_credit_awarded',
  caught_drop: 'drop_caught',
  drop_caught: 'drop_caught',
  table_filled: 'table_filled',
  hot_crib: 'event_table_active'
};

const signalToWinType: Record<string, string> = {
  reem_moment: 'reem',
  caught_drop: 'caught_drop',
  drop_caught: 'caught_drop'
};

const normalizeDate = (value: unknown) => {
  const date = value ? new Date(String(value)) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const normalizeNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const normalizeLegacySignal = (signal: any): NormalizedEventInput => {
  const metadata = (signal.metadata ?? {}) as Record<string, unknown>;
  const signalType = String(signal.signalType ?? 'match_completed');
  const eventType = signalToEventType[signalType] ?? signalType;
  const sourceId = String(signal.sourceId ?? signal._id ?? `${signalType}:${signal.occurredAt ?? Date.now()}`);
  const occurredAt = normalizeDate(signal.occurredAt);
  const cribId = String(metadata.cribId ?? metadata.houseId ?? metadata.venueId ?? signal.cribId ?? signal.tableId ?? '');
  const cribName = String(metadata.cribName ?? metadata.houseName ?? metadata.venueName ?? signal.cribName ?? signal.tableName ?? '');

  return {
    eventId: String(metadata.eventId ?? `${signal.sourceType ?? 'signal'}:${signalType}:${sourceId}`),
    eventType,
    occurredAt,
    playerId: signal.playerId,
    playerDisplayName: signal.username ?? signal.playerDisplayName,
    tableId: signal.tableId,
    cribId: cribId || undefined,
    cribName: cribName || undefined,
    stake: normalizeNumber(signal.stake ?? metadata.stake),
    mode: signal.mode ?? (metadata.mode as string | undefined),
    roundId: metadata.roundId ? String(metadata.roundId) : undefined,
    matchId: signal.matchId ?? (metadata.matchId ? String(metadata.matchId) : undefined),
    amountWon: normalizeNumber(signal.amount ?? metadata.amountWon ?? metadata.payout),
    payoutMultiplier: normalizeNumber(metadata.payoutMultiplier),
    handResult: (metadata.handResult as Record<string, unknown>) ?? {},
    winType: String(metadata.winType ?? signalToWinType[signalType] ?? ''),
    participants: Array.isArray(metadata.participants)
      ? metadata.participants
      : Array.isArray(metadata.players)
        ? metadata.players
        : Array.isArray(metadata.aiPlayers)
          ? metadata.aiPlayers
          : [],
    playerBeforeStats: (metadata.playerBeforeStats as Record<string, unknown>) ?? {},
    playerAfterStats: (metadata.playerAfterStats as Record<string, unknown>) ?? {},
    leaderboardMovement: (metadata.leaderboardMovement as Record<string, unknown>) ?? {
      metric: metadata.metric,
      previousRank: metadata.previousRank,
      currentRank: metadata.currentRank
    },
    referralSource: metadata.referralSource ? String(metadata.referralSource) : undefined,
    isNewPlayer: Boolean(metadata.isNewPlayer),
    isReturningPlayer: Boolean(metadata.isReturningPlayer),
    visibilitySafe: metadata.visibilitySafe !== false && !['deposit_momentum', 'wallet_credit_momentum'].includes(signalType),
    sourceVersion: 'legacy-signal',
    raw: signal
  };
};

const normalizeV3Record = (record: any): NormalizedEventInput => ({
  eventId: String(record.eventId ?? record.id ?? `${record.eventType}:${record.occurredAt ?? Date.now()}`),
  eventType: String(record.eventType ?? 'match_completed'),
  occurredAt: normalizeDate(record.occurredAt),
  playerId: record.playerId,
  playerDisplayName: record.playerDisplayName ?? record.username,
  tableId: record.tableId,
  cribId: record.cribId,
  cribName: record.cribName,
  stake: normalizeNumber(record.stake),
  mode: record.mode,
  roundId: record.roundId,
  matchId: record.matchId,
  amountWon: normalizeNumber(record.amountWon ?? record.amount),
  payoutMultiplier: normalizeNumber(record.payoutMultiplier),
  handResult: record.handResult ?? {},
  winType: record.winType ?? '',
  participants: Array.isArray(record.participants) ? record.participants : [],
  playerBeforeStats: record.playerBeforeStats ?? {},
  playerAfterStats: record.playerAfterStats ?? {},
  leaderboardMovement: record.leaderboardMovement ?? {},
  referralSource: record.referralSource,
  isNewPlayer: Boolean(record.isNewPlayer),
  isReturningPlayer: Boolean(record.isReturningPlayer),
  visibilitySafe: record.visibilitySafe !== false,
  sourceVersion: String(record.sourceVersion ?? 'v3'),
  raw: record
});

const normalizeFeedTable = (table: any): NormalizedEventInput => {
  const tableId = String(table.tableId ?? table._id ?? table.id ?? '');
  const players = Array.isArray(table.players) ? table.players : [];
  const aiPlayers = players.filter((player: any) => player?.isAI);

  return {
    eventId: `table:${tableId}:promo-active`,
    eventType: table.isPromo ? 'promo_table_active' : 'table_state',
    occurredAt: normalizeDate(table.updatedAt ?? table.createdAt),
    tableId,
    cribId: tableId || undefined,
    cribName: table.name,
    stake: normalizeNumber(table.stake),
    mode: table.mode,
    matchId: table.currentMatchId ?? undefined,
    participants: players,
    handResult: {},
    winType: '',
    playerBeforeStats: {},
    playerAfterStats: {},
    leaderboardMovement: {},
    visibilitySafe: true,
    sourceVersion: 'backend-table',
    raw: {
      ...table,
      aiPlayerCount: aiPlayers.length
    }
  };
};

export const normalizeBackendFeedRecords = (feed: any): NormalizedEventInput[] => {
  const rawEvents = Array.isArray(feed?.events) ? feed.events : [];
  const rawSignals = Array.isArray(feed?.signals) ? feed.signals : [];
  const promoSignalTableIds = new Set(
    rawSignals
      .filter((signal: any) => signal?.signalType === 'promo_table_active' && signal?.tableId)
      .map((signal: any) => String(signal.tableId))
  );
  const rawTables = Array.isArray(feed?.tables)
    ? feed.tables.filter((table: any) => table?.isPromo && !promoSignalTableIds.has(String(table.tableId ?? table._id ?? table.id ?? '')))
    : [];

  return [
    ...rawEvents.map(normalizeV3Record),
    ...rawTables.map(normalizeFeedTable),
    ...rawSignals.map(normalizeLegacySignal)
  ].filter((event) => event.eventId && event.eventType);
};
