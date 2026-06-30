import { InferSchemaType, Schema, model } from 'mongoose';

const IntelligenceSyncStateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    cursor: String,
    lastSuccessfulSyncAt: Date,
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
    collection: 'intelligence_sync_state'
  }
);

export type IntelligenceSyncStateDocument = InferSchemaType<typeof IntelligenceSyncStateSchema> & { _id: string };

export const IntelligenceSyncStateModel = model('IntelligenceSyncState', IntelligenceSyncStateSchema);
