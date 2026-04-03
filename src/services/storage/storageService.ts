import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { env } from '../../config/env';

let configured = false;

type StorageResult = {
  provider: 'local' | 'hybrid';
  publicId: string;
  localPath: string;
  publicUrl: string;
  remoteUrl: string | null;
  version?: string | number;
  resourceType: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
  remoteUploadError?: string | null;
};

const ensureCloudinaryConfigured = () => {
  if (!env.isCloudinaryConfigured) {
    return false;
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true
    });
    configured = true;
  }

  return true;
};

const normalizeSegments = (segments: string[]) =>
  segments
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);

const buildFolder = (segments: string[]) =>
  [env.CLOUDINARY_FOLDER, ...normalizeSegments(segments)]
    .filter(Boolean)
    .join('/');

const buildPublicUrl = (relativeUrl: string) => {
  if (!relativeUrl.startsWith('/')) {
    return relativeUrl;
  }

  return env.appBaseUrl ? `${env.appBaseUrl}${relativeUrl}` : relativeUrl;
};

const resolveLocalTarget = async (segments: string[], publicId?: string, extension?: string) => {
  const normalizedSegments = normalizeSegments(segments);
  const [rootSegment, ...restSegments] = normalizedSegments;
  const fileNameBase = publicId || randomUUID();
  const safeExtension = extension?.startsWith('.') ? extension : extension ? `.${extension}` : '';

  if (!rootSegment) {
    throw new Error('Storage folder is required');
  }

  const { rootPath, publicPrefix } =
    rootSegment === 'generated'
      ? { rootPath: env.mediaRoot, publicPrefix: '/media' }
      : rootSegment === 'assets'
        ? { rootPath: env.assetRoot, publicPrefix: '/assets' }
        : { rootPath: path.join(process.cwd(), rootSegment), publicPrefix: `/${rootSegment}` };

  const directoryPath = path.join(rootPath, ...restSegments);
  await fs.mkdir(directoryPath, { recursive: true });

  const fileName = `${fileNameBase}${safeExtension}`;
  const localPath = path.join(directoryPath, fileName);
  const relativeUrl = `${publicPrefix}/${[...restSegments, fileName].join('/')}`.replace(/\\/g, '/');

  return {
    fileNameBase,
    localPath,
    publicUrl: buildPublicUrl(relativeUrl),
    relativeUrl
  };
};

const uploadLarge = (filePath: string, options: UploadApiOptions) =>
  new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader.upload_large(filePath, options, (error, result) => {
      if (error || !result) {
        reject(error ?? new Error('Cloudinary upload_large returned no result'));
        return;
      }

      resolve(result);
    });
  });

const uploadStream = (buffer: Buffer, options: UploadApiOptions) =>
  new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) {
        reject(error ?? new Error('Cloudinary upload_stream returned no result'));
        return;
      }

      resolve(result);
    });

    stream.on('error', reject);
    stream.end(buffer);
  });

const safeCloudUploadFile = async (input: {
  localPath: string;
  folder: string[];
  publicId: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  tags?: string[];
  context?: Record<string, string>;
}) => {
  if (!ensureCloudinaryConfigured()) {
    return null;
  }

  try {
    const options: UploadApiOptions = {
      folder: buildFolder(input.folder),
      public_id: input.publicId,
      resource_type: input.resourceType ?? 'auto',
      tags: input.tags,
      context: input.context
    };

    return input.resourceType === 'video' || input.resourceType === 'raw'
      ? await uploadLarge(input.localPath, options)
      : await cloudinary.uploader.upload(input.localPath, options);
  } catch (error) {
    return {
      errorMessage: error instanceof Error ? error.message : 'Cloudinary upload failed'
    } as const;
  }
};

const safeCloudUploadBuffer = async (input: {
  buffer: Buffer;
  folder: string[];
  publicId: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  format?: string;
  tags?: string[];
  context?: Record<string, string>;
}) => {
  if (!ensureCloudinaryConfigured()) {
    return null;
  }

  try {
    return await uploadStream(input.buffer, {
      folder: buildFolder(input.folder),
      public_id: input.publicId,
      resource_type: input.resourceType ?? 'auto',
      format: input.format,
      tags: input.tags,
      context: input.context
    });
  } catch (error) {
    return {
      errorMessage: error instanceof Error ? error.message : 'Cloudinary upload failed'
    } as const;
  }
};

