import { spawn } from 'child_process';
import { CanvasRenderingContext2D, createCanvas, loadImage } from 'canvas';
import { env } from '../../config/env';
import { PostModel } from '../../db/models/Post';
import { AppError } from '../../utils/errors';
import { getPreferredAssetForPost } from '../assets/assetService';
import {
  createTempFilePath,
  removeTempFile,
  uploadBufferToStorage,
  uploadFileToStorage
} from '../storage/storageService';

const wrapText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) => {
  const words = text.split(' ');
  let line = '';
  let cursorY = y;

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && line) {
      context.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = nextLine;
    }
  }

  if (line) {
    context.fillText(line, x, cursorY);
  }
};

export const renderCreativeImage = async (post: {
  id: string;
  hook: string;
  caption: string;
  overlayText: string;
  hashtags: string[];
  backgroundImagePath?: string | null;
}): Promise<string> => {
  const canvas = createCanvas(1080, 1080);
  const context = canvas.getContext('2d');

  if (post.backgroundImagePath) {
    const background = await loadImage(post.backgroundImagePath);
    const scale = Math.max(1080 / background.width, 1080 / background.height);
    const drawWidth = background.width * scale;
    const drawHeight = background.height * scale;
    const drawX = (1080 - drawWidth) / 2;
    const drawY = (1080 - drawHeight) / 2;
    context.drawImage(background, drawX, drawY, drawWidth, drawHeight);

    const overlay = context.createLinearGradient(0, 1080, 0, 0);
    overlay.addColorStop(0, 'rgba(5, 12, 19, 0.94)');
    overlay.addColorStop(0.55, 'rgba(5, 12, 19, 0.36)');
    overlay.addColorStop(1, 'rgba(5, 12, 19, 0.14)');
    context.fillStyle = overlay;
    context.fillRect(0, 0, 1080, 1080);
  } else {
    const gradient = context.createLinearGradient(0, 0, 1080, 1080);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(0.5, '#14532d');
    gradient.addColorStop(1, '#f97316');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1080, 1080);

    context.fillStyle = 'rgba(255,255,255,0.08)';
    context.beginPath();
    context.arc(860, 230, 220, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = '#f8fafc';
  context.font = 'bold 58px Arial';
  wrapText(context, post.hook, 90, 160, 860, 74);

  context.fillStyle = '#fde68a';
  context.font = 'bold 100px Arial';
  wrapText(context, post.overlayText, 90, 430, 860, 116);

  context.fillStyle = '#e2e8f0';
  context.font = '36px Arial';
  wrapText(context, post.caption, 90, 680, 880, 48);

  context.fillStyle = '#bfdbfe';
  context.font = 'bold 30px Arial';
  wrapText(context, post.hashtags.join(' '), 90, 930, 880, 38);

  const uploaded = await uploadBufferToStorage({
    buffer: canvas.toBuffer('image/png'),
    folder: ['generated', 'images'],
    publicId: post.id,
    resourceType: 'image',
    format: 'png',
    tags: ['rge', 'generated', 'image']
  });

  return uploaded.secureUrl;
};

export const renderCreativeVideo = async (input: {
  imagePath: string;
  id: string;
  sourceVideoPath?: string | null;
}): Promise<string> => {
  const outputPath = await createTempFilePath(input.id, '.mp4');

  try {
    await new Promise<void>((resolve, reject) => {
      const args = input.sourceVideoPath
        ? [
            '-y',
            '-i',
            input.sourceVideoPath,
            '-vf',
            'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p',
            '-map',
            '0:v',
            '-map',
            '0:a?',
            '-t',
            String(env.VIDEO_DURATION_SECONDS),
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            outputPath
          ]
        : [
            '-y',
            '-loop',
            '1',
            '-i',
            input.imagePath,
            '-vf',
            "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0015,1.08)':d=180:s=1080x1920,format=yuv420p",
            '-t',
            String(env.VIDEO_DURATION_SECONDS),
            '-r',
            '30',
            '-pix_fmt',
            'yuv420p',
            outputPath
          ];

      const ffmpeg = spawn(env.FFMPEG_PATH, args);

      let stderr = '';

      ffmpeg.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr || `ffmpeg exited with code ${code}`));
      });
    });

    const uploaded = await uploadFileToStorage({
      filePath: outputPath,
      folder: ['generated', 'videos'],
      publicId: input.id,
      resourceType: 'video',
      tags: ['rge', 'generated', 'video']
    });

    return uploaded.secureUrl;
  } finally {
    await removeTempFile(outputPath);
  }
};

export const createMediaForPost = async (postId: string) => {
  const post = await PostModel.findById(postId);
  if (!post) {
    throw new AppError('Post not found', 404);
  }

  if (!post.caption || !post.hook) {
    throw new AppError('Content must be generated before media creation', 409);
  }

  const preferredImageAsset = await getPreferredAssetForPost(String(post._id), 'image');
  const preferredVideoAsset = await getPreferredAssetForPost(String(post._id), 'video');

  const imagePath = await renderCreativeImage({
    id: String(post._id),
    hook: post.hook,
    caption: post.caption,
    overlayText: post.overlayText || post.hook,
    hashtags: post.hashtags,
    backgroundImagePath: preferredImageAsset?.path
  });

  let videoPath: string | undefined;
  if (env.ENABLE_VIDEO_GENERATION) {
    try {
      videoPath = await renderCreativeVideo({
        imagePath,
        id: String(post._id),
        sourceVideoPath: preferredVideoAsset?.path
      });
    } catch (error) {
      console.warn(`Video generation failed for post ${post._id}:`, error);
    }
  }

  const media = post.media ?? ((post.media = { status: 'pending' } as never), post.media);
  const schedule = post.schedule ?? ((post.schedule = { status: 'draft' } as never), post.schedule);

  media.status = 'ready';
  media.imagePath = imagePath;
  media.videoPath = videoPath;
  schedule.status = 'media_ready';
  await post.save();

  return post;
};
