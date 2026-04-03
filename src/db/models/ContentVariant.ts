import { InferSchemaType, Schema, model } from 'mongoose';

const ContentVariantSchema = new Schema(
  {
    creativeBriefId: {
      type: Schema.Types.ObjectId,
      ref: 'CreativeBrief',
      required: true,
      index: true
    },
    contentItemId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentItem',
      index: true
    },
    variantLabel: {
      type: String,
      required: true
    },
    hook: {
      type: String,
      default: ''
    },
    caption: {
      type: String,
      default: ''
    },
    hashtags: {
      type: [String],
      default: []
    },
    overlayText: {
      type: String,
      default: ''
    },
    cta: {
      type: String,
      default: ''
    },
    tone: {
      type: String,
      default: ''
    },
    hookStyle: {
      type: String,
      default: ''
    },
    assetIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Asset',
      default: []
    },
    media: {
      status: {
        type: String,
        enum: ['pending', 'queued', 'processing', 'completed', 'succeeded', 'ready', 'failed']
      },
      imagePath: String,
      videoPath: String,
      imagePublicUrl: String,
      videoPublicUrl: String,
      imageRemoteUrl: String,
      videoRemoteUrl: String,
      jobId: String,
      errorMessage: String,
      lastQueuedAt: Date,
      lastStartedAt: Date,
      lastFinishedAt: Date
    },
    aiMetadata: {
      model: String,
      promptVersion: {
        type: String,
        default: 'v2'
      },
      strategyNotes: {
        type: [String],
        default: []
      }
    },
    status: {
      type: String,
      enum: ['draft', 'ready', 'scheduled', 'published', 'archived'],
      default: 'draft',
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'content_variants'
  }
);

export type ContentVariantDocument = InferSchemaType<typeof ContentVariantSchema> & { _id: string };

export const ContentVariantModel = model('ContentVariant', ContentVariantSchema);
