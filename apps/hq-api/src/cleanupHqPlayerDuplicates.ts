import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from './db.js';

type AnyDoc = Record<string, any>;

const dryRun = process.env.HQ_DUPLICATE_CLEANUP_DRY_RUN !== 'false';
const confirm = process.env.HQ_DUPLICATE_CLEANUP_CONFIRM === 'delete-hq-player-duplicates';
const username = process.env.HQ_DUPLICATE_CLEANUP_USERNAME?.trim();

const idString = (value: unknown) => String(value ?? '');

const compactUser = (user: AnyDoc | null | undefined) => user
  ? {
      id: idString(user._id),
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      legacy: user.legacy,
      hasPasswordHash: !!user.passwordHash,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  : null;

await connectDatabase();

try {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected.');

  const users = db.collection('users');
  const query: AnyDoc = {
    'legacy.sourceId': { $exists: true },
    ...(username ? { username } : {})
  };
  const candidates = await users.find(query).toArray();
  const plannedDeletes = [];
  const skipped = [];

  for (const candidate of candidates) {
    const sourceId = idString(candidate.legacy?.sourceId);
    const sourceObjectId = mongoose.Types.ObjectId.isValid(sourceId) ? new mongoose.Types.ObjectId(sourceId) : null;
    const sourceUser = sourceObjectId ? await users.findOne({ _id: sourceObjectId }) : null;

    if (!sourceUser) {
      skipped.push({
        reason: 'legacy.sourceId does not resolve to an original users record',
        candidate: compactUser(candidate)
      });
      continue;
    }

    plannedDeletes.push({
      delete: compactUser(candidate),
      keep: compactUser(sourceUser)
    });
  }

  if (!dryRun && confirm) {
    const ids = plannedDeletes.map((item) => item.delete?.id).filter((id): id is string => !!id && mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
    if (ids.length) {
      await users.deleteMany({ _id: { $in: ids } });
    }
  }

  console.log(JSON.stringify({
    dryRun,
    deleted: !dryRun && confirm ? plannedDeletes.length : 0,
    wouldDelete: dryRun || !confirm ? plannedDeletes.length : 0,
    plannedDeletes,
    skipped,
    instructions: dryRun
      ? 'Dry-run only. To delete these HQ-created duplicate users, set HQ_DUPLICATE_CLEANUP_DRY_RUN=false and HQ_DUPLICATE_CLEANUP_CONFIRM=delete-hq-player-duplicates.'
      : confirm
        ? 'Cleanup completed.'
        : 'Confirmation missing. No records deleted.'
  }, null, 2));
} finally {
  await disconnectDatabase();
}
