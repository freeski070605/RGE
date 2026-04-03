import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import Redis from 'ioredis';
import { createCanvas } from 'canvas';
import mongoose from 'mongoose';
import { env } from '../../config/env';
import { createRedisConnection } from '../../config/redis';
import { ContentVariantModel } from '../../db/models/ContentVariant';
import { GameSignalModel } from '../../db/models/GameSignal';
import { PostModel } from '../../db/models/Post';
import { mediaQueue, schedulerQueue } from '../../queues';
import { normalizeMediaStatus } from '../../utils/mediaStatus';
import { toMediaUrl } from '../../utils/publicPaths';
import { getWorkersStatus } from './workerStatusService';

const execFileAsync = promisify(execFile);

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string) =>
  Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);

const healthState = (status: 'healthy' | 'degraded' | 'down', detail: string, extra: Record<string, unknown> = {}) => ({
  status,
  detail,
  ...extra
});

const isHealthy = (status?: string | null) => status === 'healthy';

const successMediaStatuses = ['completed', 'succeeded', 'ready'];

const checkDirectory = async (directoryPath: string, label: string) => {
  try {
    await fs.access(directoryPath, fsConstants.R_OK | fsConstants.W_OK);
    return healthState('healthy', `${label} is writable`, { path: directoryPath });
  } catch (error) {
    return healthState('down', `${label} is not accessible`, {
      path: directoryPath,
      error: error instanceof Error ? error.message : 'Unknown directory access error'
    });
  }
};

const checkBackendConnectivity = async () => {
  try {
    const headers: Record<string, string> = {};
    if (env.BACKEND_INTERNAL_TOKEN) {
      headers['x-rge-token'] = env.BACKEND_INTERNAL_TOKEN;
    }

    const response = await fetch(`${env.BACKEND_API_BASE_URL.replace(/\/+$/, '')}/api/rge/feed?days=1`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(env.BACKEND_HEALTH_TIMEOUT_MS)
    });

    if (!response.ok) {
      return healthState('degraded', `Backend feed responded with ${response.status}`, {
        backendApiBaseUrl: env.BACKEND_API_BASE_URL
      });
    }

    return healthState('healthy', 'Live ReemTeam backend feed reachable', {
      backendApiBaseUrl: env.BACKEND_API_BASE_URL
    });
  } catch (error) {
    return healthState('down', 'Unable to reach the live ReemTeam backend feed', {
      backendApiBaseUrl: env.BACKEND_API_BASE_URL,
      error: error instanceof Error ? error.message : 'Unknown backend connectivity error'
    });
  }
};

const checkRedisHealth = async () => {
  const client = new Redis(createRedisConnection());
  client.on('error', () => {
    // The caller turns connection failures into explicit health states.
  });

  try {
    const result = await withTimeout(client.ping(), 2_500, 'Redis ping timed out');
    return healthState(result === 'PONG' ? 'healthy' : 'degraded', `Redis ping returned ${result}`);
  } catch (error) {
    return healthState('down', 'Redis ping failed', {
      error: error instanceof Error ? error.message : 'Unknown Redis error'
    });
  } finally {
    client.disconnect();
  }
};

const getQueueHealth = async (label: string, queue: typeof mediaQueue) => {
  try {
    const counts = await withTimeout(
      queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      2_500,
      `${label} queue timed out`
    );
    const failedCount = counts.failed ?? 0;
    return healthState(failedCount > 20 ? 'degraded' : 'healthy', `${label} queue reachable`, { counts });
  } catch (error) {
    return healthState('down', `${label} queue is unavailable`, {
      error: error instanceof Error ? error.message : 'Unknown queue error'
    });
  }
};

const checkFfmpegHealth = async () => {
  try {
    const { stdout, stderr } = await execFileAsync(env.FFMPEG_PATH, ['-version'], { timeout: 5_000 });
    const firstLine = (stdout || stderr).split(/\r?\n/).find(Boolean) || 'ffmpeg available';
    return healthState('healthy', firstLine);
  } catch (error) {
    return healthState('down', 'FFmpeg is unavailable', {
      error: error instanceof Error ? error.message : 'Unknown ffmpeg error',
      ffmpegPath: env.FFMPEG_PATH
    });
  }
};

const checkCanvasHealth = async () => {
  try {
    const canvas = createCanvas(12, 12);
    const context = canvas.getContext('2d');
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, 12, 12);
    canvas.toBuffer('image/png');
    return healthState('healthy', 'Canvas renderer available');
  } catch (error) {
    return healthState('down', 'Canvas renderer failed self-check', {
      error: error instanceof Error ? error.message : 'Unknown canvas error'
    });
  }
};

