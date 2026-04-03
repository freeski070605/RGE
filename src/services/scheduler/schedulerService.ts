import { initializeAnalyticsForPost } from '../analytics/analyticsService';
import { publishToSocialPlatform } from '../social/socialPublisher';
import { PostModel } from '../../db/models/Post';
import { AppError } from '../../utils/errors';
import { schedulePostPublishing } from '../../queues';

export const queuePostForPublishing = async (input: {
  postId: string;
  scheduledFor: string;
  platforms?: string[];
}) => {
  const post = await PostModel.findById(input.postId);
  if (!post) {
    throw new AppError('Post not found', 404);
  }

  const platforms = input.platforms?.length ? input.platforms : post.platforms;
  if (!platforms.length) {
    throw new AppError('At least one platform is required', 400);
  }

  const scheduledForDate = new Date(input.scheduledFor);
  if (Number.isNaN(scheduledForDate.getTime())) {
    throw new AppError('Invalid scheduledFor value', 400);
  }

  post.platforms = platforms;
  const schedule = post.schedule ?? ((post.schedule = { status: 'draft' } as never), post.schedule);
  schedule.status = 'scheduled';
  schedule.scheduledFor = scheduledForDate;
  await post.save();

  const job = await schedulePostPublishing({
    targetType: 'post',
    postId: String(post._id),
    scheduledFor: scheduledForDate.toISOString(),
    platforms
  });

  return {
    post,
    jobId: job.id
  };
};

export const publishPost = async (postId: string, platforms?: string[]) => {
  const post = await PostModel.findById(postId);
  if (!post) {
    throw new AppError('Post not found', 404);
  }

  const targetPlatforms = platforms?.length ? platforms : post.platforms;
  if (!targetPlatforms.length) {
    throw new AppError('No platforms configured for post', 400);
  }

  const publisherResults = await Promise.all(
    targetPlatforms.map((platform) =>
      publishToSocialPlatform({
        platform,
        postId: String(post._id),
        caption: `${post.hook}\n\n${post.caption}\n\n${post.hashtags.join(' ')}`,
        mediaUrl: post.media?.videoPath ?? post.media?.imagePath ?? undefined
      })
    )
  );

  const schedule = post.schedule ?? ((post.schedule = { status: 'draft' } as never), post.schedule);
  schedule.status = 'posted';
  schedule.lastAttemptAt = new Date();
  schedule.publishedAt = new Date();
  schedule.providerResponse = {
    results: publisherResults
  };
  await post.save();

  await initializeAnalyticsForPost(String(post._id));

  return {
    post,
    publisherResults
  };
};
