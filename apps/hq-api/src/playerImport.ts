import mongoose from 'mongoose';
import { playerTags, type PlayerTag } from '@reemteam/shared';
import { hqModels } from './services.js';

type AnyDoc = Record<string, any>;

export type PlayerImportResult = {
  collectionsRequested: string[];
  collectionsAvailable: string[];
  collectionsScanned: string[];
  collectionsMissing: string[];
  imported: number;
  updated: number;
  skipped: number;
};

export type PlayerAutoImportResult = PlayerImportResult | null;

export type LegacyCollectionSummary = {
  collection: string;
  count: number;
  sampleKeys: string[];
};

const allowedTags = new Set<string>(playerTags);
const adminRoles = new Set(['owner', 'admin', 'operator', 'moderator', 'support']);

export const defaultPlayerSourceCollections = ['hq_user_profiles', 'hq_users', 'players', 'Players', 'player', 'Player', 'users', 'Users', 'user', 'User'];

const sourceView = (source: AnyDoc) => ({
  ...source,
  ...(source.user && typeof source.user === 'object' ? source.user : {}),
  ...(source.player && typeof source.player === 'object' ? source.player : {}),
  ...(source.profile && typeof source.profile === 'object' ? source.profile : {}),
  ...(source.stats && typeof source.stats === 'object' ? source.stats : {}),
  ...(source.wallet && typeof source.wallet === 'object' ? source.wallet : {}),
  ...(source.walletSummary && typeof source.walletSummary === 'object' ? source.walletSummary : {})
});