const findLatestMediaRecords = async () => {
  const [latestVariantSuccess, latestVariantFailure, latestPostSuccess, latestPostFailure] = await Promise.all([
    ContentVariantModel.findOne({
      'media.lastFinishedAt': { $exists: true },
      'media.status': { $in: successMediaStatuses }
    })
      .sort({ 'media.lastFinishedAt': -1 })
      .lean(),
    ContentVariantModel.findOne({ 'media.status': 'failed' }).sort({ 'media.lastFinishedAt': -1, updatedAt: -1 }).lean(),
    PostModel.findOne({
      'media.lastFinishedAt': { $exists: true },
      'media.status': { $in: successMediaStatuses }
    })
      .sort({ 'media.lastFinishedAt': -1 })
      .lean(),
    PostModel.findOne({ 'media.status': 'failed' }).sort({ 'media.lastFinishedAt': -1, updatedAt: -1 }).lean()
  ]);

  return {
    latestVariantSuccess,
    latestVariantFailure,
    latestPostSuccess,
    latestPostFailure
  };
};

const pickLatestMediaRecord = (records: any[]) =>
  records
    .filter((record) => record?.media?.lastFinishedAt)
    .sort(
      (left, right) =>
        new Date(right.media.lastFinishedAt).getTime() - new Date(left.media.lastFinishedAt).getTime()
    )[0] ?? null;

const getMediaArtifact = (record: any) => {
  if (!record?.media) {
    return null;
  }

  return {
    localPath: record.media.videoPath || record.media.imagePath || null,
    publicUrl:
      record.media.videoPublicUrl ||
      record.media.imagePublicUrl ||
      toMediaUrl(record.media.videoPath || record.media.imagePath) ||
      null,
    remoteUrl: record.media.videoRemoteUrl || record.media.imageRemoteUrl || null,
    lastFinishedAt: record.media.lastFinishedAt ?? null,
    errorMessage: record.media.errorMessage ?? null,
    status: normalizeMediaStatus(record.media.status)
  };
};

const checkLatestArtifact = async (
  label: string,
  artifact: ReturnType<typeof getMediaArtifact>,
  emptyState: { status: 'healthy' | 'degraded' | 'down'; detail: string }
) => {
  if (!artifact?.localPath) {
    return healthState(emptyState.status, emptyState.detail);
  }

  try {
    const stats = await fs.stat(artifact.localPath);
    if (!stats.isFile() || stats.size <= 0) {
      return healthState('down', `${label} exists in the database but not on disk`, {
        path: artifact.localPath,
        publicUrl: artifact.publicUrl
      });
    }

    if (!artifact.publicUrl) {
      return healthState('down', `${label} is missing a public URL`, {
        path: artifact.localPath
      });
    }

    return healthState('healthy', `${label} is valid and previewable`, {
      path: artifact.localPath,
      publicUrl: artifact.publicUrl,
      bytes: stats.size
    });
  } catch (error) {
    return healthState('down', `${label} is missing from disk`, {
      path: artifact.localPath,
      publicUrl: artifact.publicUrl,
      error: error instanceof Error ? error.message : 'Unknown media artifact error'
    });
  }
};

const getAverageProcessingTimeMs = async () => {
  const [variantSamples, postSamples] = await Promise.all([
    ContentVariantModel.find({
      'media.lastStartedAt': { $exists: true },
      'media.lastFinishedAt': { $exists: true }
    })
      .sort({ 'media.lastFinishedAt': -1 })
      .limit(20)
      .select('media.lastStartedAt media.lastFinishedAt')
      .lean(),
    PostModel.find({
      'media.lastStartedAt': { $exists: true },
      'media.lastFinishedAt': { $exists: true }
    })
      .sort({ 'media.lastFinishedAt': -1 })
      .limit(20)
      .select('media.lastStartedAt media.lastFinishedAt')
      .lean()
  ]);

  const durations = [...variantSamples, ...postSamples]
    .map((record: any) => ({
      startedAt: record.media?.lastStartedAt ? new Date(record.media.lastStartedAt).getTime() : null,
      finishedAt: record.media?.lastFinishedAt ? new Date(record.media.lastFinishedAt).getTime() : null
    }))
    .filter((record) => record.startedAt && record.finishedAt && record.finishedAt > record.startedAt)
    .map((record) => (record.finishedAt as number) - (record.startedAt as number));

  if (!durations.length) {
    return null;
  }

  return Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length);
};

