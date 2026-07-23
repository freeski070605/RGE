import mongoose from 'mongoose';
import type { Db } from 'mongodb';
import { hqModels, serialize } from '../../../services.js';
import { getDailyStatsRollup, getMatchStatsRollup } from '../stats/reemTeamStatsAdapter.js';
import { firstBalanceField, getTransactionsForUser, getWalletForUser } from '../wallet/reemTeamWalletAdapter.js';
import { asObjectId, idString, mapReemTeamPlayer, toOriginalRole } from './playerProfileMapper.js';

type AnyDoc = Record<string, any>;

const userCollection = 'users';
const profileCollection = 'hq_user_profiles';
const walletCollection = 'wallets';

const getDb = () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected.');
  return db;
};

const collectionNames = async (db: Db) => new Set((await db.listCollections().toArray()).map((collection) => collection.name));

export const getPlayerDataSource = async (db = getDb()) => {
  const collections = await collectionNames(db);
  const hasOriginalUsers = collections.has(userCollection);
  const hasOriginalProfiles = collections.has(profileCollection);
  const hasWallets = collections.has(walletCollection);
  const profile = hasOriginalProfiles ? await db.collection(profileCollection).findOne({}) : null;
  const user = hasOriginalUsers ? await db.collection(userCollection).findOne({}) : null;
  const wallet = hasWallets && user ? await getWalletForUser(db, user._id) : null;
  const balance = firstBalanceField([wallet ?? {}, profile ?? {}, user ?? {}]);
  const statsFields = profile
    ? ['gamesPlayed', 'wins', 'losses', 'reems', 'drops', 'caughtDrops', 'referralCount', 'averageStake', 'highestStake'].filter((field) => profile[field] !== undefined)
    : [];

  return {
    mode: hasOriginalUsers ? 'original_reemteam_players' : 'fallback_hq_users',
    userCollection: hasOriginalUsers ? userCollection : 'hq_manual_players',
    profileCollection: hasOriginalProfiles ? profileCollection : 'user_profiles',
    walletCollection: hasWallets ? walletCollection : 'none_detected',
    balanceSourceField: balance.path || 'none_detected',
    statsSourceFields: statsFields,
    usesDailyStatsFallback: collections.has('player_stats_daily'),
    lastChecked: new Date().toISOString()
  };
};

const legacyUserQuery = (id: string): AnyDoc => {
  const objectId = asObjectId(id);
  return { $or: [{ _id: objectId ?? id } as AnyDoc, { username: id }, { email: id }] };
};

const profileFor = async (db: Db, user: AnyDoc) =>
  db.collection(profileCollection).findOne({ userId: user._id }) ??
  db.collection(profileCollection).findOne({ username: user.username }) ??
  db.collection(profileCollection).findOne({ displayName: user.displayName });

export const ensurePlayerOverlay = async (_user: AnyDoc, _profile?: AnyDoc | null) => null;

