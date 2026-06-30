import { InferSchemaType, Schema, model } from 'mongoose';

const DerivedIndicatorSchema = new Schema(
  {
    indicatorKey: { type: String, required: true, unique: true, index: true },
    indicatorType: { type: String, required: true, index: true },
    sourceEventIds: { type: [String], default: [], index: true },
    playerId: { type: String, index: true },
    playerDisplayName: String,
    tableId: { type: String, index: true },
    cribId: { type: String, index: true },
    cribName: String,
    stake: Number,
    occurredAt: { type: Date, required: true, index: true },
    window: { type: String, default: 'instant', index: true },
    scoreParts: { type: Schema.Types.Mixed, default: {} },
    confidence: { type: Number, default: 50 },
    visibilitySafe: { type: Boolean, default: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
    collection: 'derived_indicators'
  }
);

DerivedIndicatorSchema.index({ indicatorType: 1, occurredAt: -1 });
DerivedIndicatorSchema.index({ playerId: 1, indicatorType: 1, occurredAt: -1 });
DerivedIndicatorSchema.index({ cribId: 1, indicatorType: 1, occurredAt: -1 });

export type DerivedIndicatorDocument = InferSchemaType<typeof DerivedIndicatorSchema> & { _id: string };

export const DerivedIndicatorModel = model('DerivedIndicator', DerivedIndicatorSchema);
