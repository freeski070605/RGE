import { Worker } from 'bullmq';
import { connectDatabase } from '../config/db';
import { env } from '../config/env';
import { createRedisConnection } from '../config/redis';
import { queueNames } from '../queues';
import { executePublishingJob } from '../services/growth/opsService';
import { publishPost } from '../services/scheduler/schedulerService';
import { startWorkerHeartbeat } from '../services/system/workerHeartbeatService';

export const processSchedulerJobData = async (
  job: {
    data:
      | { targetType: 'post'; postId: string; platforms: string[] }
      | { targetType: 'publishing-job'; publishingJobId: string };
  }
) => {
  if (job.data.targetType === 'publishing-job') {
    await executePublishingJob(job.data.publishingJobId);
    return;
  }

  await publishPost(job.data.postId, job.data.platforms);
};

const startSchedulerWorker = async () => {
  await connectDatabase();
  const heartbeat = startWorkerHeartbeat({
    workerName: 'scheduler-worker',
    queueName: queueNames.scheduler
  });
  await heartbeat.start();

  const worker = new Worker(
    queueNames.scheduler,
    processSchedulerJobData,
    {
      connection: createRedisConnection(),
      concurrency: env.SCHEDULER_WORKER_CONCURRENCY
    }
  );

  worker.on('completed', (job) => {
    console.log(`Scheduler job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`Scheduler job ${job?.id ?? 'unknown'} failed`, error);
  });

  worker.on('closing', () => {
    void heartbeat.stop('stopped');
  });

  worker.on('error', (error) => {
    console.error('Scheduler worker connection error', error);
    void heartbeat.stop('degraded');
  });

  return worker;
};

if (require.main === module) {
  startSchedulerWorker().catch((error) => {
    console.error('Failed to start scheduler worker', error);
    process.exit(1);
  });
}

export default startSchedulerWorker;
