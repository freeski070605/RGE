import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';

let configured = false;

const ensureCloudinaryConfigured = () => {
  if (!env.isCloudinaryConfigured) {
    throw new AppError('Cloudinary is not configured', 500);
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
};

const buildFolder = (segments: string[]) =>
  [env.CLOUDINARY_FOLDER, ...segments]
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');

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

export const uploadFileToStorage = async (input: {
  filePath: string;
  folder: string[];
  publicId?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  tags?: string[];
  context?: Record<string, string>;
}) => {
  ensureCloudinaryConfigured();

  const options: UploadApiOptions = {
    folder: buildFolder(input.folder),
    public_id: input.publicId,
    resource_type: input.resourceType ?? 'auto',
    tags: input.tags,
    context: input.context
  };

  const result =
    input.resourceType === 'video' || input.resourceType === 'raw'
      ? await uploadLarge(input.filePath, options)
      : await cloudinary.uploader.upload(input.filePath, options);

  return {
    provider: 'cloudinary' as const,
    publicId: result.public_id,
    version: result.version,
    resourceType: result.resource_type,
    format: result.format,
    bytes: result.bytes,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    duration: result.duration
  };
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
  ensureCloudinaryConfigured();

  const result = await uploadStream(input.buffer, {
    folder: buildFolder(input.folder),
    public_id: input.publicId,
    resource_type: input.resourceType ?? 'auto',
    format: input.format,
    tags: input.tags,
    context: input.context
  });

  return {
    provider: 'cloudinary' as const,
    publicId: result.public_id,
    version: result.version,
    resourceType: result.resource_type,
    format: result.format,
    bytes: result.bytes,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    duration: result.duration
  };
};
