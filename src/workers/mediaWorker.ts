import { Worker } from 'bullmq';
import { connectDatabase } from '../config/db';
import { env } from '../config/env';
import { createRedisConnection } from '../config/redis';
import { queueNames } from '../queues';
import {
  createMediaForVariant,
  markVariantMediaFailed,
  markVariantMediaProcessing
} from '../services/growth/opsService';
import {
  createMediaForPost,
  markPostMediaFailed,
  markPostMediaProcessing
} from '../services/media-engine/mediaEngine';
import { maybeAutoScheduleContentItemFromVariant } from '../services/operator/contentItemService';
import { startWorkerHeartbeat } from '../services/system/workerHeartbeatService';

export const processMediaJobData = async (
  job: { id?: string | number | null; data: { targetType: 'post'; postId: string } | { targetType: 'variant'; variantId: string } }
) => {
  const jobId = job.id != null ? String(job.id) : null;

  if (job.data.targetType === 'variant') {
    await markVariantMediaProcessing(job.data.variantId, jobId);
    try {
      await createMediaForVariant(job.data.variantId);
      await maybeAutoScheduleContentItemFromVariant(job.data.variantId);
    } catch (error) {
      await markVariantMediaFailed(
        job.data.variantId,
        error instanceof Error ? error.message : 'Media render failed',
        jobId
      );
      throw error;
    }
    return;
  }

  await markPostMediaProcessing(job.data.postId, jobId);
  try {
    await createMediaForPost(job.data.postId);
  } catch (error) {
    await markPostMediaFailed(job.data.postId, error instanceof Error ? error.message : 'Media render failed', jobId);
    throw error;
  }
};

const startMediaWorker = async () => {
  await connectDatabase();
  const heartbeat = startWorkerHeartbeat({
    workerName: 'media-worker',
    queueName: queueNames.media
  });
  await heartbeat.start();

  const worker = new Worker(
    queueNames.media,
    processMediaJobData,
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

  worker.on('closing', () => {
    void heartbeat.stop('stopped');
  });

  worker.on('error', (error) => {
    console.error('Media worker connection error', error);
    void heartbeat.stop('degraded');
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
