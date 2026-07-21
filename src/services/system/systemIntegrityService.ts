import fs from 'fs/promises';
import { ContentItemModel } from '../../db/models/ContentItem';
import { ContentVariantModel } from '../../db/models/ContentVariant';
import { PostModel } from '../../db/models/Post';
import { PublishingJobModel } from '../../db/models/PublishingJob';
import { isActiveMediaStatus, isCompletedMediaStatus, normalizeMediaStatus } from '../../utils/mediaStatus';
import { toMediaUrl } from '../../utils/publicPaths';
import { getMediaDiagnostics, getSystemHealth } from './systemHealthService';
import { getWorkersStatus } from './workerStatusService';

const toIntegrityStatus = (status?: string | null) => (status === 'healthy' ? 'ok' : 'error');
const toWorkerIntegrityStatus = (status?: string | null) => (status === 'ok' ? 'ok' : 'error');

const buildIssue = (input: {
  code: string;
  severity: 'warning' | 'critical';
  summary: string;
  details?: string;
  entityType?: string;
  entityId?: string | null;
  action?: string;
}) => ({
  ...input,
  detectedAt: new Date().toISOString()
});

const hasPublishingMediaSnapshot = (job: any) =>
  Boolean(
    job?.mediaSnapshot?.imagePath ||
      job?.mediaSnapshot?.videoPath ||
      job?.mediaSnapshot?.imagePublicUrl ||
      job?.mediaSnapshot?.videoPublicUrl ||
      job?.mediaSnapshot?.imageRemoteUrl ||
      job?.mediaSnapshot?.videoRemoteUrl
  );

const getArtifactPreviewUrl = (media: any) =>
  media?.videoPublicUrl ||
  media?.imagePublicUrl ||
  media?.videoRemoteUrl ||
  media?.imageRemoteUrl ||
  toMediaUrl(media?.videoPath || media?.imagePath);

const collectMediaArtifactIssues = async () => {
  const [variants, posts] = await Promise.all([
    ContentVariantModel.find({
      'media.status': { $in: ['completed', 'succeeded', 'ready', 'failed', 'queued', 'processing'] }
    })
      .sort({ 'media.lastFinishedAt': -1, updatedAt: -1 })
      .limit(40)
      .select('_id contentItemId media')
      .lean(),
    PostModel.find({
      'media.status': { $in: ['completed', 'succeeded', 'ready', 'failed', 'queued', 'processing'] }
    })
      .sort({ 'media.lastFinishedAt': -1, updatedAt: -1 })
      .limit(40)
      .select('_id media')
      .lean()
  ]);

  const issues: Array<ReturnType<typeof buildIssue>> = [];
  const staleCutoff = Date.now() - 30 * 60 * 1000;

  for (const record of [...variants, ...posts]) {
    const media = record.media ?? {};
    const status = normalizeMediaStatus(media.status);
    const entityType = 'contentItemId' in record ? 'content_variant' : 'post';
    const entityId = String(record._id);
    const contentItemId = 'contentItemId' in record && record.contentItemId ? String(record.contentItemId) : null;
    const localPath = media.videoPath || media.imagePath || null;
    const previewUrl = getArtifactPreviewUrl(media);

    if (isCompletedMediaStatus(status)) {
      if (!localPath) {
        issues.push(
          buildIssue({
            code: 'media_completed_without_file_path',
            severity: 'critical',
            summary: 'A completed media record is missing its file path',
            details: `Expected a local media path for ${entityType} ${entityId}.`,
            entityType,
            entityId,
            action: contentItemId ? `Open content item ${contentItemId} and regenerate media.` : 'Regenerate media.'
          })
        );
        continue;
      }

      try {
        const stats = await fs.stat(localPath);
        if (!stats.isFile() || stats.size <= 0) {
          issues.push(
            buildIssue({
              code: 'media_completed_with_invalid_file',
              severity: 'critical',
              summary: 'A completed media file is missing or empty on disk',
              details: `Path ${localPath} is not a valid file for ${entityType} ${entityId}.`,
              entityType,
              entityId,
              action: contentItemId ? `Open content item ${contentItemId} and regenerate media.` : 'Regenerate media.'
            })
          );
        }
      } catch (error) {
        issues.push(
          buildIssue({
            code: 'media_completed_file_missing',
            severity: 'critical',
            summary: 'A completed media file is missing from disk',
            details: error instanceof Error ? error.message : `Missing file for ${entityType} ${entityId}.`,
            entityType,
            entityId,
            action: contentItemId ? `Open content item ${contentItemId} and regenerate media.` : 'Regenerate media.'
          })
        );
      }

      if (!previewUrl) {
        issues.push(
          buildIssue({
            code: 'media_completed_without_preview_url',
            severity: 'critical',
            summary: 'A completed media record has no preview URL',
            details: `No public preview URL could be derived for ${entityType} ${entityId}.`,
            entityType,
            entityId,
            action: contentItemId ? `Open content item ${contentItemId} and regenerate media.` : 'Regenerate media.'
          })
        );
      }
    }

    if (isActiveMediaStatus(status)) {
      const startedAt = media.lastStartedAt ? new Date(media.lastStartedAt).getTime() : null;
      const queuedAt = media.lastQueuedAt ? new Date(media.lastQueuedAt).getTime() : null;
      const referenceTime = startedAt ?? queuedAt;
      if (referenceTime && referenceTime < staleCutoff) {
        issues.push(
          buildIssue({
            code: 'media_job_stalled',
            severity: 'warning',
            summary: 'A media job appears stalled',
            details: `${entityType} ${entityId} has been ${status} since ${new Date(referenceTime).toISOString()}.`,
            entityType,
            entityId,
            action: contentItemId ? `Open content item ${contentItemId} and retry media generation.` : 'Retry media generation.'
          })
        );
      }
    }

    if (status === 'failed' && !media.errorMessage) {
      issues.push(
        buildIssue({
          code: 'media_failure_missing_reason',
          severity: 'warning',
          summary: 'A media failure is missing its error reason',
          details: `${entityType} ${entityId} failed without storing an error message.`,
          entityType,
          entityId,
          action: contentItemId ? `Open content item ${contentItemId} and retry media generation.` : 'Retry media generation.'
        })
      );
    }
  }

  return issues;
};

