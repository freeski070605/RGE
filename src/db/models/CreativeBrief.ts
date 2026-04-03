import { InferSchemaType, Schema, model } from 'mongoose';

const CreativeBriefSchema = new Schema(
  {
    contentIdeaId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentIdea',
      required: true,
      index: true
    },
    contentItemId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentItem',
      index: true
    },
    objective: {
      type: String,
      required: true
    },
    audience: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      required: true
    },
    format: {
      type: String,
      required: true
    },
    tone: {
      type: String,
      required: true
    },
    hookDirection: {
      type: String,
      required: true
    },
    cta: {
      type: String,
      required: true
    },
    requiredAssetKinds: {
      type: [String],
      default: []
    },
    assetIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Asset',
      default: []
    },
    notes: {
      type: [String],
      default: []
    },
    generationPrompt: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['draft', 'approved', 'variants_generated', 'archived'],
      default: 'draft',
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'creative_briefs'
  }
);

export type CreativeBriefDocument = InferSchemaType<typeof CreativeBriefSchema> & { _id: string };

export const CreativeBriefModel = model('CreativeBrief', CreativeBriefSchema);
