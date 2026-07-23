import { ObjectId, type Db } from 'mongodb';

type AnyDoc = Record<string, any>;

const hasValue = (value: unknown) => value !== undefined && value !== null && value !== '';

export const firstBalanceField = (documents: AnyDoc[]) => {
  const paths = [
    'walletSummary.balance',
    'walletSummary.availableBalance',
    'walletSummary.rtcBalance',
    'walletSummary.credits',
    'balance',
    'availableBalance',
    'rtcBalance',
    'rtc',
    'rtcCredits',
    'walletBalance',
    'credits'
  ];

  for (const document of documents) {
    for (const path of paths) {
      const value = path.split('.').reduce((current, key) => current?.[key], document);
      if (hasValue(value)) return { path, value };
    }
  }
  return { path: '', value: 0 };
};

const toNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const getWalletForUser = async (db: Db, userId: unknown) => {
  const collections = new Set((await db.listCollections().toArray()).map((collection) => collection.name));
  if (!collections.has('wallets')) return null;
  const id = String(userId ?? '');
  const userIds = ObjectId.isValid(id) ? [userId, id, new ObjectId(id)] : [userId, id];
  return db.collection('wallets').findOne({ userId: { $in: userIds } });
};

export const getTransactionsForUser = async (db: Db, userId: unknown, limit = 100) => {
  const collections = new Set((await db.listCollections().toArray()).map((collection) => collection.name));
  if (!collections.has('transactions')) return [];
  const id = String(userId ?? '');
  const userIds = ObjectId.isValid(id) ? [userId, id, new ObjectId(id)] : [userId, id];
  return db.collection('transactions').find({ userId: { $in: userIds } }).sort({ date: -1, createdAt: -1 }).limit(limit).toArray();
};

export const mapWalletSummary = (profile: AnyDoc | null, user: AnyDoc | null, wallet: AnyDoc | null = null) => {
  const balance = firstBalanceField([wallet ?? {}, profile ?? {}, user ?? {}]);
  const source = profile?.walletSummary && typeof profile.walletSummary === 'object' ? profile.walletSummary : {};
  const rtcBalance = wallet ? toNumber(wallet.rtcBalance) : toNumber(source.rtcBalance ?? balance.value);
  return {
    ...source,
    userId: wallet?.userId?.toString?.() ?? wallet?.userId ?? user?._id?.toString?.() ?? user?._id,
    usdBalance: wallet ? toNumber(wallet.usdBalance) : toNumber(source.usdBalance ?? source.availableBalance),
    balance: wallet ? toNumber(wallet.usdBalance) : toNumber(balance.value),
    availableBalance: wallet ? toNumber(wallet.availableBalance ?? wallet.usdBalance) : toNumber(source.availableBalance ?? balance.value),
    rtcBalance,
    pendingWithdrawals: wallet ? toNumber(wallet.pendingWithdrawals) : toNumber(source.pendingWithdrawals),
    lifetimeDeposits: wallet ? toNumber(wallet.lifetimeDeposits) : toNumber(source.lifetimeDeposits),
    lifetimeWithdrawals: wallet ? toNumber(wallet.lifetimeWithdrawals) : toNumber(source.lifetimeWithdrawals),
    lastRtcRefill: wallet?.lastRtcRefill ?? source.lastRtcRefill,
    updatedAt: wallet?.updatedAt ?? source.updatedAt,
    balanceSourceField: balance.path,
    balanceStorage: wallet ? 'wallets.rtcBalance' : typeof balance.value === 'number' && Number.isInteger(balance.value) ? 'integer' : typeof balance.value
  };
};
