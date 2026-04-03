import path from 'path';
import { env } from '../config/env';

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const withBaseUrl = (relativePath: string) => (env.appBaseUrl ? `${env.appBaseUrl}${relativePath}` : relativePath);

const normalizeRelativeUrl = (relativePath: string) =>
  relativePath.startsWith('/') ? relativePath.replace(/\\/g, '/') : `/${relativePath.replace(/\\/g, '/')}`;

export const toAbsoluteAppUrl = (relativePath?: string | null): string | null => {
  if (!relativePath) {
    return null;
  }

  if (isAbsoluteUrl(relativePath)) {
    return relativePath;
  }

  return withBaseUrl(normalizeRelativeUrl(relativePath));
};

export const toMediaUrl = (filePath?: string | null): string | null => {
  if (!filePath) {
    return null;
  }

  if (isAbsoluteUrl(filePath)) {
    return filePath;
  }

  const normalized = filePath.replace(/\//g, path.sep);

  const imagesIndex = normalized.lastIndexOf(`${path.sep}images${path.sep}`);
  if (imagesIndex >= 0) {
    return `/media/images/${path.basename(normalized)}`;
  }

  const videosIndex = normalized.lastIndexOf(`${path.sep}videos${path.sep}`);
  if (videosIndex >= 0) {
    return `/media/videos/${path.basename(normalized)}`;
  }

  return null;
};

export const toAssetUrl = (filePath?: string | null): string | null => {
  if (!filePath) {
    return null;
  }

  if (isAbsoluteUrl(filePath)) {
    return filePath;
  }

  const normalized = filePath.replace(/\//g, path.sep);

  const originalIndex = normalized.lastIndexOf(`${path.sep}original${path.sep}`);
  if (originalIndex >= 0) {
    return `/assets/original/${path.basename(normalized)}`;
  }

  const editedIndex = normalized.lastIndexOf(`${path.sep}edited${path.sep}`);
  if (editedIndex >= 0) {
    return `/assets/edited/${path.basename(normalized)}`;
  }

  return null;
};
