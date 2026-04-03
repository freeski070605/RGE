import { InferSchemaType, Schema, model } from 'mongoose';

const SignalScoresSchema = new Schema(
  {
    noveltyScore: {
      type: Number,
      default: 0
    },
    performancePotentialScore: {
      type: Number,
      default: 0
    },
    brandFitScore: {
      type: Number,
      default: 0
    },
    urgencyScore: {
      type: Number,
      default: 0
    },
    overallPriorityScore: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const GameSignalSchema = new Schema(
  {
    signalType: {
      type: String,
      required: true,
      index: true
    },
    sourceType: {
      type: String,
      required: true
    },
    sourceId: {
      type: String,
      required: true
    },
    playerId: {
      type: String,
      index: true
    },
    username: String,
    tableId: String,
    tableName: String,
    matchId: String,
    mode: String,
    stake: Number,
    amount: Number,
    window: {
      type: String,
      enum: ['24h', '7d', '30d'],
      default: '24h'
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    occurredAt: {
      type: Date,
      required: true,
      index: true
    },
    scores: {
      type: SignalScoresSchema,
      default: {}
    },
    recommendedPlatforms: {
      type: [String],
      default: ['instagram', 'x']
    },
    status: {
      type: String,
      enum: ['new', 'ranked', 'idea_created', 'dismissed'],
      default: 'new',
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'game_signals'
  }
);

GameSignalSchema.index({ signalType: 1, sourceType: 1, sourceId: 1 }, { unique: true });

export type GameSignalDocument = InferSchemaType<typeof GameSignalSchema> & { _id: string };

export const GameSignalModel = model('GameSignal', GameSignalSchema);
