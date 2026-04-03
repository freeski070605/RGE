import { InferSchemaType, Schema, model } from 'mongoose';

const WorkerHeartbeatSchema = new Schema(
  {
    workerName: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    queueName: {
      type: String,
      required: true
    },
    lastHeartbeatAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['starting', 'healthy', 'degraded', 'stopped'],
      default: 'starting'
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: 'worker_heartbeats'
  }
);

export type WorkerHeartbeatDocument = InferSchemaType<typeof WorkerHeartbeatSchema> & { _id: string };

export const WorkerHeartbeatModel = model('WorkerHeartbeat', WorkerHeartbeatSchema);
