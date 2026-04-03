import { Worker } from 'bullmq';
import { connectDatabase } from '../config/db';
import { env } from '../config/env';
import { createRedisConnection } from '../config/redis';
import { enqueueMediaCreation, queueNames } from '../queues';
import { generateContentForPost } from '../services/content-engine/contentEngine';

const startContentWorker = async () => {
  await connectDatabase();

  const worker = new Worker(
    queueNames.content,
    async (job: { data: { postId: string } }) => {
      await generateContentForPost(job.data.postId);
      await enqueueMediaCreation({ targetType: 'post', postId: job.data.postId });
    },
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

  return worker;
};

if (require.main === module) {
  startContentWorker().catch((error) => {
    console.error('Failed to start content worker', error);
    process.exit(1);
  });
}

export default startContentWorker;
