import { randomUUID } from 'crypto';
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

const useInlineQueueDriver = env.NODE_ENV === 'test';
const createTestQueue = () =>
  ({
    add: async (_name: string, data: unknown) => createInlineJob(data),
    getJobCounts: async () => {
      throw new Error('Queue driver disabled in test mode');
    },
    close: async () => undefined
  }) as unknown as Queue;

export const intelligenceQueue = useInlineQueueDriver ? createTestQueue() : new Queue(queueNames.intelligence, queueOptions);
export const contentQueue = useInlineQueueDriver ? createTestQueue() : new Queue(queueNames.content, queueOptions);
export const mediaQueue = useInlineQueueDriver ? createTestQueue() : new Queue(queueNames.media, queueOptions);
export const schedulerQueue = useInlineQueueDriver ? createTestQueue() : new Queue(queueNames.scheduler, queueOptions);

const createInlineJob = async <T>(data: T): Promise<Job<T>> =>
  ({
    id: `inline-${randomUUID()}`,
    data
  }) as Job<T>;

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
  useInlineQueueDriver ? createInlineJob(data) : intelligenceQueue.add('sync-intelligence', data);

export const enqueueContentGeneration = (data: ContentJobData): Promise<Job<ContentJobData>> =>
  useInlineQueueDriver ? createInlineJob(data) : contentQueue.add('generate-content', data);

export const enqueueMediaCreation = (data: MediaJobData): Promise<Job<MediaJobData>> =>
  useInlineQueueDriver ? createInlineJob(data) : mediaQueue.add('create-media', data);

export const schedulePostPublishing = (data: ScheduleJobData): Promise<Job<ScheduleJobData>> => {
  if (useInlineQueueDriver) {
    return createInlineJob(data);
  }

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