const isCloudinaryUploadResponse = (
  value?: UploadApiResponse | { errorMessage: string } | null
): value is UploadApiResponse => Boolean(value && 'secure_url' in value);

const toStorageResult = (input: {
  localPath: string;
  publicUrl: string;
  publicId: string;
  resourceType: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
  uploadResult?: UploadApiResponse | { errorMessage: string } | null;
}) => {
  let remoteAsset: UploadApiResponse | null = null;
  if (isCloudinaryUploadResponse(input.uploadResult)) {
    remoteAsset = input.uploadResult;
  }
  const hasRemoteAsset = Boolean(remoteAsset);

  return {
    provider: hasRemoteAsset ? 'hybrid' : 'local',
    publicId: input.publicId,
    localPath: input.localPath,
    publicUrl: input.publicUrl,
    remoteUrl: remoteAsset?.secure_url ?? null,
    version: remoteAsset?.version,
    resourceType: input.resourceType,
    format: input.format ?? remoteAsset?.format,
    bytes: input.bytes ?? remoteAsset?.bytes,
    width: input.width ?? remoteAsset?.width,
    height: input.height ?? remoteAsset?.height,
    duration: input.duration ?? remoteAsset?.duration,
    remoteUploadError: input.uploadResult && 'errorMessage' in input.uploadResult ? input.uploadResult.errorMessage : null
  } satisfies StorageResult;
};

export const createTempFilePath = async (prefix: string, extension: string) => {
  const tempDir = path.join(os.tmpdir(), 'rge');
  await fs.mkdir(tempDir, { recursive: true });
  return path.join(tempDir, `${prefix}-${randomUUID()}${extension.startsWith('.') ? extension : `.${extension}`}`);
};

export const removeTempFile = async (filePath?: string | null) => {
  if (!filePath) {
    return;
  }

  try {
    await fs.rm(filePath, { force: true });
  } catch {
    // Temp cleanup should never fail a request.
  }
};

export const uploadFileToStorage = async (input: {
  filePath: string;
  folder: string[];
  publicId?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  tags?: string[];
  context?: Record<string, string>;
}) => {
  const extension = path.extname(input.filePath) || (input.resourceType === 'video' ? '.mp4' : '.bin');
  const target = await resolveLocalTarget(input.folder, input.publicId, extension);
  await fs.copyFile(input.filePath, target.localPath);

  const fileStats = await fs.stat(target.localPath);
  const uploadResult = await safeCloudUploadFile({
    localPath: target.localPath,
    folder: input.folder,
    publicId: target.fileNameBase,
    resourceType: input.resourceType,
    tags: input.tags,
    context: input.context
  });

  return toStorageResult({
    localPath: target.localPath,
    publicUrl: target.publicUrl,
    publicId: target.fileNameBase,
    resourceType: input.resourceType ?? 'auto',
    format: extension.replace(/^\./, ''),
    bytes: fileStats.size,
    uploadResult
  });
};

export const uploadBufferToStorage = async (input: {
  buffer: Buffer;
  folder: string[];
  publicId?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  format?: string;
  tags?: string[];
  context?: Record<string, string>;
}) => {
  const extension = input.format || (input.resourceType === 'video' ? 'mp4' : 'png');
  const target = await resolveLocalTarget(input.folder, input.publicId, extension);
  await fs.writeFile(target.localPath, input.buffer);

  const uploadResult = await safeCloudUploadBuffer({
    buffer: input.buffer,
    folder: input.folder,
    publicId: target.fileNameBase,
    resourceType: input.resourceType,
    format: input.format,
    tags: input.tags,
    context: input.context
  });

  return toStorageResult({
    localPath: target.localPath,
    publicUrl: target.publicUrl,
    publicId: target.fileNameBase,
    resourceType: input.resourceType ?? 'auto',
    format: extension,
    bytes: input.buffer.length,
    uploadResult
  });
};

export const assertStoredArtifact = async (input: {
  localPath?: string | null;
  publicUrl?: string | null;
  label: string;
}) => {
  if (!input.localPath) {
    throw new Error(`${input.label} did not produce a local file path`);
  }

  const stats = await fs.stat(input.localPath).catch(() => null);
  if (!stats || !stats.isFile() || stats.size <= 0) {
    throw new Error(`${input.label} file was not written correctly`);
  }

  if (!input.publicUrl || !input.publicUrl.includes('/')) {
    throw new Error(`${input.label} did not produce a public URL`);
  }

  return {
    ...input,
    size: stats.size
  };
};
