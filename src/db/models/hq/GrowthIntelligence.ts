import { InferSchemaType, Schema, model } from 'mongoose';
import { campaignKeys, gameIntelligenceSignalTypes, growthPlayTypes } from '../../../hq/domain';

const GameIntelligenceSignalSchema = new Schema(
  {
    signalType: { type: String, enum: gameIntelligenceSignalTypes, required: true, index: true },
    source: { type: String, required: true, index: true },
    sourceId: { type: String, required: true, index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'HQUser', index: true },
    targetCribId: { type: Schema.Types.ObjectId, ref: 'Crib', index: true },
    targetTableId: { type: Schema.Types.ObjectId, ref: 'Table', index: true },
    targetEventId: { type: Schema.Types.ObjectId, ref: 'HQEvent', index: true },
    summary: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    confidence: { type: Number, default: 50 },
    occurredAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['new', 'ranked', 'converted', 'dismissed'], default: 'new', index: true }
  },
  {
    timestamps: true,
    collection: 'game_intelligence_signals'
  }
);

const CampaignSchema = new Schema(
  {
    key: { type: String, enum: campaignKeys, required: true, index: true },
    name: { type: String, required: true },
    goal: { type: String, required: true },
    status: { type: String, enum: ['draft', 'active', 'paused', 'completed'], default: 'draft', index: true },
    startsAt: Date,
    endsAt: Date,
    scoringBoosts: { type: Schema.Types.Mixed, default: {} },
    targetSegments: { type: [String], default: [] }
  },
  {
    timestamps: true,
    collection: 'campaigns'
  }
);

const GrowthPlaySchema = new Schema(
  {
    title: { type: String, required: true },
    goal: { type: String, required: true },
    playType: { type: String, enum: growthPlayTypes, required: true, index: true },
    sourceSignalIds: { type: [Schema.Types.ObjectId], ref: 'GameIntelligenceSignal', default: [], index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'HQUser', index: true },
    targetCribId: { type: Schema.Types.ObjectId, ref: 'Crib', index: true },
    targetTableId: { type: Schema.Types.ObjectId, ref: 'Table', index: true },
    targetEventId: { type: Schema.Types.ObjectId, ref: 'HQEvent', index: true },
    recommendedAction: { type: String, required: true },
    recommendedChannel: { type: String, required: true },
    recommendedFormat: { type: String, required: true },
    whyItMatters: { type: String, required: true },
    whyThis: {
      sourceSignals: { type: [String], default: [] },
      scoreBoosts: { type: [String], default: [] },
      penalties: { type: [String], default: [] },
      campaignFit: { type: String, default: '' },
      recommendedActionReason: { type: String, default: '' }
    },
    urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium', index: true },
    confidence: { type: Number, default: 50 },
    estimatedValue: { type: Number, default: 0 },
    scoreParts: {
      gameplayIntensity: { type: Number, default: 0 },
      businessValue: { type: Number, default: 0 },
      socialProof: { type: Number, default: 0 },
      urgency: { type: Number, default: 0 },
      contentPotential: { type: Number, default: 0 },
      campaignFit: { type: Number, default: 0 },
      novelty: { type: Number, default: 0 },
      recency: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      fatiguePenalty: { type: Number, default: 0 },
      duplicationPenalty: { type: Number, default: 0 },
      riskPenalty: { type: Number, default: 0 }
    },
    finalScore: { type: Number, default: 0, index: true },
    riskFlags: { type: [String], default: [] },
    status: { type: String, enum: ['open', 'in_progress', 'approved', 'actioned', 'dismissed', 'expired'], default: 'open', index: true },
    expiresAt: { type: Date, index: true }
  },
  {
    timestamps: true,
    collection: 'growth_plays'
  }
);

GrowthPlaySchema.index({ status: 1, finalScore: -1, createdAt: -1 });

export type GameIntelligenceSignalDocument = InferSchemaType<typeof GameIntelligenceSignalSchema> & { _id: string };
export type CampaignDocument = InferSchemaType<typeof CampaignSchema> & { _id: string };
export type GrowthPlayDocument = InferSchemaType<typeof GrowthPlaySchema> & { _id: string };

export const GameIntelligenceSignalModel = model('GameIntelligenceSignal', GameIntelligenceSignalSchema);
export const CampaignModel = model('Campaign', CampaignSchema);
export const GrowthPlayModel = model('GrowthPlay', GrowthPlaySchema);
