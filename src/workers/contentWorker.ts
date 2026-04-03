import { Worker } from 'bullmq';
import { connectDatabase } from '../config/db';
import { env } from '../config/env';
import { createRedisConnection } from '../config/redis';
import { enqueueMediaCreation, queueNames } from '../queues';
import { generateContentForPost } from '../services/content-engine/contentEngine';
import { startWorkerHeartbeat } from '../services/system/workerHeartbeatService';

export const processContentJobData = async (job: { data: { postId: string } }) => {
  await generateContentForPost(job.data.postId);
  await enqueueMediaCreation({ targetType: 'post', postId: job.data.postId });
};

const startContentWorker = async () => {
  await connectDatabase();
  const heartbeat = startWorkerHeartbeat({
    workerName: 'content-worker',
    queueName: queueNames.content
  });
  await heartbeat.start();

  const worker = new Worker(
    queueNames.content,
    processContentJobData,
    {
      connection: createRedisConnection(),
      concurrency: env.CONTENT_WORKER_CONCURRENCY
    }
  );

  worker.on('completed', (job) => {
    console.log(`Content job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`Content job ${job?.id ?? 'unknown'} failed`, error);
  });

  worker.on('closing', () => {
    void heartbeat.stop('stopped');
  });

  worker.on('error', (error) => {
    console.error('Content worker connection error', error);
    void heartbeat.stop('degraded');
  });

  return worker;
};

if (require.main === module) {
  startContentWorker().catch((error) => {
    console.error('Failed to start content worker', error);
    process.exit(1);
  });
}

export default startContentWorker;
