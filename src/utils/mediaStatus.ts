export type MediaJobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type MediaDisplayStatus = MediaJobStatus | 'not_started';

export const normalizeMediaStatus = (status?: string | null): MediaDisplayStatus => {
  if (!status || status === 'pending') {
    return 'not_started';
  }

  if (status === 'ready' || status === 'succeeded') {
    return 'completed';
  }

  if (status === 'queued' || status === 'processing' || status === 'completed' || status === 'failed') {
    return status;
  }

  return 'not_started';
};

export const isCompletedMediaStatus = (status?: string | null) => normalizeMediaStatus(status) === 'completed';

export const isFailedMediaStatus = (status?: string | null) => normalizeMediaStatus(status) === 'failed';

export const isActiveMediaStatus = (status?: string | null) => {
  const normalized = normalizeMediaStatus(status);
  return normalized === 'queued' || normalized === 'processing';
};
