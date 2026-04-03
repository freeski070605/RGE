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
    opportunityType: {
      type: String,
      index: true
    },
    whyItMatters: {
      type: String,
      default: ''
    },
    sourceEventIds: {
      type: [String],
      default: []
    },
    recommendedContentAngle: {
      type: String,
      default: ''
    },
    recommendedFormat: {
      type: String,
      default: ''
    },
    recommendedPlatforms: {
      type: [String],
      default: []
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
    whyThisRecommendation: {
      type: String,
      default: ''
    },
    operatorStatus: {
      type: String,
      enum: ['open', 'saved', 'dismissed', 'converted'],
      default: 'open',
      index: true
    },
    savedForLaterAt: Date,
    dismissedAt: Date,
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
