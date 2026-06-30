import { InferSchemaType, Schema, model } from 'mongoose';

const CribSchema = new Schema(
  {
    cribName: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    stakeTier: { type: String, required: true, index: true },
    theme: { type: String, default: 'default' },
    status: { type: String, enum: ['draft', 'active', 'paused', 'retired'], default: 'active', index: true },
    featured: { type: Boolean, default: false, index: true },
    growthPriority: { type: Number, default: 0, index: true },
    eventEligible: { type: Boolean, default: true },
    visualStyle: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
    collection: 'cribs'
  }
);

const TableSchema = new Schema(
  {
    tableName: { type: String, required: true, trim: true },
    cribId: { type: Schema.Types.ObjectId, ref: 'Crib', required: true, index: true },
    stake: { type: Number, required: true, index: true },
    maxSeats: { type: Number, default: 4 },
    status: { type: String, enum: ['open', 'active', 'paused', 'closed'], default: 'open', index: true },
    visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
    eventTable: { type: Boolean, default: false, index: true },
    aiFillEnabled: { type: Boolean, default: false },
    minimumBalance: { type: Number, default: 0 },
    ruleset: { type: String, default: 'standard' },
    theme: { type: String, default: 'default' },
    priority: { type: Number, default: 0, index: true },
    featuredAt: Date
  },
  {
    timestamps: true,
    collection: 'tables'
  }
);

const GameSessionSchema = new Schema(
  {
    tableId: { type: Schema.Types.ObjectId, ref: 'Table', required: true, index: true },
    cribId: { type: Schema.Types.ObjectId, ref: 'Crib', required: true, index: true },
    playerIds: { type: [Schema.Types.ObjectId], ref: 'HQUser', default: [], index: true },
    stake: { type: Number, required: true },
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active', index: true },
    startedAt: { type: Date, default: Date.now, index: true },
    endedAt: Date,
    winnerUserId: { type: Schema.Types.ObjectId, ref: 'HQUser' },
    biggestWinCents: { type: Number, default: 0 },
    reemCount: { type: Number, default: 0 },
    dropCount: { type: Number, default: 0 },
    caughtDropCount: { type: Number, default: 0 }
  },
  {
    timestamps: true,
    collection: 'game_sessions'
  }
);

const RoundSchema = new Schema(
  {
    gameSessionId: { type: Schema.Types.ObjectId, ref: 'GameSession', required: true, index: true },
    roundNumber: { type: Number, required: true },
    winnerUserId: { type: Schema.Types.ObjectId, ref: 'HQUser' },
    winType: { type: String, enum: ['standard', 'reem', 'dealt_50_47', 'first_turn_41', 'first_turn_lowball'], default: 'standard' },
    payoutCents: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    completedAt: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: true,
    collection: 'rounds'
  }
);

const GameEventSchema = new Schema(
  {
    source: { type: String, default: 'game_server', index: true },
    eventType: { type: String, required: true, index: true },
    gameSessionId: { type: Schema.Types.ObjectId, ref: 'GameSession', index: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'HQUser', index: true },
    tableId: { type: Schema.Types.ObjectId, ref: 'Table', index: true },
    cribId: { type: Schema.Types.ObjectId, ref: 'Crib', index: true },
    amountCents: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, required: true, index: true },
    processedAt: Date
  },
  {
    timestamps: true,
    collection: 'game_events'
  }
);

const LeaderboardSchema = new Schema(
  {
    name: { type: String, required: true },
    scope: { type: String, enum: ['global', 'crib', 'event', 'table'], default: 'global', index: true },
    scopeId: { type: String, index: true },
    window: { type: String, enum: ['daily', 'weekly', 'monthly', 'event'], default: 'weekly', index: true },
    entries: {
      type: [
        {
          userId: { type: Schema.Types.ObjectId, ref: 'HQUser' },
          displayName: String,
          rank: Number,
          score: Number,
          movement: Number
        }
      ],
      default: []
    },
    calculatedAt: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: true,
    collection: 'leaderboards'
  }
);

export type CribDocument = InferSchemaType<typeof CribSchema> & { _id: string };
export type TableDocument = InferSchemaType<typeof TableSchema> & { _id: string };
export type GameSessionDocument = InferSchemaType<typeof GameSessionSchema> & { _id: string };
export type RoundDocument = InferSchemaType<typeof RoundSchema> & { _id: string };
export type GameEventDocument = InferSchemaType<typeof GameEventSchema> & { _id: string };
export type LeaderboardDocument = InferSchemaType<typeof LeaderboardSchema> & { _id: string };

export const CribModel = model('Crib', CribSchema);
export const TableModel = model('Table', TableSchema);
export const GameSessionModel = model('GameSession', GameSessionSchema);
export const RoundModel = model('Round', RoundSchema);
export const GameEventModel = model('GameEvent', GameEventSchema);
export const LeaderboardModel = model('Leaderboard', LeaderboardSchema);
