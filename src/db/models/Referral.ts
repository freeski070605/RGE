import { InferSchemaType, Schema, model } from 'mongoose';

const ReferralSchema = new Schema(
  {
    ownerUserId: {
      type: String,
      required: true,
      index: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    invites: {
      type: [
        new Schema(
          {
            invitedUserId: {
              type: String,
              required: true
            },
            status: {
              type: String,
              enum: ['pending', 'rewarded'],
              default: 'pending'
            },
            rewardCents: {
              type: Number,
              default: 0
            },
            invitedAt: {
              type: Date,
              default: Date.now
            },
            rewardedAt: Date
          },
          { _id: false }
        )
      ],
      default: []
    },
    walletCreditsAwarded: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    collection: 'referrals'
  }
);

export type ReferralDocument = InferSchemaType<typeof ReferralSchema> & { _id: string };

export const ReferralModel = model('Referral', ReferralSchema);
