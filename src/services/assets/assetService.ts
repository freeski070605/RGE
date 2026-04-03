import { spawn } from 'child_process';
import fs from 'fs/promises';
import { Types } from 'mongoose';
import { createCanvas, loadImage } from 'canvas';
import { AssetModel } from '../../db/models/Asset';
import { ContentIdeaModel } from '../../db/models/ContentIdea';
import { ContentItemModel } from '../../db/models/ContentItem';
import { ContentVariantModel } from '../../db/models/ContentVariant';
import { CreativeBriefModel } from '../../db/models/CreativeBrief';
import { PostModel } from '../../db/models/Post';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { toAssetUrl } from '../../utils/publicPaths';
import { logInfo } from '../../utils/structuredLogger';
import {
  createTempFilePath,
  removeTempFile,
  uploadBufferToStorage,
  uploadFileToStorage
} from '../storage/storageService';

export type EditPreset = 'square' | 'story' | 'reel';

const getPreferredAssetPath = (asset: {
  originalPath: string;
  editedPath?: string | null;
}) => asset.editedPath || asset.originalPath;

const getCanvasSize = (preset: EditPreset) => {
  if (preset === 'story' || preset === 'reel') {
    return { width: 1080, height: 1920 };
  }

  return { width: 1080, height: 1080 };
};

const drawCoverImage = async (imagePath: string, width: number, height: number, overlayText: string) => {
  const image = await loadImage(imagePath);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  const imageRatio = image.width / image.height;
  const frameRatio = width / height;

  let drawWidth = width;
  let drawHeight = height;
  let drawX = 0;
  let drawY = 0;

  if (imageRatio > frameRatio) {
    drawHeight = height;
    drawWidth = image.width * (height / image.height);
    drawX = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = image.height * (width / image.width);
    drawY = (height - drawHeight) / 2;
  }

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  const overlay = context.createLinearGradient(0, height, 0, height * 0.35);
  overlay.addColorStop(0, 'rgba(3, 12, 19, 0.92)');
  overlay.addColorStop(1, 'rgba(3, 12, 19, 0.1)');
  context.fillStyle = overlay;
  context.fillRect(0, 0, width, height);

  context.fillStyle = 'rgba(125, 211, 167, 0.9)';
  context.fillRect(48, 52, 260, 8);

  context.fillStyle = '#f8fafc';
  context.font = 'bold 72px Arial';

  const maxWidth = width - 120;
  const lines: string[] = [];
  const words = overlayText.split(' ');
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) {
    lines.push(line);
  }

  let y = height - 220;
  lines.slice(0, 4).forEach((entry) => {
    context.fillText(entry, 56, y);
    y += 88;
  });

  return canvas;
};

const drawOverlayCanvas = (width: number, height: number, overlayText: string) => {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  const overlay = context.createLinearGradient(0, height, 0, 0);
  overlay.addColorStop(0, 'rgba(3, 12, 19, 0.94)');
  overlay.addColorStop(0.55, 'rgba(3, 12, 19, 0.32)');
  overlay.addColorStop(1, 'rgba(3, 12, 19, 0.0)');
  context.fillStyle = overlay;
  context.fillRect(0, 0, width, height);

  context.fillStyle = 'rgba(125, 211, 167, 0.92)';
  context.fillRect(48, 52, 260, 8);

  context.fillStyle = '#f8fafc';
  context.font = 'bold 72px Arial';
  context.fillText(overlayText.slice(0, 32), 56, height - 160);

  return canvas;
};

const runFfmpeg = async (args: string[]) => {
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(env.FFMPEG_PATH, args);
    let stderr = '';

    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
};

const buildAssetMetadata = (currentMetadata: unknown, key: 'original' | 'edited', payload: Record<string, unknown>) => {
  const metadata = (currentMetadata as Record<string, unknown> | undefined) ?? {};
  const storage =
    metadata.storage && typeof metadata.storage === 'object' ? (metadata.storage as Record<string, unknown>) : {};

  return {
    ...metadata,
    storage: {
      ...storage,
      [key]: payload
    }
  };
};