const firstString = (source: AnyDoc, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const numberValue = (source: AnyDoc, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const parsed = Number(source[key]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const positiveNumberValue = (primary: AnyDoc, primaryKeys: string[], fallback: AnyDoc, fallbackKeys = primaryKeys) => {
  const primaryValue = numberValue(primary, primaryKeys);
  if (primaryValue > 0) return primaryValue;
  return numberValue(fallback, fallbackKeys);
};

const dateValue = (source: AnyDoc, keys: string[]) => {
  for (const key of keys) {
    if (!source[key]) continue;
    const date = new Date(source[key]);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return undefined;
};

const boolValue = (value: unknown) => value === true || value === 'true' || value === 1 || value === '1';

const cleanUsername = (value: string, fallback: string) => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return cleaned || fallback;
};

const cleanEmail = (value: string) => (value.includes('@') ? value.toLowerCase() : undefined);
const statsKey = (value: unknown) => String(value ?? '').trim().toLowerCase();

const addStatsKey = (map: Map<string, AnyDoc>, key: unknown, stats: AnyDoc) => {
  const normalized = statsKey(key);
  if (normalized) map.set(normalized, stats);
};

const loadDailyStats = async (db: NonNullable<typeof mongoose.connection.db>) => {
  const collections = new Set((await db.listCollections().toArray()).map((collection) => collection.name));
  const map = new Map<string, AnyDoc>();
  if (!collections.has('player_stats_daily')) return map;

  const rows = await db.collection('player_stats_daily').find({}).toArray();
  const grouped = new Map<string, AnyDoc>();
  for (const row of rows) {
    const key = statsKey(row.playerId || row.username);
    if (!key) continue;
    const current = grouped.get(key) ?? {
      aliases: new Set<string>(),
      matchesPlayed: 0,
      wins: 0,
      reems: 0,
      caughtDrops: 0,
      referrals: 0,
      rewardedInvites: 0,
      rtcBalance: 0,
      winnings: 0,
      netPayout: 0,
      depositCount: 0,
      avgStakeTotal: 0,
      avgStakeRows: 0,
      highestStake: 0,
      biggestPayout: 0,
      lastActiveAt: undefined
    };
    current.aliases.add(key);
    const usernameKey = statsKey(row.username);
    if (usernameKey) current.aliases.add(usernameKey);
    current.matchesPlayed += numberValue(row, ['matchesPlayed']);
    current.wins += numberValue(row, ['wins', 'regularWins', 'autoTripleWins', 'caughtDropWins']);
    current.reems += numberValue(row, ['reems']);
    current.caughtDrops += numberValue(row, ['caughtDropWins']);
    current.referrals += numberValue(row, ['inviteCount']);
    current.rewardedInvites += numberValue(row, ['rewardedInvites']);
    current.rtcBalance += numberValue(row, ['rtcBalance', 'rtc', 'depositAmount']);
    current.winnings += numberValue(row, ['grossPayout', 'biggestPayout']);
    current.netPayout += numberValue(row, ['netPayout']);
    current.depositCount += numberValue(row, ['depositCount']);
    const avgStake = numberValue(row, ['avgStake']);
    if (avgStake > 0) {
      current.avgStakeTotal += avgStake;
      current.avgStakeRows += 1;
    }
    current.highestStake = Math.max(current.highestStake, numberValue(row, ['highestStakeWin', 'highestStake']));
    current.biggestPayout = Math.max(current.biggestPayout, numberValue(row, ['biggestPayout']));
    const rowDate = dateValue(row, ['date', 'updatedAt', 'createdAt']);
    if (rowDate && (!current.lastActiveAt || rowDate > current.lastActiveAt)) current.lastActiveAt = rowDate;
    for (const alias of current.aliases) {
      grouped.set(alias, current);
    }
  }

  const seen = new Set<AnyDoc>();
  for (const [key, value] of grouped.entries()) {
    if (seen.has(value) && map.has(key)) continue;
    seen.add(value);
    const stats = {
      gamesPlayed: value.matchesPlayed,
      wins: value.wins,
      losses: Math.max(0, value.matchesPlayed - value.wins),
      reems: value.reems,
      caughtDrops: value.caughtDrops,
      referrals: value.referrals,
      referralCredits: value.rewardedInvites,
      rtcBalance: value.rtcBalance,
      winnings: value.winnings || value.netPayout,
      averageStake: value.avgStakeRows ? value.avgStakeTotal / value.avgStakeRows : 0,
      highestStake: value.highestStake,
      biggestPayout: value.biggestPayout,
      depositCount: value.depositCount,
      lastActiveAt: value.lastActiveAt
    };
    addStatsKey(map, key, stats);
  }
  return map;
};

const findDailyStats = (map: Map<string, AnyDoc>, source: AnyDoc, userDoc?: AnyDoc | null) =>
  map.get(statsKey(source.playerId)) ??
  map.get(statsKey(source.userId)) ??
  map.get(statsKey(userDoc?._id)) ??
  map.get(statsKey(source.username)) ??
  map.get(statsKey(userDoc?.username)) ??
  null;

const rawTags = (source: AnyDoc) => {
  const tags = new Set<string>();
  const sourceTags = Array.isArray(source.tags) ? source.tags : typeof source.tags === 'string' ? source.tags.split(',') : [];
  sourceTags.map((tag) => String(tag).trim()).filter(Boolean).forEach((tag) => tags.add(tag));
  if (boolValue(source.isVip) || boolValue(source.vip) || numberValue(source, ['highestStake', 'maxStake', 'biggestStake']) >= 100) tags.add('vip');
  if (boolValue(source.highStakes) || numberValue(source, ['averageStake', 'avgStake']) >= 50) tags.add('high_stakes');
  if (boolValue(source.contentSafe) || boolValue(source.canFeature)) tags.add('content_safe');
  if (boolValue(source.doNotFeature) || boolValue(source.contentUnsafe)) tags.add('do_not_feature');
  if (boolValue(source.suspicious) || boolValue(source.flagged)) tags.add('suspicious');
  if (boolValue(source.needsSupport)) tags.add('needs_support');
  if (numberValue(source, ['referrals', 'referralCount']) >= 5) tags.add('strong_referrer');
  if (numberValue(source, ['gamesPlayed', 'gameCount', 'games']) <= 5) tags.add('new_player');
  return Array.from(tags).filter((tag) => allowedTags.has(tag)) as PlayerTag[];
};

export const normalizeLegacyPlayer = (source: AnyDoc, sourceCollection: string) => {
  const view = sourceView(source);
  const daily = source.dailyStats && typeof source.dailyStats === 'object' ? source.dailyStats : {};
  const sourceId = String(source._id ?? view._id ?? view.id ?? view.userId ?? '');
  const role = String(view.role ?? view.accountType ?? view.type ?? '').toLowerCase();
  if (!sourceId || adminRoles.has(role)) return null;

  const email = cleanEmail(firstString(view, ['email', 'emailAddress']));
  const phone = firstString(view, ['phone', 'phoneNumber', 'mobile']);
  const displayName =
    firstString(view, ['displayName', 'name', 'fullName', 'playerName', 'firstName']) ||
    firstString(view, ['username', 'userName', 'handle']) ||
    email ||
    phone ||
    `Player ${sourceId.slice(-6)}`;
  const username = cleanUsername(firstString(view, ['username', 'userName', 'handle', 'slug']) || displayName, `player_${sourceId.slice(-8).toLowerCase()}`);
  const wins = positiveNumberValue(view, ['wins', 'winCount'], daily, ['wins']);
  const losses = positiveNumberValue(view, ['losses', 'lossCount'], daily, ['losses']);
  const gamesPlayed = positiveNumberValue(view, ['gamesPlayed', 'gameCount', 'games', 'totalGames'], daily, ['gamesPlayed']);
  const riskFlags = Array.isArray(view.riskFlags) ? view.riskFlags.map(String) : [];
  const rtcBalance = positiveNumberValue(view, ['rtcBalance', 'rtc', 'rtcCredits', 'credits', 'balance', 'walletBalance'], daily, ['rtcBalance']);

  const status = String(view.status ?? '').toLowerCase() === 'suspended' ? 'suspended' : boolValue(view.disabled) ? 'disabled' : 'active';

  return {
    displayName,
    username,
    email,
    phone: phone || undefined,
    role: 'player' as const,
    status: status as 'active' | 'disabled' | 'suspended',
    tags: rawTags(view),
    lastActiveAt: dateValue(view, ['lastActiveAt', 'lastLoginAt', 'updatedAt']) ?? daily.lastActiveAt,
    favoriteCrib: firstString(view, ['favoriteCrib', 'cribName']) || undefined,
    averageStake: positiveNumberValue(view, ['averageStake', 'avgStake'], daily, ['averageStake']),
    highestStake: positiveNumberValue(view, ['highestStake', 'maxStake', 'biggestStake'], daily, ['highestStake']),
    gamesPlayed,
    wins,
    losses,
    reems: positiveNumberValue(view, ['reems', 'reemCount'], daily, ['reems']),
    drops: numberValue(view, ['drops', 'dropCount']),
    caughtDrops: positiveNumberValue(view, ['caughtDrops', 'caughtDropCount'], daily, ['caughtDrops']),
    referrals: positiveNumberValue(view, ['referrals', 'referralCount'], daily, ['referrals']),
    rtcBalance,
    walletSummary: {
      credits: rtcBalance,
      winnings: positiveNumberValue(view, ['winnings', 'totalWinnings'], daily, ['winnings']),
      promotionalCredits: numberValue(view, ['promotionalCredits', 'promoCredits']),
      referralCredits: numberValue(view, ['referralCredits', 'rewardedInvites'])
    },
    riskFlags,
    contentSafe: !boolValue(view.doNotFeature) && !boolValue(view.contentUnsafe),
    legacy: { sourceCollection, sourceId, importedAt: new Date() }
  };
};

const uniqueUsername = async (base: string, existingId?: unknown) => {
  let candidate = base;
  let suffix = 2;
  while (await hqModels.User.exists({ username: candidate, _id: { $ne: existingId } })) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
};

export const inspectLegacyCollections = async (db = mongoose.connection.db): Promise<LegacyCollectionSummary[]> => {
  if (!db) throw new Error('MongoDB is not connected.');

  const collections = await db.listCollections().toArray();
  const summaries: LegacyCollectionSummary[] = [];
  for (const collection of collections) {
    const [count, sample] = await Promise.all([
      db.collection(collection.name).estimatedDocumentCount(),
      db.collection(collection.name).findOne({})
    ]);
    summaries.push({
      collection: collection.name,
      count,
      sampleKeys: sample ? Object.keys(sample).sort() : []
    });
  }
  return summaries.sort((left, right) => right.count - left.count);
};

let lastAutoImportAt = 0;
let activeAutoImport: Promise<PlayerAutoImportResult> | null = null;

export const autoImportExistingPlayersIfNeeded = async (limit = 10000, db = mongoose.connection.db): Promise<PlayerAutoImportResult> => {
  if (!db) return null;
  if (activeAutoImport) return activeAutoImport;
  if (Date.now() - lastAutoImportAt < 60_000) return null;

  activeAutoImport = (async () => {
    const availableCollections = new Set((await db.listCollections().toArray()).map((collection) => collection.name));
    const preferredSource = availableCollections.has('hq_user_profiles') ? 'hq_user_profiles' : availableCollections.has('hq_users') ? 'hq_users' : '';
    if (!preferredSource) return null;

    const [legacyCount, hqCount, staleImportedCount] = await Promise.all([
      db.collection(preferredSource).estimatedDocumentCount(),
      hqModels.User.countDocuments(),
      hqModels.User.countDocuments({
        role: 'player',
        $or: [
          { rtcBalance: { $lte: 0 } },
          { rtcBalance: { $exists: false } },
          { 'walletSummary.credits': { $lte: 0 } },
          { 'walletSummary.credits': { $exists: false } },
          { gamesPlayed: { $lte: 0 } },
          { wins: { $lte: 0 } },
          { reems: { $lte: 0 } }
        ]
      })
    ]);
    if (legacyCount <= hqCount && staleImportedCount === 0) return null;

    return importExistingPlayers(defaultPlayerSourceCollections, limit, false, db);
  })();

  try {
    return await activeAutoImport;
  } finally {
    lastAutoImportAt = Date.now();
    activeAutoImport = null;
  }
};

export const importExistingPlayers = async (collectionNames: string[], limit: number, dryRun = false, db = mongoose.connection.db): Promise<PlayerImportResult> => {
  if (!db) throw new Error('MongoDB is not connected.');

  const availableCollections = new Set((await db.listCollections().toArray()).map((collection) => collection.name));
  const requested = Array.from(new Set(collectionNames));
  const result: PlayerImportResult = {
    collectionsRequested: requested,
    collectionsAvailable: Array.from(availableCollections).sort(),
    collectionsScanned: [],
    collectionsMissing: requested.filter((collectionName) => !availableCollections.has(collectionName)),
    imported: 0,
    updated: 0,
    skipped: 0
  };
  const dailyStats = await loadDailyStats(db);

  for (const collectionName of requested) {
    if (!availableCollections.has(collectionName)) continue;
    result.collectionsScanned.push(collectionName);
    const docs = await db.collection(collectionName).find({}).limit(limit).toArray();

    for (const doc of docs) {
      const userDoc =
        collectionName === 'hq_user_profiles' && doc.userId
          ? await db.collection('hq_users').findOne({ _id: doc.userId })
          : null;
      const daily = findDailyStats(dailyStats, doc, userDoc);
      const player = normalizeLegacyPlayer(userDoc ? { ...userDoc, ...doc, user: userDoc, dailyStats: daily } : { ...doc, dailyStats: daily }, collectionName);
      if (!player) {
        result.skipped += 1;
        continue;
      }

      const filters: AnyDoc[] = [
        { 'legacy.sourceCollection': collectionName, 'legacy.sourceId': player.legacy.sourceId },
        { username: player.username }
      ];
      if (player.email) filters.push({ email: player.email });
      const existing = await hqModels.User.findOne({ $or: filters });
      if (existing && collectionName === 'hq_users') {
        result.updated += 1;
        continue;
      }
      const username = existing ? player.username : await uniqueUsername(player.username);

      if (!dryRun) {
        const user = existing
          ? await hqModels.User.findByIdAndUpdate(existing._id, { $set: { ...player, username } }, { returnDocument: 'after', runValidators: true })
          : await hqModels.User.create({ ...player, username });
        if (!user) throw new Error(`Unable to seed player ${player.username}`);
        await hqModels.UserProfile.findOneAndUpdate(
          { userId: user._id },
          {
            $set: {
              userId: user._id,
              displayName: user.displayName,
              contact: { email: user.email, phone: user.phone },
              tags: user.tags,
              summary: { gamesPlayed: user.gamesPlayed, wins: user.wins, reems: user.reems, referrals: user.referrals, rtcBalance: user.rtcBalance },
              riskFlags: user.riskFlags,
              contentSafe: user.contentSafe
            }
          },
          { upsert: true, returnDocument: 'after' }
        );
      }

      if (existing) result.updated += 1;
      else result.imported += 1;
    }
  }

  return result;
};
