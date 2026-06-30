import { InferSchemaType, Schema, model } from 'mongoose';

const OpportunityCandidateSchema = new Schema(
  {
    candidateKey: { type: String, required: true, unique: true, index: true },
    opportunityType: { type: String, required: true, index: true },
    sourceIndicatorIds: { type: [Schema.Types.ObjectId], ref: 'DerivedIndicator', default: [], index: true },
    sourceEventIds: { type: [String], default: [], index: true },
    playerId: { type: String, index: true },
    playerDisplayName: String,
    cribId: { type: String, index: true },
    cribName: String,
    tableId: String,
    stake: Number,
    title: { type: String, required: true },
    whyItMatters: { type: String, default: '' },
    recommendedAngle: { type: String, default: '' },
    recommendedFormat: { type: String, default: 'reel' },
    recommendedPlatforms: { type: [String], default: ['instagram'] },
    urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    confidence: { type: Number, default: 50 },
    estimatedValue: { type: Number, default: 0 },
    scoreParts: { type: Schema.Types.Mixed, default: {} },
    finalScore: { type: Number, default: 0, index: true },
    penalties: { type: Schema.Types.Mixed, default: {} },
    visibilitySafe: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      enum: ['open', 'saved', 'dismissed', 'converted', 'expired'],
      default: 'open',
      index: true
    },
    expiresAt: { type: Date, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
    collection: 'opportunity_candidates'
  }
);

OpportunityCandidateSchema.index({ opportunityType: 1, createdAt: -1 });
OpportunityCandidateSchema.index({ status: 1, finalScore: -1, createdAt: -1 });
OpportunityCandidateSchema.index({ playerId: 1, createdAt: -1 });
OpportunityCandidateSchema.index({ cribId: 1, createdAt: -1 });

export type OpportunityCandidateDocument = InferSchemaType<typeof OpportunityCandidateSchema> & { _id: string };

export const OpportunityCandidateModel = model('OpportunityCandidate', OpportunityCandidateSchema);