export const listReemTeamPlayers = async (search = '') => {
  const db = getDb();
  const source = await getPlayerDataSource(db);
  if (source.mode !== 'original_reemteam_players') {
    return (await hqModels.User.find(search ? { $or: [{ displayName: new RegExp(search, 'i') }, { username: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] } : {}).sort({ updatedAt: -1, createdAt: -1 }).limit(250).lean()).map(serialize);
  }

  const query = search ? { $or: [{ displayName: new RegExp(search, 'i') }, { username: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] } : {};
  const users = await db.collection(userCollection).find(query).sort({ updatedAt: -1, createdAt: -1 }).limit(250).toArray();
  const rows = [];
  for (const user of users) {
    const profile = await profileFor(db, user);
    const [wallet, matchStats, dailyStats] = await Promise.all([
      getWalletForUser(db, user._id),
      getMatchStatsRollup(db, user._id),
      getDailyStatsRollup(db, user._id, user.username)
    ]);
    rows.push(mapReemTeamPlayer({ user, profile, wallet, dailyStats: matchStats ?? dailyStats }));
  }
  return rows;
};

export const getReemTeamPlayer = async (id: string) => {
  const db = getDb();
  const source = await getPlayerDataSource(db);
  if (source.mode !== 'original_reemteam_players') return null;
  const user = await db.collection(userCollection).findOne(legacyUserQuery(id));
  if (!user) return null;
  const profile = await profileFor(db, user);
  const [wallet, matchStats, dailyStats] = await Promise.all([
    getWalletForUser(db, user._id),
    getMatchStatsRollup(db, user._id),
    getDailyStatsRollup(db, user._id, user.username)
  ]);
  return mapReemTeamPlayer({ user, profile, wallet, dailyStats: matchStats ?? dailyStats });
};

export const patchReemTeamUser = async (id: string, patch: AnyDoc) => {
  const db = getDb();
  const nextPatch = { ...patch };
  if (nextPatch.role) nextPatch.role = toOriginalRole(nextPatch.role);
  const user = await db.collection(userCollection).findOneAndUpdate(
    legacyUserQuery(id),
    { $set: { ...nextPatch, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!user) return null;
  return getReemTeamPlayer(idString(user._id));
};

export const addReemTeamUserNote = async (id: string, note: string, actorId: string) => {
  const db = getDb();
  const stamped = { note, actorId, createdAt: new Date() };
  const user = await db.collection(userCollection).findOneAndUpdate(
    legacyUserQuery(id),
    { $push: { adminNotes: stamped } as any, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!user) return null;
  return { player: await getReemTeamPlayer(idString(user._id)), note: stamped };
};

export const updateReemTeamUserTags = async (id: string, body: { add?: string[]; remove?: string[]; set?: string[] }) => {
  const db = getDb();
  const user = await db.collection(userCollection).findOne(legacyUserQuery(id));
  if (!user) return null;
  const tags = new Set<string>(Array.isArray(body.set) ? body.set : Array.isArray(user.tags) ? user.tags : []);
  body.add?.forEach((tag) => tags.add(tag));
  body.remove?.forEach((tag) => tags.delete(tag));
  const updated = await db.collection(userCollection).findOneAndUpdate(
    { _id: user._id },
    { $set: { tags: Array.from(tags), updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!updated) return null;
  return getReemTeamPlayer(idString(updated._id));
};

export const listReemTeamWallets = async (search = '') => {
  const players = await listReemTeamPlayers(search);
  return players.map((player: AnyDoc) => ({
    id: player.id,
    userId: player.id,
    username: player.username,
    email: player.email,
    displayName: player.displayName,
    usdBalance: player.walletSummary?.usdBalance ?? 0,
    rtcBalance: player.walletSummary?.rtcBalance ?? 0,
    pendingWithdrawals: player.walletSummary?.pendingWithdrawals ?? 0,
    lifetimeDeposits: player.walletSummary?.lifetimeDeposits ?? 0,
    lifetimeWithdrawals: player.walletSummary?.lifetimeWithdrawals ?? 0,
    lastRtcRefill: player.walletSummary?.lastRtcRefill,
    updatedAt: player.walletSummary?.updatedAt
  }));
};

export const adjustReemTeamWallet = async (input: { userId: string; amount: number; reason: string; currency?: 'USD' | 'RTC'; actorId?: string }) => {
  const db = getDb();
  const user = await db.collection(userCollection).findOne(legacyUserQuery(input.userId));
  if (!user) return null;
  const currency = input.currency ?? 'RTC';
  const amount = Math.round(Number(input.amount) * 100) / 100;
  const wallet = await getWalletForUser(db, user._id);
  if (!wallet) throw new Error('Wallet not found for user.');

  const balanceField = currency === 'USD' ? 'usdBalance' : 'rtcBalance';
  const nextBalance = Math.round((Number(wallet[balanceField] ?? 0) + amount) * 100) / 100;
  if (nextBalance < 0) throw new Error(`Adjustment would result in a negative ${currency} balance.`);

  const update: AnyDoc = {
    [balanceField]: nextBalance,
    updatedAt: new Date()
  };
  if (currency === 'USD') {
    update.availableBalance = nextBalance;
    if (amount > 0) update.lifetimeDeposits = Math.round((Number(wallet.lifetimeDeposits ?? 0) + amount) * 100) / 100;
    if (amount < 0) update.lifetimeWithdrawals = Math.round((Number(wallet.lifetimeWithdrawals ?? 0) + Math.abs(amount)) * 100) / 100;
  }

  const updatedWallet = await db.collection(walletCollection).findOneAndUpdate(
    { _id: wallet._id },
    { $set: update },
    { returnDocument: 'after' }
  );

  await db.collection('transactions').insertOne({
    userId: user._id,
    type: amount >= 0 ? 'Deposit' : 'Withdrawal',
    amount,
    currency,
    status: 'Completed',
    date: new Date(),
    details: {
      paymentId: 'HQ_ADMIN_ADJUSTMENT',
      adminUserId: input.actorId,
      reason: input.reason,
      currency
    },
    createdAt: new Date(),
    updatedAt: new Date()
  });

  return {
    user: await getReemTeamPlayer(idString(user._id)),
    wallet: serialize(updatedWallet)
  };
};

export const getReemTeamWalletProfile = async (id: string) => {
  const player = await getReemTeamPlayer(id);
  if (!player) return null;
  const db = getDb();
  const userId = asObjectId(player.id) ?? player.id;
  const transactions = await getTransactionsForUser(db, userId);
  return {
    user: {
      id: player.id,
      username: player.username,
      email: player.email,
      avatarUrl: player.avatarUrl,
      role: player.role,
      isVip: player.isVip,
      vipStatus: player.vipStatus,
      vipSince: player.vipSince,
      vipExpiresAt: player.vipExpiresAt,
      isBanned: player.isBanned,
      isFrozen: player.isFrozen,
      adminNotes: player.adminNotes,
      createdAt: player.original?.user?.createdAt,
      updatedAt: player.original?.user?.updatedAt
    },
    wallet: player.walletSummary,
    transactions: transactions.map(serialize)
  };
};

export const getPlayerDataIntegrity = async () => {
  const db = getDb();
  const source = await getPlayerDataSource(db);
  const collections = await collectionNames(db);
  const originalPlayers = collections.has(userCollection) ? await db.collection(userCollection).find({}).toArray() : [];
  const originalProfiles = collections.has(profileCollection) ? await db.collection(profileCollection).find({}).toArray() : [];
  const originalIds = new Set(originalPlayers.map((user) => idString(user._id)));
  const profileUserIds = new Set(originalProfiles.map((profile) => idString(profile.userId)));

  const wallets = collections.has(walletCollection) ? await db.collection(walletCollection).find({}).toArray() : [];
  const walletUserIds = new Set(wallets.map((wallet) => idString(wallet.userId)));
  const usersWithMissingBalanceField = originalPlayers
    .filter((user) => !walletUserIds.has(idString(user._id)))
    .map((user) => idString(user._id));
  const usersWithInvalidBalanceType = wallets
    .filter((wallet) => {
      const balance = firstBalanceField([wallet]).value as unknown;
      return balance !== undefined && balance !== null && balance !== '' && Number.isNaN(Number(balance));
    })
    .map((wallet) => idString(wallet.userId));
  const usersWithMissingStatsField = originalProfiles
    .filter((profile) => ['gamesPlayed', 'wins', 'losses', 'reems'].some((field) => profile[field] === undefined))
    .map((profile) => idString(profile.userId));

  const duplicatesBy = (field: string) => {
    const map = new Map<string, number>();
    for (const user of originalPlayers) {
      const value = String(user[field] ?? '').trim().toLowerCase();
      if (value) map.set(value, (map.get(value) ?? 0) + 1);
    }
    return Array.from(map.entries()).filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
  };

  return {
    source,
    originalPlayerCount: originalPlayers.length,
    originalProfileCount: originalProfiles.length,
    originalWalletCount: wallets.length,
    originalProfilesWithNoMatchingUser: originalProfiles.filter((profile) => !originalIds.has(idString(profile.userId))).map((profile) => idString(profile._id)),
    playersMissingProfile: originalPlayers.filter((user) => !profileUserIds.has(idString(user._id))).map((user) => idString(user._id)),
    usersWithMissingBalanceField,
    usersWithInvalidBalanceType,
    usersWithMissingStatsField,
    possibleDuplicateUsers: {
      email: duplicatesBy('email'),
      username: duplicatesBy('username'),
      displayName: duplicatesBy('displayName')
    },
    hqReadingFrom: source.mode,
    lastChecked: new Date().toISOString()
  };
};

export const syncPlayerOverlays = async () => {
  const db = getDb();
  const source = await getPlayerDataSource(db);
  return { source, matched: 0, createdOverlays: 0, skipped: 0, warnings: ['HQ no longer creates player overlay records. ReemTeamHQ reads original users directly.'] };
};
