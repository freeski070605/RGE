import { env } from '../../config/env';
import { AppError } from '../../utils/errors';

const isVideoUrl = (value: string) => /\.(mp4|mov|m4v|avi|webm)(?:\?|$)/i.test(value);

const safeParseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const fetchProviderJson = async (
  url: string,
  init: RequestInit,
  errorPrefix: string
): Promise<Record<string, any>> => {
  const response = await fetch(url, init);
  const payload = await safeParseJson(response);

  if (!response.ok) {
    const errorMessage =
      payload?.error?.message ||
      payload?.errors?.[0]?.detail ||
      payload?.detail ||
      response.statusText ||
      'Provider request failed';
    throw new AppError(`${errorPrefix}: ${errorMessage}`, 502);
  }

  return payload ?? {};
};

const buildInstagramCaption = (caption: string, includeCaption: boolean) => (includeCaption ? caption : '');

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const pollInstagramContainer = async (creationId: string) => {
  const version = env.INSTAGRAM_GRAPH_VERSION.replace(/^\/+|\/+$/g, '');

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const statusPayload = await fetchProviderJson(
      `https://graph.facebook.com/${version}/${creationId}?fields=status,status_code&access_token=${encodeURIComponent(env.INSTAGRAM_ACCESS_TOKEN)}`,
      { method: 'GET' },
      'Instagram status check failed'
    );

    const statusCode = String(statusPayload.status_code || statusPayload.status || '').toUpperCase();
    if (!statusCode || statusCode === 'FINISHED' || statusCode === 'PUBLISHED') {
      return statusPayload;
    }

    if (statusCode === 'ERROR' || statusCode === 'EXPIRED' || statusCode === 'FAILED') {
      throw new AppError(`Instagram media container failed with status ${statusCode}`, 502);
    }

    await wait(4000);
  }

  throw new AppError('Instagram media container timed out before becoming publishable', 504);
};

const publishToInstagram = async (input: {
  platform: string;
  caption: string;
  mediaUrl: string;
  postId: string;
}) => {
  if (!env.isInstagramConfigured) {
    throw new AppError('Instagram publishing is not configured', 500);
  }

  const version = env.INSTAGRAM_GRAPH_VERSION.replace(/^\/+|\/+$/g, '');
  const isVideo = isVideoUrl(input.mediaUrl);
  const isStory = input.platform === 'story';

  const createBody = new URLSearchParams({
    access_token: env.INSTAGRAM_ACCESS_TOKEN
  });

  if (isStory) {
    createBody.set('media_type', 'STORIES');
  } else if (isVideo) {
    createBody.set('media_type', 'REELS');
  }

  if (isVideo) {
    createBody.set('video_url', input.mediaUrl);
  } else {
    createBody.set('image_url', input.mediaUrl);
  }

  const caption = buildInstagramCaption(input.caption, !isStory);
  if (caption) {
    createBody.set('caption', caption);
  }

  const containerPayload = await fetchProviderJson(
    `https://graph.facebook.com/${version}/${env.INSTAGRAM_USER_ID}/media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: createBody.toString()
    },
    'Instagram media creation failed'
  );

  const creationId = containerPayload.id;
  if (!creationId) {
    throw new AppError('Instagram media creation did not return a creation id', 502);
  }

  if (isVideo || isStory) {
    await pollInstagramContainer(String(creationId));
  }

  const publishBody = new URLSearchParams({
    creation_id: String(creationId),
    access_token: env.INSTAGRAM_ACCESS_TOKEN
  });

  const publishPayload = await fetchProviderJson(
    `https://graph.facebook.com/${version}/${env.INSTAGRAM_USER_ID}/media_publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: publishBody.toString()
    },
    'Instagram publish failed'
  );

  const publishedMediaId = publishPayload.id;
  const publishedDetails = publishedMediaId
    ? await fetchProviderJson(
        `https://graph.facebook.com/${version}/${publishedMediaId}?fields=id,permalink,media_product_type&access_token=${encodeURIComponent(env.INSTAGRAM_ACCESS_TOKEN)}`,
        { method: 'GET' },
        'Instagram published media lookup failed'
      )
    : {};

  return {
    provider: 'instagram',
    platform: input.platform,
    externalId: String(publishedMediaId || creationId),
    permalink: publishedDetails.permalink || null,
    mediaProductType: publishedDetails.media_product_type || (isStory ? 'STORY' : isVideo ? 'REELS' : 'FEED'),
    publishedAt: new Date().toISOString(),
    containerId: String(creationId)
  };
};

export const publishToSocialPlatform = async (input: {
  platform: string;
  postId: string;
  caption: string;
  mediaUrl?: string;
}) => {
  if (!input.mediaUrl) {
    throw new AppError(`Cannot publish ${input.platform} content without media`, 400);
  }

  if (input.platform === 'instagram' || input.platform === 'story') {
    return publishToInstagram(input as typeof input & { mediaUrl: string });
  }

  throw new AppError(`Unsupported publishing platform: ${input.platform}`, 400);
};
