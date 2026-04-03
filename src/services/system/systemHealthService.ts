import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import Redis from 'ioredis';
import { createCanvas } from 'canvas';
import mongoose from 'mongoose';
import { env } from '../../config/env';
import { createRedisConnection } from '../../config/redis';
import { mediaQueue, schedulerQueue } from '../../queues';
import { ContentVariantModel } from '../../db/models/ContentVariant';
import { GameSignalModel } from '../../db/models/GameSignal';
import { PostModel } from '../../db/models/Post';
import { WorkerHeartbeatModel } from '../../db/models/WorkerHeartbeat';

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

const checkDirectory = async (directoryPath: string, label: string) => {
  try {
    await fs.access(directoryPath);
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

export const getMediaDiagnostics = async () => {
  const [mediaQueueHealth, ffmpeg, canvas, mediaDirectory, assetDirectory, lastVariantSuccess, lastVariantFailure, lastPostSuccess, lastPostFailure] =
    await Promise.all([
      getQueueHealth('Media', mediaQueue),
      checkFfmpegHealth(),
      checkCanvasHealth(),
      checkDirectory(env.mediaRoot, 'Media output directory'),
      checkDirectory(env.assetRoot, 'Assets directory'),
      ContentVariantModel.findOne({ 'media.lastFinishedAt': { $exists: true }, 'media.status': { $in: ['succeeded', 'ready'] } })
        .sort({ 'media.lastFinishedAt': -1 })
        .lean(),
      ContentVariantModel.findOne({ 'media.status': 'failed' }).sort({ 'media.lastFinishedAt': -1, updatedAt: -1 }).lean(),
      PostModel.findOne({ 'media.lastFinishedAt': { $exists: true }, 'media.status': { $in: ['succeeded', 'ready'] } })
        .sort({ 'media.lastFinishedAt': -1 })
        .lean(),
      PostModel.findOne({ 'media.status': 'failed' }).sort({ 'media.lastFinishedAt': -1, updatedAt: -1 }).lean()
    ]);

  return {
    queue: mediaQueueHealth,
    ffmpeg,
    canvas,
    outputDirectories: {
      media: mediaDirectory,
      assets: assetDirectory
    },
    lastSuccess: lastVariantSuccess?.media?.lastFinishedAt ?? lastPostSuccess?.media?.lastFinishedAt ?? null,
    lastFailure: {
      at: lastVariantFailure?.media?.lastFinishedAt ?? lastPostFailure?.media?.lastFinishedAt ?? null,
      reason: lastVariantFailure?.media?.errorMessage ?? lastPostFailure?.media?.errorMessage ?? null
    }
  };
};

export const getSystemHealth = async () => {
  const [backendConnectivity, redis, mediaQueueHealth, publishingQueueHealth, mediaDiagnostics, workerHeartbeats, lastSignal, mongoState] =
    await Promise.all([
      checkBackendConnectivity(),
      checkRedisHealth(),
      getQueueHealth('Media', mediaQueue),
      getQueueHealth('Publishing', schedulerQueue),
      getMediaDiagnostics(),
      WorkerHeartbeatModel.find().sort({ workerName: 1 }).lean(),
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
    workerHealth: workerHeartbeats.map((heartbeat) => ({
      workerName: heartbeat.workerName,
      queueName: heartbeat.queueName,
      status:
        Date.now() - heartbeat.lastHeartbeatAt.getTime() <= env.WORKER_HEARTBEAT_STALE_MS
          ? heartbeat.status
          : 'degraded',
      lastHeartbeatAt: heartbeat.lastHeartbeatAt
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
