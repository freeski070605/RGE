import { WorkerHeartbeatModel } from '../../db/models/WorkerHeartbeat';

export const updateWorkerHeartbeat = async (input: {
  workerName: string;
  queueName: string;
  status: 'starting' | 'healthy' | 'degraded' | 'stopped';
  metadata?: Record<string, unknown>;
}) =>
  WorkerHeartbeatModel.findOneAndUpdate(
    { workerName: input.workerName },
    {
      $set: {
        queueName: input.queueName,
        status: input.status,
        metadata: input.metadata ?? {},
        lastHeartbeatAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

export const startWorkerHeartbeat = (input: {
  workerName: string;
  queueName: string;
  metadata?: Record<string, unknown>;
}) => {
  let interval: NodeJS.Timeout | null = null;

  const beat = async (status: 'starting' | 'healthy' | 'degraded' | 'stopped') => {
    try {
      await updateWorkerHeartbeat({
        workerName: input.workerName,
        queueName: input.queueName,
        status,
        metadata: input.metadata
      });
    } catch (error) {
      console.error(`Failed to update heartbeat for ${input.workerName}`, error);
    }
  };

  const start = async () => {
    await beat('starting');
    interval = setInterval(() => {
      void beat('healthy');
    }, 30_000);
    interval.unref();
  };

  const stop = async (status: 'degraded' | 'stopped') => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    await beat(status);
  };

  return {
    start,
    stop
  };
};
