import { ObjectId } from 'mongodb';
import { serialize } from '../../../services.js';
import { mapProfileStats } from '../stats/reemTeamStatsAdapter.js';
import { mapWalletSummary } from '../wallet/reemTeamWalletAdapter.js';

type AnyDoc = Record<string, any>;

export const idString = (value: unknown) => String(value ?? '');

export const asObjectId = (value: string) => (ObjectId.isValid(value) ? new ObjectId(value) : null);

const boolValue = (value: unknown) => value === true || value === 'true' || value === 1 || value === '1';

export const toHqRole = (role: unknown) => {
  if (role === 'superadmin') return 'owner';
  if (role === 'finance') return 'admin';
  if (role === 'moderator') return 'moderator';
  if (role === 'admin') return 'admin';
  if (role === 'operator' || role === 'support' || role === 'owner' || role === 'player') return role;
  return 'player';
};

export const toOriginalRole = (role: unknown) => {
  if (role === 'owner') return 'superadmin';
  if (role === 'operator' || role === 'support') return 'moderator';
  if (role === 'player') return 'user';
  if (role === 'admin' || role === 'moderator') return role;
  return 'user';
};

export const mapReemTeamPlayer = (input: {
  user: AnyDoc;
  profile?: AnyDoc | null;
  overlay?: AnyDoc | null;
  wallet?: AnyDoc | null;
  dailyStats?: AnyDoc | null;
}) => {
  const { user, profile = null, overlay = null, wallet = null, dailyStats = null } = input;
  const stats = mapProfileStats(profile, dailyStats);
  const walletSummary = mapWalletSummary(profile, user, wallet);
  const tags = user.tags?.length ? user.tags : profile?.tags ?? [];
  const riskFlags = user.riskFlags?.length ? user.riskFlags : profile?.riskFlags ?? [];

  return {
    id: idString(user._id),
    source: 'original_reemteam_players',
    displayName: profile?.displayName ?? user.displayName ?? user.username ?? `Player ${idString(user._id).slice(-6)}`,
    username: user.username ?? profile?.username ?? '',
    email: user.email ?? profile?.contact?.email,
    phone: user.phone ?? profile?.contact?.phone,
    role: toHqRole(user.role),
    originalRole: user.role ?? 'user',
    status: user.status ?? (boolValue(user.isBanned) ? 'suspended' : 'active'),
    tags,
    riskFlags,
    adminNotes: user.adminNotes ?? [],
    contentSafe: user.contentSafe ?? profile?.contentSafe ?? !tags.includes('do_not_feature'),
    avatarUrl: user.avatarUrl ?? profile?.avatarUrl ?? null,
    isVip: boolValue(user.isVip) || user.vipStatus === 'ACTIVE',
    vipStatus: user.vipStatus ?? null,
    vipSince: user.vipSince ?? null,
    vipExpiresAt: user.vipExpiresAt ?? null,
    isBanned: !!user.isBanned,
    isFrozen: !!user.isFrozen,
    lastActiveAt: stats.lastActiveAt,
    favoriteCrib: profile?.favoriteCrib ?? user.favoriteCrib,
    rtcBalance: walletSummary.rtcBalance,
    walletSummary,
    playerStats: stats,
    gamesPlayed: stats.gamesPlayed,
    wins: stats.wins,
    losses: stats.losses,
    winRate: stats.winRate,
    reems: stats.reems,
    drops: stats.drops,
    caughtDrops: stats.caughtDrops,
    referrals: stats.referrals,
    averageStake: stats.averageStake,
    highestStake: stats.highestStake,
    totalWinnings: stats.totalWinnings,
    matchesPlayed: stats.matchesPlayed,
    totalWins: stats.totalWins,
    totalReems: stats.totalReems,
    usdEarned: stats.usdEarned,
    rtcEarned: stats.rtcEarned,
    usdNet: stats.usdNet,
    rtcNet: stats.rtcNet,
    biggestUsdPayout: stats.biggestUsdPayout,
    biggestRtcPayout: stats.biggestRtcPayout,
    hqOverlay: null,
    original: {
      user: serialize(user),
      profile: serialize(profile),
      wallet: serialize(wallet)
    }
  };
};
