import { Worker } from 'bullmq';
import { connectDatabase } from '../config/db';
import { env } from '../config/env';
import { createRedisConnection } from '../config/redis';
import { queueNames } from '../queues';
import { createMediaForVariant } from '../services/growth/opsService';
import { createMediaForPost } from '../services/media-engine/mediaEngine';

const startMediaWorker = async () => {
  await connectDatabase();

  const worker = new Worker(
    queueNames.media,
    async (job: { data: { targetType: 'post'; postId: string } | { targetType: 'variant'; variantId: string } }) => {
      if (job.data.targetType === 'variant') {
        await createMediaForVariant(job.data.variantId);
        return;
      }

      await createMediaForPost(job.data.postId);
    },
    {
      connection: createRedisConnection(),
      concurrency: env.MEDIA_WORKER_CONCURRENCY
    }
  );

  worker.on('completed', (job) => {
    console.log(`Media job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`Media job ${job?.id ?? 'unknown'} failed`, error);
  });

  return worker;
};

if (require.main === module) {
  startMediaWorker().catch((error) => {
    console.error('Failed to start media worker', error);
    process.exit(1);
  });
}

export default startMediaWorker;
