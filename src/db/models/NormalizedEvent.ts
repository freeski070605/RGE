import { InferSchemaType, Schema, model } from 'mongoose';

const NormalizedEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    occurredAt: { type: Date, required: true, index: true },
    playerId: { type: String, index: true },
    playerDisplayName: String,
    tableId: { type: String, index: true },
    cribId: { type: String, index: true },
    cribName: String,
    stake: Number,
    mode: String,
    roundId: String,
    matchId: String,
    amountWon: Number,
    payoutMultiplier: Number,
    handResult: Schema.Types.Mixed,
    winType: {
      type: String,
      enum: [
        'reem',
        'caught_drop',
        'successful_drop',
        'stock_exhaustion',
        'auto_50_47',
        'first_turn_41',
        'first_turn_11_under',
        'normal_low_hand',
        ''
      ],
      default: ''
    },
    participants: { type: [Schema.Types.Mixed], default: [] },
    playerBeforeStats: { type: Schema.Types.Mixed, default: {} },
    playerAfterStats: { type: Schema.Types.Mixed, default: {} },
    leaderboardMovement: { type: Schema.Types.Mixed, default: {} },
    referralSource: String,
    isNewPlayer: { type: Boolean, default: false },
    isReturningPlayer: { type: Boolean, default: false },
    visibilitySafe: { type: Boolean, default: true, index: true },
    sourceVersion: { type: String, default: 'v3-normalized' },
    raw: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
    collection: 'normalized_events'
  }
);

NormalizedEventSchema.index({ eventType: 1, occurredAt: -1 });
NormalizedEventSchema.index({ playerId: 1, occurredAt: -1 });
NormalizedEventSchema.index({ cribId: 1, occurredAt: -1 });

export type NormalizedEventDocument = InferSchemaType<typeof NormalizedEventSchema> & { _id: string };

export const NormalizedEventModel = model('NormalizedEvent', NormalizedEventSchema);
