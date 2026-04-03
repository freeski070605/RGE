type StructuredLogLevel = 'info' | 'warn' | 'error';

type StructuredLogPayload = {
  area: 'media' | 'sync' | 'content' | 'publishing' | 'system';
  action: string;
  status: string;
  message?: string;
  jobId?: string | null;
  contentItemId?: string | null;
  variantId?: string | null;
  postId?: string | null;
  publishingJobId?: string | null;
  durationMs?: number;
  error?: string | null;
  [key: string]: unknown;
};

const emit = (level: StructuredLogLevel, payload: StructuredLogPayload) => {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    ...payload
  });

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
};

export const logInfo = (payload: StructuredLogPayload) => emit('info', payload);
export const logWarn = (payload: StructuredLogPayload) => emit('warn', payload);
export const logError = (payload: StructuredLogPayload) => emit('error', payload);

export const getDurationMs = (startedAt: number) => Date.now() - startedAt;