export const createAssetRecord = async (input: {
  originalName: string;
  storedFilename: string;
  mimeType: string;
  fileSize: number;
  tempFilePath: string;
  title?: string;
  tags?: string[];
}) => {
  const kind = input.mimeType.startsWith('video/') ? 'video' : input.mimeType.startsWith('image/') ? 'image' : null;
  if (!kind) {
    await removeTempFile(input.tempFilePath);
    throw new AppError('Only image and video uploads are supported', 400);
  }

  try {
    const uploaded = await uploadFileToStorage({
      filePath: input.tempFilePath,
      folder: ['assets', 'original'],
      publicId: `${kind}-${input.storedFilename.replace(/\.[^.]+$/, '')}`,
      resourceType: kind === 'video' ? 'video' : 'image',
      tags: ['rge', 'asset', kind, ...(input.tags ?? [])].filter(Boolean),
      context: {
        original_name: input.originalName
      }
    });

    return AssetModel.create({
      originalName: input.originalName,
      storedFilename: input.storedFilename,
      kind,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      originalPath: uploaded.localPath,
      title: input.title ?? '',
      tags: input.tags ?? [],
      metadata: buildAssetMetadata({}, 'original', uploaded)
    });
  } finally {
    await removeTempFile(input.tempFilePath);
  }
};

export const listAssets = async () => {
  const assets = await AssetModel.find().sort({ createdAt: -1 }).lean();
  return assets.map((asset) => ({
    id: String(asset._id),
    originalName: asset.originalName,
    storedFilename: asset.storedFilename,
    kind: asset.kind,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    title: asset.title ?? '',
    tags: asset.tags ?? [],
    editorStatus: asset.editorStatus,
    lastEditPreset: asset.lastEditPreset ?? null,
    lastEditOverlay: asset.lastEditOverlay ?? null,
    originalUrl: toAssetUrl(asset.originalPath),
    editedUrl: toAssetUrl(asset.editedPath),
    preferredUrl: toAssetUrl(getPreferredAssetPath(asset)),
    metadata: asset.metadata ?? {},
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt
  }));
};

export const autoEditAsset = async (input: {
  assetId: string;
  preset?: EditPreset;
  overlayText?: string;
}) => {
  const asset = await AssetModel.findById(input.assetId);
  if (!asset) {
    throw new AppError('Asset not found', 404);
  }

  const preset = input.preset ?? 'square';
  const overlayText = input.overlayText?.trim() || asset.title || 'ReemTeam Highlight';
  const sourcePath = getPreferredAssetPath(asset);

  const tempFiles: string[] = [];

  try {
    if (asset.kind === 'image') {
      const { width, height } = getCanvasSize(preset);
      const canvas = await drawCoverImage(sourcePath, width, height, overlayText);
      const uploaded = await uploadBufferToStorage({
        buffer: canvas.toBuffer('image/png'),
        folder: ['assets', 'edited'],
        publicId: `${String(asset._id)}-edited`,
        resourceType: 'image',
        format: 'png',
        tags: ['rge', 'asset', 'edited', 'image']
      });

      asset.editedPath = uploaded.localPath;
      asset.metadata = buildAssetMetadata(asset.metadata, 'edited', uploaded) as never;
    } else {
      const { width, height } = getCanvasSize(preset);
      const overlayPath = await createTempFilePath(`asset-${String(asset._id)}-overlay`, '.png');
      const outputPath = await createTempFilePath(`asset-${String(asset._id)}-edited`, '.mp4');
      tempFiles.push(overlayPath, outputPath);

      const overlayCanvas = drawOverlayCanvas(width, height, overlayText);
      await fs.writeFile(overlayPath, overlayCanvas.toBuffer('image/png'));

      await runFfmpeg([
        '-y',
        '-i',
        sourcePath,
        '-i',
        overlayPath,
        '-filter_complex',
        `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}[bg];[bg][1:v]overlay=0:0,format=yuv420p[v]`,
        '-map',
        '[v]',
        '-map',
        '0:a?',
        '-t',
        String(env.VIDEO_DURATION_SECONDS),
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        outputPath
      ]);

      const uploaded = await uploadFileToStorage({
        filePath: outputPath,
        folder: ['assets', 'edited'],
        publicId: `${String(asset._id)}-edited`,
        resourceType: 'video',
        tags: ['rge', 'asset', 'edited', 'video']
      });

      asset.editedPath = uploaded.localPath;
      asset.metadata = buildAssetMetadata(asset.metadata, 'edited', uploaded) as never;
    }

    asset.editorStatus = 'edited';
    asset.lastEditPreset = preset;
    asset.lastEditOverlay = overlayText;
    await asset.save();
  } catch (error) {
    asset.editorStatus = 'failed';
    await asset.save();
    throw error;
  } finally {
    await Promise.all(tempFiles.map((filePath) => removeTempFile(filePath)));
  }

  return asset;
};

