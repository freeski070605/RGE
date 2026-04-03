import { InferSchemaType, Schema, model } from 'mongoose';

const EventSchema = new Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: ['reem', 'win', 'streak', 'table_amount', 'deposit', 'signup', 'custom']
    },
    playerId: {
      type: String,
      required: true,
      index: true
    },
    amount: {
      type: Number,
      default: 0
    },
    turns: {
      type: Number,
      default: 0
    },
    streak: {
      type: Number,
      default: 0
    },
    tableAmount: {
      type: Number,
      default: 0
    },
    source: {
      type: String,
      default: 'manual'
    },
    status: {
      type: String,
      enum: ['received', 'processed', 'failed'],
      default: 'received'
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: 'events'
  }
);

export type EventDocument = InferSchemaType<typeof EventSchema> & { _id: string };

export const EventModel = model('Event', EventSchema);
