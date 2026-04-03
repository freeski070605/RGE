import { InferSchemaType, Schema, model } from 'mongoose';

const PlayerStatsDailySchema = new Schema(
  {
    date: {
      type: String,
      required: true,
      index: true
    },
    window: {
      type: String,
      enum: ['24h', '7d', '30d'],
      required: true,
      index: true
    },
    playerId: {
      type: String,
      required: true,
      index: true
    },
    username: {
      type: String,
      required: true
    },
    vipStatus: {
      type: String,
      default: 'NONE'
    },
    matchesPlayed: {
      type: Number,
      default: 0
    },
    wins: {
      type: Number,
      default: 0
    },
    reems: {
      type: Number,
      default: 0
    },
    regularWins: {
      type: Number,
      default: 0
    },
    autoTripleWins: {
      type: Number,
      default: 0
    },
    caughtDropWins: {
      type: Number,
      default: 0
    },
    netPayout: {
      type: Number,
      default: 0
    },
    grossPayout: {
      type: Number,
      default: 0
    },
    biggestPayout: {
      type: Number,
      default: 0
    },
    avgStake: {
      type: Number,
      default: 0
    },
    highestStakeWin: {
      type: Number,
      default: 0
    },
    depositCount: {
      type: Number,
      default: 0
    },
    depositAmount: {
      type: Number,
      default: 0
    },
    inviteCount: {
      type: Number,
      default: 0
    },
    rewardedInvites: {
      type: Number,
      default: 0
    },
    currentWinStreak: {
      type: Number,
      default: 0
    },
    bestWinStreak: {
      type: Number,
      default: 0
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: 'player_stats_daily'
  }
);

PlayerStatsDailySchema.index({ date: 1, window: 1, playerId: 1 }, { unique: true });

export type PlayerStatsDailyDocument = InferSchemaType<typeof PlayerStatsDailySchema> & { _id: string };

export const PlayerStatsDailyModel = model('PlayerStatsDaily', PlayerStatsDailySchema);
