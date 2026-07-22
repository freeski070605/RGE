import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from './db.js';

type AnyDoc = Record<string, any>;

const lookup = process.env.PLAYER_LOOKUP?.trim();
if (!lookup) {
  throw new Error('PLAYER_LOOKUP is required. Set it to a username, display name, email, or player id.');
}

const idOrString = (value: unknown) => String(value ?? '');
const numberValue = (source: AnyDoc, keys: string[]) => {
  for (const key of keys) {
    const parsed = Number(source[key]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const compact = (doc: AnyDoc | null | undefined) => {
  if (!doc) return null;
  return {
    _id: idOrString(doc._id),
    userId: idOrString(doc.userId),
    displayName: doc.displayName,
    username: doc.username,
    email: doc.email,
    role: doc.role,
    status: doc.status,
    gamesPlayed: doc.gamesPlayed,
    matchesPlayed: doc.matchesPlayed,
    wins: doc.wins,
    losses: doc.losses,
    reems: doc.reems,
    drops: doc.drops,
    caughtDrops: doc.caughtDrops,
    referralCount: doc.referralCount,
    referrals: doc.referrals,
    averageStake: doc.averageStake,
    avgStake: doc.avgStake,
    highestStake: doc.highestStake,
    walletSummary: doc.walletSummary,
    balance: doc.balance,
    walletBalance: doc.walletBalance,
    rtcBalance: doc.rtcBalance,
    credits: doc.credits,
    depositAmount: doc.depositAmount,
    netPayout: doc.netPayout,
    grossPayout: doc.grossPayout,
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt
  };
};

await connectDatabase();

try {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected.');

  const objectId = mongoose.Types.ObjectId.isValid(lookup) ? new mongoose.Types.ObjectId(lookup) : null;
  const userQuery = {
    $or: [
      ...(objectId ? [{ _id: objectId }] : []),
      { username: lookup },
      { displayName: new RegExp(lookup, 'i') },
      { email: lookup }
    ]
  };

  const hqUser = await db.collection('hq_users').findOne(userQuery);
  const newUser = await db.collection('users').findOne(userQuery);
  const userId = hqUser?._id ?? newUser?.legacy?.sourceId ?? newUser?._id ?? objectId;
  const profile = userId
    ? await db.collection('hq_user_profiles').findOne({ userId: typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId })
    : await db.collection('hq_user_profiles').findOne({ displayName: new RegExp(lookup, 'i') });
  const username = hqUser?.username ?? newUser?.username ?? profile?.username ?? lookup;
  const dailyRows = await db.collection('player_stats_daily').find({
    $or: [
      ...(userId ? [{ playerId: userId }, { playerId: idOrString(userId) }] : []),
      { username }
    ]
  }).sort({ date: -1, updatedAt: -1 }).limit(20).toArray();

  const dailyRollup = dailyRows.reduce((totals: AnyDoc, row) => {
    totals.rows += 1;
    totals.matchesPlayed += numberValue(row, ['matchesPlayed']);
    totals.wins += numberValue(row, ['wins']);
    totals.regularWins += numberValue(row, ['regularWins']);
    totals.autoTripleWins += numberValue(row, ['autoTripleWins']);
    totals.caughtDropWins += numberValue(row, ['caughtDropWins']);
    totals.reems += numberValue(row, ['reems']);
    totals.inviteCount += numberValue(row, ['inviteCount']);
    totals.rewardedInvites += numberValue(row, ['rewardedInvites']);
    totals.depositAmount += numberValue(row, ['depositAmount']);
    totals.netPayout += numberValue(row, ['netPayout']);
    totals.grossPayout += numberValue(row, ['grossPayout']);
    totals.biggestPayout = Math.max(totals.biggestPayout, numberValue(row, ['biggestPayout']));
    totals.highestStakeWin = Math.max(totals.highestStakeWin, numberValue(row, ['highestStakeWin']));
    return totals;
  }, { rows: 0, matchesPlayed: 0, wins: 0, regularWins: 0, autoTripleWins: 0, caughtDropWins: 0, reems: 0, inviteCount: 0, rewardedInvites: 0, depositAmount: 0, netPayout: 0, grossPayout: 0, biggestPayout: 0, highestStakeWin: 0 });

  console.log(JSON.stringify({
    lookup,
    resolvedUserId: idOrString(userId),
    hqUser: compact(hqUser),
    hqUserProfile: compact(profile),
    currentReemTeamHqUser: compact(newUser),
    playerStatsDailyRollup: dailyRollup,
    playerStatsDailySample: dailyRows.slice(0, 3).map(compact)
  }, null, 2));
} finally {
  await disconnectDatabase();
}