export const attachAssetsToPost = async (postId: string, assetIds: string[]) => {
  const post = await PostModel.findById(postId);
  if (!post) {
    throw new AppError('Post not found', 404);
  }

  const validIds = assetIds.map((assetId) => new Types.ObjectId(assetId));
  post.assetIds = validIds as never;
  await post.save();
  return post;
};

export const getPostAssets = async (postId: string) => {
  const post = await PostModel.findById(postId).populate('assetIds').lean();
  if (!post) {
    throw new AppError('Post not found', 404);
  }

  return (post.assetIds as Array<any>).map((asset) => ({
    id: String(asset._id),
    kind: asset.kind,
    title: asset.title ?? '',
    tags: asset.tags ?? [],
    editorStatus: asset.editorStatus,
    preferredUrl: toAssetUrl(getPreferredAssetPath(asset)),
    originalUrl: toAssetUrl(asset.originalPath),
    editedUrl: toAssetUrl(asset.editedPath)
  }));
};

export const getPreferredAssetForPost = async (postId: string, kind?: 'image' | 'video') => {
  const post = await PostModel.findById(postId).populate('assetIds');
  if (!post) {
    return null;
  }

  const assets = (post.assetIds as Array<any>) ?? [];
  const match = kind ? assets.find((asset) => asset.kind === kind) : assets[0];
  if (!match) {
    return null;
  }

  return {
    path: getPreferredAssetPath(match),
    kind: match.kind,
    title: match.title ?? ''
  };
};

export const deleteAsset = async (assetId: string) => {
  const asset = await AssetModel.findById(assetId);
  if (!asset) {
    throw new AppError('Asset not found', 404);
  }

  const assetObjectId = new Types.ObjectId(assetId);

  const [posts, ideas, briefs, variants, contentItems] = await Promise.all([
    PostModel.updateMany({ assetIds: assetObjectId }, { $pull: { assetIds: assetObjectId } }),
    ContentIdeaModel.updateMany({ linkedAssets: assetObjectId }, { $pull: { linkedAssets: assetObjectId } }),
    CreativeBriefModel.updateMany({ assetIds: assetObjectId }, { $pull: { assetIds: assetObjectId } }),
    ContentVariantModel.updateMany({ assetIds: assetObjectId }, { $pull: { assetIds: assetObjectId } }),
    ContentItemModel.updateMany({ selectedMediaAssetIds: assetObjectId }, { $pull: { selectedMediaAssetIds: assetObjectId } })
  ]);

  await AssetModel.findByIdAndDelete(assetObjectId);
  await Promise.all([removeTempFile(asset.originalPath), removeTempFile(asset.editedPath)]);

  const removedReferences = {
    posts: posts.modifiedCount ?? 0,
    opportunities: ideas.modifiedCount ?? 0,
    briefs: briefs.modifiedCount ?? 0,
    variants: variants.modifiedCount ?? 0,
    contentItems: contentItems.modifiedCount ?? 0
  };

  logInfo({
    area: 'content',
    action: 'delete-asset',
    status: 'completed',
    message: 'Asset deleted from the library',
    assetId,
    removedReferences
  });

  return {
    id: assetId,
    title: asset.title ?? asset.originalName,
    removedReferences
  };
};
