import { InferSchemaType, Schema, model } from 'mongoose';

const PostSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true
    },
    assetIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'Asset'
        }
      ],
      default: []
    },
    platforms: {
      type: [String],
      default: []
    },
    caption: {
      type: String,
      default: ''
    },
    captionOptions: {
      type: [String],
      default: []
    },
    hook: {
      type: String,
      default: ''
    },
    hashtags: {
      type: [String],
      default: []
    },
    cta: {
      type: String,
      default: ''
    },
    overlayText: {
      type: String,
      default: ''
    },
    aiMetadata: {
      model: String,
      promptVersion: {
        type: String,
        default: 'v1'
      },
      strategyNotes: {
        type: [String],
        default: []
      }
    },
    media: {
      status: {
        type: String,
        enum: ['pending', 'queued', 'processing', 'succeeded', 'ready', 'failed'],
        default: 'pending'
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
    schedule: {
      status: {
        type: String,
        enum: ['draft', 'content_ready', 'media_ready', 'scheduled', 'posted', 'failed'],
        default: 'draft'
      },
      scheduledFor: Date,
      publishedAt: Date,
      lastAttemptAt: Date,
      providerResponse: {
        type: Schema.Types.Mixed,
        default: {}
      },
      errorMessage: String
    }
  },
  {
    timestamps: true,
    collection: 'posts'
  }
);

export type PostDocument = InferSchemaType<typeof PostSchema> & { _id: string };

export const PostModel = model('Post', PostSchema);
