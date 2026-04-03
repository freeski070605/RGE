import { listReferrals } from '../dashboard/dashboardService';

export const getGrowthLoopsView = async () => {
  const referrals = await listReferrals();

  return {
    summary: {
      referralCodes: referrals.length,
      totalInvites: referrals.reduce((total, referral) => total + referral.inviteCount, 0),
      totalRewarded: referrals.reduce((total, referral) => total + referral.rewardedCount, 0),
      totalWalletCreditsAwarded: referrals.reduce((total, referral) => total + referral.walletCreditsAwarded, 0)
    },
    referrals
  };
};
