import { InferSchemaType, Schema, model } from 'mongoose';

const ContentItemScheduleSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['unscheduled', 'scheduled', 'published', 'failed'],
      default: 'unscheduled'
    },
    scheduledFor: Date,
    publishedAt: Date,
    bestTimeWindow: String,
    lastError: String
  },
  { _id: false }
);

const ContentItemAnalyticsSchema = new Schema(
  {
    clicks: {
      type: Number,
      default: 0
    },
    signups: {
      type: Number,
      default: 0
    },
    deposits: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    comments: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    saves: {
      type: Number,
      default: 0
    },
    impressions: {
      type: Number,
      default: 0
    },
    performanceScore: {
      type: Number,
      default: 0
    },
    baselineDelta: {
      type: Number,
      default: 0
    },
    conversionInfluence: {
      type: Number,
      default: 0
    },
    trend: {
      type: String,
      enum: ['new', 'stable', 'winning', 'underperforming'],
      default: 'new'
    },
    updatedAt: Date
  },
  { _id: false }
);

const ContentItemSchema = new Schema(
  {
    sourceOpportunityId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentIdea',
      required: true,
      index: true
    },
    sourceSignalIds: {
      type: [Schema.Types.ObjectId],
      ref: 'GameSignal',
      default: []
    },
    sourceEventIds: {
      type: [String],
      default: []
    },
    title: {
      type: String,
      required: true
    },
    opportunityType: {
      type: String,
      required: true,
      index: true
    },
    whyItMatters: {
      type: String,
      default: ''
    },
    strategyAngle: {
      type: String,
      default: ''
    },
    recommendationWhy: {
      type: String,
      default: ''
    },
    hookDirection: {
      type: String,
      default: ''
    },
    recommendedFormat: {
      type: String,
      default: 'reel'
    },
    recommendedPlatforms: {
      type: [String],
      default: ['instagram']
    },
    templateRecommendation: {
      type: String,
      default: ''
    },
    selectedVisualPreset: {
      type: String,
      default: 'Momentum Spotlight'
    },
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    confidenceScore: {
      type: Number,
      default: 0
    },
    estimatedValue: {
      type: Number,
      default: 0
    },
    operatorMode: {
      type: String,
      enum: ['autopilot', 'assisted', 'manual'],
      default: 'assisted'
    },
    stage: {
      type: String,
      enum: [
        'new_opportunity',
        'draft_ready',
        'needs_review',
        'approved',
        'scheduled',
        'published',
        'underperforming',
        'archived',
        'wont_use'
      ],
      default: 'new_opportunity',
      index: true
    },
    briefId: {
      type: Schema.Types.ObjectId,
      ref: 'CreativeBrief'
    },
    variantIds: {
      type: [Schema.Types.ObjectId],
      ref: 'ContentVariant',
      default: []
    },
    selectedVariantId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentVariant'
    },
    selectedMediaAssetIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Asset',
      default: []
    },
    publishingJobIds: {
      type: [Schema.Types.ObjectId],
      ref: 'PublishingJob',
      default: []
    },
    schedule: {
      type: ContentItemScheduleSchema,
      default: {}
    },
    analyticsSummary: {
      type: ContentItemAnalyticsSchema,
      default: {}
    },
    reviewNotes: {
      type: [String],
      default: []
    },
    needsAttention: {
      type: Boolean,
      default: true
    },
    dismissedAt: Date,
    archivedAt: Date,
    createdBy: {
      type: String,
      default: 'system'
    }
  },
  {
    timestamps: true,
    collection: 'content_items'
  }
);

export type ContentItemDocument = InferSchemaType<typeof ContentItemSchema> & { _id: string };

export const ContentItemModel = model('ContentItem', ContentItemSchema);
