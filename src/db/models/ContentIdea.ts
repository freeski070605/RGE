import { InferSchemaType, Schema, model } from 'mongoose';

const ContentIdeaSchema = new Schema(
  {
    signalIds: {
      type: [Schema.Types.ObjectId],
      ref: 'GameSignal',
      default: []
    },
    ideaType: {
      type: String,
      required: true,
      index: true
    },
    goal: {
      type: String,
      required: true
    },
    audience: {
      type: String,
      required: true
    },
    platformRecommendation: {
      type: [String],
      default: []
    },
    priorityScore: {
      type: Number,
      default: 0,
      index: true
    },
    headline: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      default: ''
    },
    hookAngle: {
      type: String,
      default: ''
    },
    ctaAngle: {
      type: String,
      default: ''
    },
    linkedPlayers: {
      type: [String],
      default: []
    },
    linkedAssets: {
      type: [Schema.Types.ObjectId],
      ref: 'Asset',
      default: []
    },
    campaignTags: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['proposed', 'approved', 'briefed', 'variant_ready', 'scheduled', 'published', 'archived'],
      default: 'proposed',
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'content_ideas'
  }
);

export type ContentIdeaDocument = InferSchemaType<typeof ContentIdeaSchema> & { _id: string };

export const ContentIdeaModel = model('ContentIdea', ContentIdeaSchema);
