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
import { getDurationMs, logError, logInfo } from '../utils/structuredLogger';

export const processMediaJobData = async (
  job: { id?: string | number | null; data: { targetType: 'post'; postId: string } | { targetType: 'variant'; variantId: string } }
) => {
  const startedAt = Date.now();
  const jobId = job.id != null ? String(job.id) : null;

  if (job.data.targetType === 'variant') {
    logInfo({
      area: 'media',
      action: 'process-media-job',
      status: 'started',
      jobId,
      variantId: job.data.variantId,
      message: 'Variant media job picked up by worker'
    });
    await markVariantMediaProcessing(job.data.variantId, jobId);
    try {
      await createMediaForVariant(job.data.variantId);
      await maybeAutoScheduleContentItemFromVariant(job.data.variantId);
      logInfo({
        area: 'media',
        action: 'process-media-job',
        status: 'completed',
        jobId,
        variantId: job.data.variantId,
        durationMs: getDurationMs(startedAt),
        message: 'Variant media job completed'
      });
    } catch (error) {
      await markVariantMediaFailed(
        job.data.variantId,
        error instanceof Error ? error.message : 'Media render failed',
        jobId
      );
      logError({
        area: 'media',
        action: 'process-media-job',
        status: 'failed',
        jobId,
        variantId: job.data.variantId,
        durationMs: getDurationMs(startedAt),
        error: error instanceof Error ? error.message : 'Media render failed',
        message: 'Variant media job failed'
      });
      throw error;
    }
    return;
  }

  logInfo({
    area: 'media',
    action: 'process-media-job',
    status: 'started',
    jobId,
    postId: job.data.postId,
    message: 'Post media job picked up by worker'
  });
  await markPostMediaProcessing(job.data.postId, jobId);
  try {
    await createMediaForPost(job.data.postId);
    logInfo({
      area: 'media',
      action: 'process-media-job',
      status: 'completed',
      jobId,
      postId: job.data.postId,
      durationMs: getDurationMs(startedAt),
      message: 'Post media job completed'
    });
  } catch (error) {
    await markPostMediaFailed(job.data.postId, error instanceof Error ? error.message : 'Media render failed', jobId);
    logError({
      area: 'media',
      action: 'process-media-job',
      status: 'failed',
      jobId,
      postId: job.data.postId,
      durationMs: getDurationMs(startedAt),
      error: error instanceof Error ? error.message : 'Media render failed',
      message: 'Post media job failed'
    });
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
      concurrency: env.MEDIA_WORKER_CONCURRENCY,
      lockDuration: env.MEDIA_JOB_LOCK_DURATION_MS,
      stalledInterval: env.MEDIA_JOB_STALLED_INTERVAL_MS,
      maxStalledCount: env.MEDIA_JOB_MAX_STALLED_COUNT
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
