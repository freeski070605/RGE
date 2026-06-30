import { InferSchemaType, Schema, model } from 'mongoose';

const OperatorSettingSchema = new Schema(
  {
    operatorEmail: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    mode: {
      type: String,
      enum: ['autopilot', 'assisted', 'manual'],
      default: 'assisted'
    },
    approvedPlatforms: {
      type: [String],
      default: ['instagram', 'story']
    },
    approvedFormats: {
      type: [String],
      default: ['reel', 'carousel', 'story', 'square']
    },
    avoidNarrativeRepeatHours: {
      type: Number,
      default: 24
    },
    activeCampaign: {
      type: String,
      enum: [
        'none',
        'weekend_push',
        'event_night',
        'referral_growth',
        'leaderboard_race',
        'high_stakes_promo',
        'new_player_activation',
        'inactive_player_reactivation'
      ],
      default: 'none'
    }
  },
  {
    timestamps: true,
    collection: 'operator_settings'
  }
);

export type OperatorSettingDocument = InferSchemaType<typeof OperatorSettingSchema> & { _id: string };

export const OperatorSettingModel = model('OperatorSetting', OperatorSettingSchema);
