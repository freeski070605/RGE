import { env } from '../../config/env';
import { WorkerHeartbeatModel } from '../../db/models/WorkerHeartbeat';
import { queueNames } from '../../queues';

const expectedWorkers = [
  {
    key: 'intelligence',
    workerName: 'intelligence-worker',
    queueName: queueNames.intelligence
  },
  {
    key: 'content',
    workerName: 'content-worker',
    queueName: queueNames.content
  },
  {
    key: 'media',
    workerName: 'media-worker',
    queueName: queueNames.media
  },
  {
    key: 'scheduler',
    workerName: 'scheduler-worker',
    queueName: queueNames.scheduler
  }
] as const;

type WorkerStatusKey = (typeof expectedWorkers)[number]['key'];

export const getWorkersStatus = async () => {
  const heartbeats = await WorkerHeartbeatModel.find({
    workerName: { $in: expectedWorkers.map((worker) => worker.workerName) }
  })
    .sort({ workerName: 1 })
    .lean();

  const heartbeatsByName = new Map(heartbeats.map((heartbeat) => [heartbeat.workerName, heartbeat]));
  const workers = Object.fromEntries(
    expectedWorkers.map((worker) => {
      const heartbeat = heartbeatsByName.get(worker.workerName);
      const isStale = heartbeat
        ? Date.now() - heartbeat.lastHeartbeatAt.getTime() > env.WORKER_HEARTBEAT_STALE_MS
        : true;

      const status = heartbeat && !isStale && heartbeat.status === 'healthy' ? 'ok' : 'error';
      const detail = !heartbeat
        ? 'No heartbeat received'
        : isStale
          ? 'Heartbeat is stale'
          : heartbeat.status === 'healthy'
            ? 'Worker healthy'
            : `Worker reported ${heartbeat.status}`;

      return [
        worker.key,
        {
          status,
          detail,
          workerName: worker.workerName,
          queueName: worker.queueName,
          lastHeartbeatAt: heartbeat?.lastHeartbeatAt ?? null,
          heartbeatStatus: heartbeat?.status ?? 'missing',
          metadata: heartbeat?.metadata ?? {}
        }
      ];
    })
  ) as Record<
    WorkerStatusKey,
    {
      status: 'ok' | 'error';
      detail: string;
      workerName: string;
      queueName: string;
      lastHeartbeatAt: Date | null;
      heartbeatStatus: string;
      metadata: Record<string, unknown>;
    }
  >;

  const workerValues = Object.values(workers);
  const okCount = workerValues.filter((worker) => worker.status === 'ok').length;

  return {
    summary: {
      status: okCount === workerValues.length ? 'ok' : 'error',
      okCount,
      total: workerValues.length
    },
    workers
  };
};
