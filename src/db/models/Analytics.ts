import { InferSchemaType, Schema, model } from 'mongoose';

const AnalyticsSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      unique: true,
      index: true
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
    engagement: {
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
      }
    },
    latestPlatformMetrics: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: 'analytics'
  }
);

export type AnalyticsDocument = InferSchemaType<typeof AnalyticsSchema> & { _id: string };

export const AnalyticsModel = model('Analytics', AnalyticsSchema);
