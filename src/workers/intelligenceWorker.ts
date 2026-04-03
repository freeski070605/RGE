import { Worker } from 'bullmq';
import { connectDatabase } from '../config/db';
import { env } from '../config/env';
import { createRedisConnection } from '../config/redis';
import { queueNames } from '../queues';
import { syncGameIntelligence } from '../services/intelligence/intelligenceService';

const startIntelligenceWorker = async () => {
  await connectDatabase();

  const worker = new Worker(
    queueNames.intelligence,
    async (job: { data: { days?: number } }) => {
      await syncGameIntelligence(job.data.days ?? env.RGE_SYNC_DAYS);
    },
    {
      connection: createRedisConnection(),
      concurrency: env.INTELLIGENCE_WORKER_CONCURRENCY
    }
  );

  worker.on('completed', (job) => {
    console.log(`Intelligence job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`Intelligence job ${job?.id ?? 'unknown'} failed`, error);
  });

  return worker;
};

if (require.main === module) {
  startIntelligenceWorker().catch((error) => {
    console.error('Failed to start intelligence worker', error);
    process.exit(1);
  });
}

export default startIntelligenceWorker;
