import { InferSchemaType, Schema, model } from 'mongoose';

const AssetSchema = new Schema(
  {
    originalName: {
      type: String,
      required: true
    },
    storedFilename: {
      type: String,
      required: true
    },
    kind: {
      type: String,
      enum: ['image', 'video'],
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      default: ''
    },
    tags: {
      type: [String],
      default: []
    },
    originalPath: {
      type: String,
      required: true
    },
    editedPath: String,
    editorStatus: {
      type: String,
      enum: ['original', 'edited', 'failed'],
      default: 'original'
    },
    lastEditPreset: String,
    lastEditOverlay: String,
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: 'assets'
  }
);

export type AssetDocument = InferSchemaType<typeof AssetSchema> & { _id: string };

export const AssetModel = model('Asset', AssetSchema);
