import { InferSchemaType, Schema, model } from 'mongoose';

const ReferralSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'HQUser', required: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    inviteCount: { type: Number, default: 0 },
    rewardedCount: { type: Number, default: 0 },
    walletCreditsAwardedCents: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'paused', 'expired'], default: 'active', index: true },
    invites: { type: [Schema.Types.Mixed], default: [] }
  },
  {
    timestamps: true,
    collection: 'hq_referrals'
  }
);

const WalletLedgerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'HQUser', required: true, index: true },
    type: { type: String, enum: ['credit', 'debit', 'hold', 'release', 'adjustment'], required: true, index: true },
    amountCents: { type: Number, required: true },
    reason: { type: String, required: true },
    referenceType: { type: String, index: true },
    referenceId: { type: String, index: true },
    balanceAfterCents: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
    collection: 'wallet_ledger'
  }
);

const HQEventSchema = new Schema(
  {
    eventName: { type: String, required: true },
    eventType: { type: String, required: true, index: true },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true, index: true },
    eligibleCribs: { type: [Schema.Types.ObjectId], ref: 'Crib', default: [] },
    eligibleTables: { type: [Schema.Types.ObjectId], ref: 'Table', default: [] },
    stakeRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 }
    },
    rewardRules: { type: Schema.Types.Mixed, default: {} },
    leaderboardRules: { type: Schema.Types.Mixed, default: {} },
    contentGoal: { type: String, default: '' },
    growthGoal: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'scheduled', 'running', 'completed', 'cancelled'], default: 'draft', index: true }
  },
  {
    timestamps: true,
    collection: 'hq_events'
  }
);

const ContentDraftSchema = new Schema(
  {
    growthPlayId: { type: Schema.Types.ObjectId, ref: 'GrowthPlay', index: true },
    title: { type: String, required: true },
    format: { type: String, required: true },
    channel: { type: String, required: true },
    captions: { type: [String], default: [] },
    selectedCaption: String,
    visualPrompt: String,
    assetIds: { type: [Schema.Types.ObjectId], ref: 'ContentAsset', default: [] },
    approvalStatus: { type: String, enum: ['draft', 'needs_review', 'approved', 'rejected', 'scheduled', 'published'], default: 'draft', index: true },
    scheduledFor: Date,
    publishedAt: Date
  },
  {
    timestamps: true,
    collection: 'content_drafts'
  }
);

const ContentAssetSchema = new Schema(
  {
    title: { type: String, required: true },
    kind: { type: String, enum: ['image', 'video', 'audio', 'document', 'template'], required: true, index: true },
    url: String,
    storagePath: String,
    tags: { type: [String], default: [], index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
    collection: 'content_assets'
  }
);

const PublishingJobSchema = new Schema(
  {
    contentDraftId: { type: Schema.Types.ObjectId, ref: 'ContentDraft', required: true, index: true },
    channel: { type: String, required: true, index: true },
    status: { type: String, enum: ['queued', 'publishing', 'published', 'failed', 'cancelled'], default: 'queued', index: true },
    scheduledFor: Date,
    publishedAt: Date,
    errorMessage: String,
    externalId: String
  },
  {
    timestamps: true,
    collection: 'hq_publishing_jobs'
  }
);

const PerformanceResultSchema = new Schema(
  {
    contentDraftId: { type: Schema.Types.ObjectId, ref: 'ContentDraft', index: true },
    growthPlayId: { type: Schema.Types.ObjectId, ref: 'GrowthPlay', index: true },
    channel: { type: String, required: true, index: true },
    metrics: { type: Schema.Types.Mixed, default: {} },
    plainEnglishLearning: { type: String, default: '' },
    measuredAt: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: true,
    collection: 'performance_results'
  }
);

const SystemHealthCheckSchema = new Schema(
  {
    component: { type: String, required: true, index: true },
    status: { type: String, enum: ['ok', 'warning', 'error'], required: true, index: true },
    detail: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    checkedAt: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: true,
    collection: 'system_health_checks'
  }
);

export type ReferralDocument = InferSchemaType<typeof ReferralSchema> & { _id: string };
export type WalletLedgerDocument = InferSchemaType<typeof WalletLedgerSchema> & { _id: string };
export type HQEventDocument = InferSchemaType<typeof HQEventSchema> & { _id: string };
export type ContentDraftDocument = InferSchemaType<typeof ContentDraftSchema> & { _id: string };
export type ContentAssetDocument = InferSchemaType<typeof ContentAssetSchema> & { _id: string };
export type HQPublishingJobDocument = InferSchemaType<typeof PublishingJobSchema> & { _id: string };
export type PerformanceResultDocument = InferSchemaType<typeof PerformanceResultSchema> & { _id: string };
export type SystemHealthCheckDocument = InferSchemaType<typeof SystemHealthCheckSchema> & { _id: string };

export const HQReferralModel = model('HQReferral', ReferralSchema);
export const WalletLedgerModel = model('WalletLedger', WalletLedgerSchema);
export const HQEventModel = model('HQEvent', HQEventSchema);
export const ContentDraftModel = model('ContentDraft', ContentDraftSchema);
export const ContentAssetModel = model('ContentAsset', ContentAssetSchema);
export const HQPublishingJobModel = model('HQPublishingJob', PublishingJobSchema);
export const PerformanceResultModel = model('PerformanceResult', PerformanceResultSchema);
export const SystemHealthCheckModel = model('SystemHealthCheck', SystemHealthCheckSchema);
