import { Worker } from 'bullmq';
import { connectDatabase } from '../config/db';
import { env } from '../config/env';
import { createRedisConnection } from '../config/redis';
import { queueNames } from '../queues';
import { syncGameIntelligence } from '../services/intelligence/intelligenceService';
import { startWorkerHeartbeat } from '../services/system/workerHeartbeatService';

export const processIntelligenceJobData = async (job: { data: { days?: number } }) => {
  await syncGameIntelligence(job.data.days ?? env.RGE_SYNC_DAYS);
};

const startIntelligenceWorker = async () => {
  await connectDatabase();
  const heartbeat = startWorkerHeartbeat({
    workerName: 'intelligence-worker',
    queueName: queueNames.intelligence
  });
  await heartbeat.start();

  const worker = new Worker(
    queueNames.intelligence,
    processIntelligenceJobData,
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

  worker.on('closing', () => {
    void heartbeat.stop('stopped');
  });

  worker.on('error', (error) => {
    console.error('Intelligence worker connection error', error);
    void heartbeat.stop('degraded');
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
