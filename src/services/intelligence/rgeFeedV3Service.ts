import { env } from '../../config/env';
import { IntelligenceSyncStateModel } from '../../db/models/IntelligenceSyncState';
import { NormalizedEventModel } from '../../db/models/NormalizedEvent';
import { AppError } from '../../utils/errors';
import { normalizeBackendFeedRecords } from './eventNormalizer';
import { runIndicatorEngine } from './indicatorEngine';

const stateKey = 'rge-feed-v3';

const requestFeed = async (path: string) => {
  const headers: Record<string, string> = {};
  if (env.BACKEND_INTERNAL_TOKEN) {
    headers['x-rge-token'] = env.BACKEND_INTERNAL_TOKEN;
  }

  const backendBaseUrl = env.BACKEND_API_BASE_URL.replace(/\/+$/, '');
  const response = await fetch(`${backendBaseUrl}${path}`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(env.BACKEND_HEALTH_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new AppError(await response.text(), response.status);
  }

  return response.json();
};

export const syncRgeFeedV3 = async (input?: { days?: number; preloadedFeed?: any }) => {
  const state = await IntelligenceSyncStateModel.findOne({ key: stateKey }).lean();
  let feed = input?.preloadedFeed;
  let usedCursor = false;

  if (!feed) {
    try {
      const cursorQuery = state?.cursor ? `?cursor=${encodeURIComponent(state.cursor)}` : '';
      feed = await requestFeed(`/api/rge/feed/v3${cursorQuery}`);
      usedCursor = true;
    } catch (error) {
      if (error instanceof AppError && error.statusCode !== 404) {
        throw error;
      }
      feed = await requestFeed(`/api/rge/feed?days=${input?.days ?? env.RGE_SYNC_DAYS}`);
    }
  }

  const events = normalizeBackendFeedRecords(feed);
  if (events.length) {
    await NormalizedEventModel.bulkWrite(
      events.map((event) => ({
        updateOne: {
          filter: { eventId: event.eventId },
          update: { $set: event },
          upsert: true
        }
      })) as any
    );
  }

  const engine = await runIndicatorEngine({
    since: events.length
      ? new Date(Math.min(...events.map((event) => event.occurredAt.getTime())) - 60 * 60 * 1000)
      : undefined
  });

  await IntelligenceSyncStateModel.findOneAndUpdate(
    { key: stateKey },
    {
      $set: {
        key: stateKey,
        cursor: feed?.nextCursor ?? feed?.cursor ?? state?.cursor,
        lastSuccessfulSyncAt: new Date(),
        metadata: {
          usedCursor,
          eventCount: events.length,
          generatedAt: feed?.generatedAt
        }
      }
    },
    { upsert: true }
  );

  return {
    usedCursor,
    normalizedEvents: events.length,
    ...engine
  };
};
