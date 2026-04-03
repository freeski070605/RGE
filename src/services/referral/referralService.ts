import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { ReferralModel } from '../../db/models/Referral';
import { AppError } from '../../utils/errors';

const generateCode = (): string => `REEM-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

export const createReferralCode = async (ownerUserId: string) => {
  const referral = await ReferralModel.create({
    ownerUserId,
    code: generateCode()
  });

  return referral;
};

export const recordReferralInvite = async (code: string, invitedUserId: string) => {
  const referral = await ReferralModel.findOne({ code });
  if (!referral) {
    throw new AppError('Referral code not found', 404);
  }

  const alreadyTracked = referral.invites.some((invite) => invite.invitedUserId === invitedUserId);
  if (alreadyTracked) {
    throw new AppError('Invite already recorded for this user', 409);
  }

  referral.invites.push({
    invitedUserId,
    status: 'pending',
    rewardCents: 0,
    invitedAt: new Date()
  });
  await referral.save();

  return referral;
};

export const rewardReferralInvite = async (code: string, invitedUserId: string, rewardCents = env.REFERRAL_REWARD_CENTS) => {
  const referral = await ReferralModel.findOne({ code });
  if (!referral) {
    throw new AppError('Referral code not found', 404);
  }

  const invite = referral.invites.find((entry) => entry.invitedUserId === invitedUserId);
  if (!invite) {
    throw new AppError('Invite not found for this referral code', 404);
  }

  if (invite.status === 'rewarded') {
    return referral;
  }

  invite.status = 'rewarded';
  invite.rewardCents = rewardCents;
  invite.rewardedAt = new Date();
  referral.walletCreditsAwarded += rewardCents;

  await referral.save();

  return referral;
};
