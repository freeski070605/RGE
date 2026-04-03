import { InferSchemaType, Schema, model } from 'mongoose';

const PerformanceInsightSchema = new Schema(
  {
    publishingJobId: {
      type: Schema.Types.ObjectId,
      ref: 'PublishingJob',
      required: true,
      unique: true,
      index: true
    },
    contentVariantId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentVariant',
      required: true,
      index: true
    },
    platform: {
      type: String,
      required: true
    },
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
    hookStyle: {
      type: String,
      default: ''
    },
    contentType: {
      type: String,
      default: ''
    },
    assetType: {
      type: String,
      default: ''
    },
    variantLabel: {
      type: String,
      default: ''
    },
    performanceScore: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    collection: 'performance_insights'
  }
);

export type PerformanceInsightDocument = InferSchemaType<typeof PerformanceInsightSchema> & { _id: string };

export const PerformanceInsightModel = model('PerformanceInsight', PerformanceInsightSchema);
