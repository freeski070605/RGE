import { InferSchemaType, Schema, model } from 'mongoose';

const PublishingJobSchema = new Schema(
  {
    contentVariantId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentVariant',
      required: true,
      index: true
    },
    contentItemId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentItem',
      index: true
    },
    platform: {
      type: String,
      required: true,
      index: true
    },
    scheduledFor: Date,
    publishedAt: Date,
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'processing', 'published', 'failed'],
      default: 'draft',
      index: true
    },
    captionSnapshot: {
      type: String,
      default: ''
    },
    mediaSnapshot: {
      imagePath: String,
      videoPath: String,
      imagePublicUrl: String,
      videoPublicUrl: String,
      imageRemoteUrl: String,
      videoRemoteUrl: String
    },
    providerResponse: {
      type: Schema.Types.Mixed,
      default: {}
    },
    errorMessage: String
  },
  {
    timestamps: true,
    collection: 'publishing_jobs'
  }
);

export type PublishingJobDocument = InferSchemaType<typeof PublishingJobSchema> & { _id: string };

export const PublishingJobModel = model('PublishingJob', PublishingJobSchema);
