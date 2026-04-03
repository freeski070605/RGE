import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { createTempFilePath, removeTempFile } from '../storage/storageService';

const X_CHUNK_SIZE = 4 * 1024 * 1024;

const isVideoUrl = (value: string) => /\.(mp4|mov|m4v|avi|webm)(?:\?|$)/i.test(value);

const safeParseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const trimText = (value: string, limit: number) => {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(limit - 1, 0)).trimEnd()}…`;
};

const downloadRemoteFile = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new AppError(`Failed to download remote media: ${response.status} ${response.statusText}`, 502);
  }

  const extensionFromUrl = path.extname(new URL(url).pathname) || '.bin';
  const tempFilePath = await createTempFilePath('publish-media', extensionFromUrl);

  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(tempFilePath));

  return {
    tempFilePath,
    mimeType: response.headers.get('content-type') || '',
    fileSize: Number(response.headers.get('content-length') || '0')
  };
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

const uploadXImage = async (filePath: string, mimeType: string) => {
  const buffer = await fsPromises.readFile(filePath);
  const formData = new FormData();
  formData.append('media', new Blob([buffer], { type: mimeType || 'image/png' }), path.basename(filePath));
  formData.append('media_category', 'tweet_image');
  formData.append('media_type', mimeType || 'image/png');

  const payload = await fetchProviderJson(
    'https://api.x.com/2/media/upload',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.X_ACCESS_TOKEN}`
      },
      body: formData
    },
    'X image upload failed'
  );

  const mediaId = payload.data?.id;
  if (!mediaId) {
    throw new AppError('X image upload did not return a media id', 502);
  }

  return String(mediaId);
};

const initializeXVideoUpload = async (fileSize: number, mimeType: string) => {
  const payload = await fetchProviderJson(
    'https://api.x.com/2/media/upload',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.X_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: 'INIT',
        total_bytes: fileSize,
        media_type: mimeType || 'video/mp4',
        media_category: 'tweet_video'
      })
    },
    'X video upload initialization failed'
  );

  const mediaId = payload.data?.id;
  if (!mediaId) {
    throw new AppError('X video upload initialization did not return a media id', 502);
  }

  return String(mediaId);
};

const appendXVideoChunks = async (mediaId: string, filePath: string) => {
  const fileHandle = await fsPromises.open(filePath, 'r');

  try {
    const stats = await fileHandle.stat();
    let segmentIndex = 0;
    let offset = 0;

    while (offset < stats.size) {
      const bytesToRead = Math.min(X_CHUNK_SIZE, stats.size - offset);
      const buffer = Buffer.alloc(bytesToRead);
      const { bytesRead } = await fileHandle.read(buffer, 0, bytesToRead, offset);
      const chunk = buffer.subarray(0, bytesRead);
      const formData = new FormData();
      formData.append('media', new Blob([chunk], { type: 'application/octet-stream' }), `segment-${segmentIndex}.bin`);
      formData.append('segment_index', String(segmentIndex));

      await fetchProviderJson(
        `https://api.x.com/2/media/upload/${mediaId}/append`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.X_ACCESS_TOKEN}`
          },
          body: formData
        },
        `X video append failed for segment ${segmentIndex}`
      );

      offset += bytesRead;
      segmentIndex += 1;
    }
  } finally {
    await fileHandle.close();
  }
};

const finalizeXVideoUpload = async (mediaId: string) => {
  const payload = await fetchProviderJson(
    `https://api.x.com/2/media/upload/${mediaId}/finalize`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.X_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    },
    'X video upload finalize failed'
  );

  return payload;
};

const waitForXMediaProcessing = async (mediaId: string) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const payload = await fetchProviderJson(
      `https://api.x.com/2/media/upload?media_id=${encodeURIComponent(mediaId)}&command=STATUS`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.X_ACCESS_TOKEN}`
        }
      },
      'X media processing status failed'
    );

    const processingInfo = payload.data?.processing_info;
    if (!processingInfo) {
      return;
    }

    const state = String(processingInfo.state || '').toLowerCase();
    if (state === 'succeeded' || state === 'success') {
      return;
    }

    if (state === 'failed' || state === 'error') {
      throw new AppError(processingInfo.error?.message || 'X media processing failed', 502);
    }

    await wait(Number(processingInfo.check_after_secs || 3) * 1000);
  }

  throw new AppError('X media processing timed out', 504);
};

const uploadXVideo = async (filePath: string, fileSize: number, mimeType: string) => {
  const mediaId = await initializeXVideoUpload(fileSize, mimeType);
  await appendXVideoChunks(mediaId, filePath);
  await finalizeXVideoUpload(mediaId);
  await waitForXMediaProcessing(mediaId);
  return mediaId;
};

const publishToX = async (input: {
  caption: string;
  mediaUrl?: string;
}) => {
  if (!env.isXConfigured) {
    throw new AppError('X publishing is not configured', 500);
  }

  let mediaId: string | undefined;
  let tempFilePath: string | undefined;

  try {
    if (input.mediaUrl) {
      const download = await downloadRemoteFile(input.mediaUrl);
      tempFilePath = download.tempFilePath;
      mediaId = isVideoUrl(input.mediaUrl)
        ? await uploadXVideo(download.tempFilePath, download.fileSize || (await fsPromises.stat(download.tempFilePath)).size, download.mimeType)
        : await uploadXImage(download.tempFilePath, download.mimeType);
    }

    const payload = await fetchProviderJson(
      'https://api.x.com/2/tweets',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.X_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: trimText(input.caption, 280),
          media: mediaId ? { media_ids: [mediaId] } : undefined
        })
      },
      'X publish failed'
    );

    const tweetId = payload.data?.id;
    if (!tweetId) {
      throw new AppError('X publish did not return a post id', 502);
    }

    return {
      provider: 'x',
      platform: 'x',
      externalId: String(tweetId),
      permalink: `https://x.com/i/web/status/${tweetId}`,
      mediaId: mediaId ?? null,
      publishedAt: new Date().toISOString()
    };
  } finally {
    await removeTempFile(tempFilePath);
  }
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

  if (input.platform === 'x') {
    return publishToX({
      caption: input.caption,
      mediaUrl: input.mediaUrl
    });
  }

  throw new AppError(`Unsupported publishing platform: ${input.platform}`, 400);
};