export const getMediaDiagnostics = async () => {
  const [
    mediaQueueHealth,
    ffmpeg,
    canvas,
    mediaDirectory,
    assetDirectory,
    latestMediaRecords,
    averageProcessingTimeMs
  ] = await Promise.all([
    getQueueHealth('Media', mediaQueue),
    checkFfmpegHealth(),
    checkCanvasHealth(),
    checkDirectory(env.mediaRoot, 'Media output directory'),
    checkDirectory(env.assetRoot, 'Assets directory'),
    findLatestMediaRecords(),
    getAverageProcessingTimeMs()
  ]);

  const latestSuccessRecord = pickLatestMediaRecord([
    latestMediaRecords.latestVariantSuccess,
    latestMediaRecords.latestPostSuccess
  ]);
  const latestFailureRecord = pickLatestMediaRecord([
    latestMediaRecords.latestVariantFailure,
    latestMediaRecords.latestPostFailure
  ]);
  const latestSuccessArtifact = getMediaArtifact(latestSuccessRecord);
  const latestFailureArtifact = getMediaArtifact(latestFailureRecord);
  const output = await checkLatestArtifact('Latest completed media artifact', latestSuccessArtifact, {
    status: isHealthy(mediaDirectory.status) ? 'healthy' : 'down',
    detail: isHealthy(mediaDirectory.status)
      ? 'Media output directory is writable and ready for the next render'
      : 'Media output directory is not ready'
  });
  const serving = await checkLatestArtifact('Latest previewable media route', latestSuccessArtifact, {
    status: 'healthy',
    detail: 'Express media serving is configured and awaiting the first completed render'
  });
  const queueCounts = ((mediaQueueHealth as { counts?: Record<string, number> }).counts ?? {}) as Record<string, number>;
  const queueLength = (queueCounts.waiting ?? 0) + (queueCounts.delayed ?? 0);
  const activeJobs = queueCounts.active ?? 0;
  const failedJobs = queueCounts.failed ?? 0;
  const completedJobs = queueCounts.completed ?? 0;

  const processing =
    mediaQueueHealth.status === 'down'
      ? healthState('down', 'Media queue is unavailable')
      : ffmpeg.status === 'down' || canvas.status === 'down'
        ? healthState('down', 'Media processing dependencies are unavailable')
        : failedJobs > 0
          ? healthState('degraded', 'Media queue contains failed jobs', { failedJobs })
          : healthState('healthy', activeJobs > 0 ? 'Media jobs are processing normally' : 'Media pipeline is idle and ready', {
              activeJobs,
              queueLength
            });

  return {
    queue: mediaQueueHealth,
    processing,
    output,
    serving,
    ffmpeg,
    canvas,
    outputDirectories: {
      media: mediaDirectory,
      assets: assetDirectory
    },
    queueLength,
    activeJobs,
    failedJobs,
    completedJobs,
    averageProcessingTimeMs,
    ffmpegAvailable: ffmpeg.status === 'healthy',
    canvasAvailable: canvas.status === 'healthy',
    outputDirectoryWritable: mediaDirectory.status === 'healthy',
    assetDirectoryWritable: assetDirectory.status === 'healthy',
    lastSuccess: latestSuccessArtifact?.lastFinishedAt ?? null,
    lastFailure: {
      at: latestFailureArtifact?.lastFinishedAt ?? null,
      reason: latestFailureArtifact?.errorMessage ?? null
    }
  };
};

export const getSystemHealth = async () => {
  const [
    backendConnectivity,
    redis,
    mediaQueueHealth,
    publishingQueueHealth,
    mediaDiagnostics,
    workersStatus,
    lastSignal,
    mongoState
  ] = await Promise.all([
    checkBackendConnectivity(),
    checkRedisHealth(),
    getQueueHealth('Media', mediaQueue),
    getQueueHealth('Publishing', schedulerQueue),
    getMediaDiagnostics(),
    getWorkersStatus(),
    GameSignalModel.findOne().sort({ updatedAt: -1 }).lean(),
    Promise.resolve(mongoose.connection.readyState)
  ]);

  return {
    backendConnectivity,
    intelligenceSync: lastSignal
      ? healthState('healthy', 'Recent intelligence sync data is available', {
          lastSyncTime: lastSignal.updatedAt
        })
      : healthState('degraded', 'No intelligence sync data has been stored yet'),
    mongo: healthState(mongoState === 1 ? 'healthy' : 'down', mongoState === 1 ? 'Mongo connected' : 'Mongo disconnected'),
    redis,
    workerHealth: Object.values(workersStatus.workers).map((worker) => ({
      workerName: worker.workerName,
      queueName: worker.queueName,
      status: worker.status === 'ok' ? 'healthy' : 'down',
      lastHeartbeatAt: worker.lastHeartbeatAt
    })),
    mediaQueue: mediaQueueHealth,
    publishingQueue: publishingQueueHealth,
    assetsDirectory: mediaDiagnostics.outputDirectories.assets,
    mediaOutputDirectory: mediaDiagnostics.outputDirectories.media,
    lastSyncTime: lastSignal?.updatedAt ?? null,
    lastSuccessfulMediaRenderTime: mediaDiagnostics.lastSuccess,
    mediaDiagnostics
  };
};
