import { Job, Queue } from 'bullmq';
import { env } from '../config/env';
import { createRedisConnection } from '../config/redis';

export const queueNames = {
  intelligence: 'rge-intelligence',
  content: 'rge-content',
  media: 'rge-media',
  scheduler: 'rge-scheduler'
} as const;

const queueOptions = {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: env.QUEUE_JOB_ATTEMPTS,
    backoff: {
      type: 'exponential' as const,
      delay: 5_000
    },
    removeOnComplete: 100,
    removeOnFail: 200
  }
};

export const intelligenceQueue = new Queue(queueNames.intelligence, queueOptions);
export const contentQueue = new Queue(queueNames.content, queueOptions);
export const mediaQueue = new Queue(queueNames.media, queueOptions);
export const schedulerQueue = new Queue(queueNames.scheduler, queueOptions);

export type IntelligenceJobData = {
  days?: number;
};

export type ContentJobData = {
  postId: string;
};

export type MediaJobData =
  | {
      targetType: 'post';
      postId: string;
    }
  | {
      targetType: 'variant';
      variantId: string;
    };

export type ScheduleJobData =
  | {
      targetType: 'post';
      postId: string;
      scheduledFor: string;
      platforms: string[];
    }
  | {
      targetType: 'publishing-job';
      publishingJobId: string;
      scheduledFor: string;
    };

export const enqueueIntelligenceSync = (data: IntelligenceJobData): Promise<Job<IntelligenceJobData>> =>
  intelligenceQueue.add('sync-intelligence', data);

export const enqueueContentGeneration = (data: ContentJobData): Promise<Job<ContentJobData>> =>
  contentQueue.add('generate-content', data);

export const enqueueMediaCreation = (data: MediaJobData): Promise<Job<MediaJobData>> =>
  mediaQueue.add('create-media', data);

export const schedulePostPublishing = (data: ScheduleJobData): Promise<Job<ScheduleJobData>> => {
  const delay = Math.max(new Date(data.scheduledFor).getTime() - Date.now(), 0);

  return schedulerQueue.add('publish-post', data, {
    delay
  });
};

export const schedulePublishingJobExecution = (data: Extract<ScheduleJobData, { targetType: 'publishing-job' }>) =>
  schedulePostPublishing(data);

export const closeQueues = async (): Promise<void> => {
  await Promise.all([intelligenceQueue.close(), contentQueue.close(), mediaQueue.close(), schedulerQueue.close()]);
};