const collectPipelineIssues = async () => {
  const [brokenContentItems, publishingJobs] = await Promise.all([
    ContentItemModel.find({
      stage: { $in: ['approved', 'scheduled', 'published'] },
      selectedVariantId: { $exists: false }
    })
      .limit(10)
      .select('_id title stage')
      .lean(),
    PublishingJobModel.find({
      status: { $in: ['scheduled', 'processing', 'published'] }
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .select('_id contentItemId contentVariantId status mediaSnapshot errorMessage')
      .lean()
  ]);

  const issues = brokenContentItems.map((item) =>
    buildIssue({
      code: 'content_item_missing_selected_variant',
      severity: 'critical',
      summary: 'A content item is missing its selected variant',
      details: `${item.title} is ${item.stage} but does not have a selected variant.`,
      entityType: 'content_item',
      entityId: String(item._id),
      action: `Open content item ${item._id} and choose a variant.`
    })
  );

  publishingJobs
    .filter((job) => !hasPublishingMediaSnapshot(job))
    .forEach((job) => {
      issues.push(
        buildIssue({
          code: 'publishing_job_missing_media_snapshot',
          severity: 'critical',
          summary: 'A publishing job is missing its media snapshot',
          details: `Publishing job ${job._id} is ${job.status} without captured media.`,
          entityType: 'publishing_job',
          entityId: String(job._id),
          action: job.contentItemId ? `Open content item ${job.contentItemId} and regenerate media.` : 'Regenerate media before publishing.'
        })
      );
    });

  return issues;
};

export const getSystemIntegrity = async () => {
  const [systemHealth, mediaDiagnostics, workersStatus, mediaArtifactIssues, pipelineIssues] = await Promise.all([
    getSystemHealth(),
    getMediaDiagnostics(),
    getWorkersStatus(),
    collectMediaArtifactIssues(),
    collectPipelineIssues()
  ]);

  const issues = [
    ...(systemHealth.backendConnectivity.status === 'healthy'
      ? []
      : [
          buildIssue({
            code: 'backend_connection_down',
            severity: 'critical',
            summary: 'The live backend feed is unavailable',
            details: systemHealth.backendConnectivity.detail,
            entityType: 'backend',
            action: 'Check BACKEND_API_BASE_URL, BACKEND_INTERNAL_TOKEN, and the live backend service.'
          })
        ]),
    ...(systemHealth.mongo.status === 'healthy'
      ? []
      : [
          buildIssue({
            code: 'mongo_down',
            severity: 'critical',
            summary: 'Mongo is unavailable',
            details: systemHealth.mongo.detail,
            entityType: 'mongo',
            action: 'Restore Mongo connectivity before relying on pipeline state.'
          })
        ]),
    ...(systemHealth.redis.status === 'healthy'
      ? []
      : [
          buildIssue({
            code: 'redis_down',
            severity: 'critical',
            summary: 'Redis is unavailable',
            details: systemHealth.redis.detail,
            entityType: 'redis',
            action: 'Restore Redis before relying on workers and queues.'
          })
        ]),
    ...Object.entries(workersStatus.workers)
      .filter(([, worker]) => worker.status !== 'ok')
      .map(([workerKey, worker]) =>
        buildIssue({
          code: `worker_${workerKey}_down`,
          severity: 'critical',
          summary: `${worker.workerName} is not healthy`,
          details: worker.detail,
          entityType: 'worker',
          entityId: worker.workerName,
          action: `Restart ${worker.workerName} and confirm its queue connection.`
        })
      ),
    ...(mediaDiagnostics.queue.status === 'down'
      ? [
          buildIssue({
            code: 'media_queue_unavailable',
            severity: 'critical',
            summary: 'The media queue is unavailable',
            details: mediaDiagnostics.queue.detail,
            entityType: 'media_queue',
            action: 'Restore Redis and the media queue before generating new media.'
          })
        ]
      : []),
    ...(mediaDiagnostics.processing.status === 'healthy'
      ? []
      : [
          buildIssue({
            code: 'media_processing_unhealthy',
            severity: mediaDiagnostics.processing.status === 'down' ? 'critical' : 'warning',
            summary: 'The media processing pipeline is unhealthy',
            details: mediaDiagnostics.processing.detail,
            entityType: 'media_pipeline',
            action: 'Check the media worker, FFmpeg, Canvas, and the failed job backlog.'
          })
        ]),
    ...(mediaDiagnostics.output.status === 'healthy'
      ? []
      : [
          buildIssue({
            code: 'media_output_unhealthy',
            severity: 'critical',
            summary: 'Media output storage is unhealthy',
            details: mediaDiagnostics.output.detail,
            entityType: 'media_output',
            action: 'Verify the media output directory and regenerate broken items.'
          })
        ]),
    ...(mediaDiagnostics.serving.status === 'healthy'
      ? []
      : [
          buildIssue({
            code: 'media_serving_unhealthy',
            severity: 'critical',
            summary: 'Media previews are not being served correctly',
            details: mediaDiagnostics.serving.detail,
            entityType: 'media_serving',
            action: 'Check Express static media serving and regenerate broken items.'
          })
        ]),
    ...mediaArtifactIssues,
    ...pipelineIssues
  ];

  return {
    backendConnection: toIntegrityStatus(systemHealth.backendConnectivity.status),
    mongo: toIntegrityStatus(systemHealth.mongo.status),
    redis: toIntegrityStatus(systemHealth.redis.status),
    workers: {
      intelligence: toWorkerIntegrityStatus(workersStatus.workers.intelligence.status),
      content: toWorkerIntegrityStatus(workersStatus.workers.content.status),
      media: toWorkerIntegrityStatus(workersStatus.workers.media.status),
      scheduler: toWorkerIntegrityStatus(workersStatus.workers.scheduler.status)
    },
    mediaPipeline: {
      queue: toIntegrityStatus(mediaDiagnostics.queue.status),
      processing: toIntegrityStatus(mediaDiagnostics.processing.status),
      output: toIntegrityStatus(mediaDiagnostics.output.status),
      serving: toIntegrityStatus(mediaDiagnostics.serving.status)
    },
    lastSuccessfulMediaJob: mediaDiagnostics.lastSuccess,
    lastFailedMediaJob: mediaDiagnostics.lastFailure.at,
    lastSync: systemHealth.lastSyncTime,
    issues
  };
};
