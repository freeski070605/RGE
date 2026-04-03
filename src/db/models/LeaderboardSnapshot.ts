import { InferSchemaType, Schema, model } from 'mongoose';

const LeaderboardEntrySchema = new Schema(
  {
    rank: {
      type: Number,
      required: true
    },
    playerId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    secondaryValue: Number,
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: false }
);

const LeaderboardSnapshotSchema = new Schema(
  {
    metric: {
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
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    generatedAt: {
      type: Date,
      required: true
    },
    rankings: {
      type: [LeaderboardEntrySchema],
      default: []
    }
  },
  {
    timestamps: true,
    collection: 'leaderboard_snapshots'
  }
);

LeaderboardSnapshotSchema.index({ metric: 1, window: 1 }, { unique: true });

export type LeaderboardSnapshotDocument = InferSchemaType<typeof LeaderboardSnapshotSchema> & { _id: string };

export const LeaderboardSnapshotModel = model('LeaderboardSnapshot', LeaderboardSnapshotSchema);
