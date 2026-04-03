import path from 'path';

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

export const toMediaUrl = (filePath?: string | null): string | null => {
  if (!filePath) {
    return null;
  }

  if (isAbsoluteUrl(filePath)) {
    return filePath;
  }

  const imagesIndex = filePath.lastIndexOf(`${path.sep}images${path.sep}`);
  if (imagesIndex >= 0) {
    return `/media/images/${path.basename(filePath)}`;
  }

  const videosIndex = filePath.lastIndexOf(`${path.sep}videos${path.sep}`);
  if (videosIndex >= 0) {
    return `/media/videos/${path.basename(filePath)}`;
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

  const originalIndex = filePath.lastIndexOf(`${path.sep}original${path.sep}`);
  if (originalIndex >= 0) {
    return `/assets/original/${path.basename(filePath)}`;
  }

  const editedIndex = filePath.lastIndexOf(`${path.sep}edited${path.sep}`);
  if (editedIndex >= 0) {
    return `/assets/edited/${path.basename(filePath)}`;
  }

  return null;
};
