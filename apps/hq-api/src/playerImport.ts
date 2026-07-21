import mongoose from 'mongoose';
import { playerTags, type PlayerTag } from '@reemteam/shared';
import { hqModels } from './services.js';

type AnyDoc = Record<string, any>;

export type PlayerImportResult = {
  collectionsScanned: string[];
  imported: number;
  updated: number;
  skipped: number;
};

const allowedTags = new Set<string>(playerTags);
const adminRoles = new Set(['owner', 'admin', 'operator', 'moderator', 'support']);

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
  const sourceId = String(source._id ?? source.id ?? source.userId ?? '');
  const role = String(source.role ?? source.accountType ?? '').toLowerCase();
  if (!sourceId || adminRoles.has(role)) return null;

  const email = cleanEmail(firstString(source, ['email', 'emailAddress']));
  const phone = firstString(source, ['phone', 'phoneNumber', 'mobile']);
  const displayName =
    firstString(source, ['displayName', 'name', 'fullName', 'playerName', 'firstName']) ||
    firstString(source, ['username', 'userName', 'handle']) ||
    email ||
    phone ||
    `Player ${sourceId.slice(-6)}`;
  const username = cleanUsername(firstString(source, ['username', 'userName', 'handle', 'slug']) || displayName, `player_${sourceId.slice(-8).toLowerCase()}`);
  const wins = numberValue(source, ['wins', 'winCount']);
  const losses = numberValue(source, ['losses', 'lossCount']);
  const gamesPlayed = numberValue(source, ['gamesPlayed', 'gameCount', 'games', 'totalGames'], wins + losses);
  const riskFlags = Array.isArray(source.riskFlags) ? source.riskFlags.map(String) : [];

  const status = String(source.status ?? '').toLowerCase() === 'suspended' ? 'suspended' : boolValue(source.disabled) ? 'disabled' : 'active';

  return {
    displayName,
    username,
    email,
    phone: phone || undefined,
    role: 'player' as const,
    status: status as 'active' | 'disabled' | 'suspended',
    tags: rawTags(source),
    lastActiveAt: dateValue(source, ['lastActiveAt', 'lastLoginAt', 'updatedAt']),
    favoriteCrib: firstString(source, ['favoriteCrib', 'cribName']) || undefined,
    averageStake: numberValue(source, ['averageStake', 'avgStake']),
    highestStake: numberValue(source, ['highestStake', 'maxStake', 'biggestStake']),
    gamesPlayed,
    wins,
    losses,
    reems: numberValue(source, ['reems', 'reemCount']),
    drops: numberValue(source, ['drops', 'dropCount']),
    caughtDrops: numberValue(source, ['caughtDrops', 'caughtDropCount']),
    referrals: numberValue(source, ['referrals', 'referralCount']),
    walletSummary: {
      credits: numberValue(source, ['credits', 'balance', 'walletBalance']),
      winnings: numberValue(source, ['winnings', 'totalWinnings']),
      promotionalCredits: numberValue(source, ['promotionalCredits', 'promoCredits']),
      referralCredits: numberValue(source, ['referralCredits'])
    },
    riskFlags,
    contentSafe: !boolValue(source.doNotFeature) && !boolValue(source.contentUnsafe),
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

export const importExistingPlayers = async (collectionNames: string[], limit: number, dryRun = false): Promise<PlayerImportResult> => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected.');

  const availableCollections = new Set((await db.listCollections().toArray()).map((collection) => collection.name));
  const result: PlayerImportResult = { collectionsScanned: [], imported: 0, updated: 0, skipped: 0 };

  for (const collectionName of collectionNames) {
    if (!availableCollections.has(collectionName)) continue;
    result.collectionsScanned.push(collectionName);
    const docs = await db.collection(collectionName).find({}).limit(limit).toArray();

    for (const doc of docs) {
      const player = normalizeLegacyPlayer(doc, collectionName);
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
              summary: { gamesPlayed: user.gamesPlayed, wins: user.wins, reems: user.reems, referrals: user.referrals },
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
