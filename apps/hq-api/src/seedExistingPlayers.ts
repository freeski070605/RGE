import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from './db.js';
import { defaultPlayerSourceCollections, importExistingPlayers } from './playerImport.js';

const collectionNames = (process.env.PLAYER_SOURCE_COLLECTIONS ?? defaultPlayerSourceCollections.join(','))
  .split(',')
  .map((collection) => collection.trim())
  .filter(Boolean);
const limit = Number.parseInt(process.env.PLAYER_IMPORT_LIMIT ?? '10000', 10);
const dryRun = process.env.PLAYER_IMPORT_DRY_RUN === 'true';
const legacyUri = process.env.LEGACY_MONGODB_URI?.trim();

await connectDatabase();
let legacyConnection: mongoose.Connection | null = null;

try {
  legacyConnection = legacyUri ? await mongoose.createConnection(legacyUri).asPromise() : null;
  const sourceDb = legacyConnection?.db ?? mongoose.connection.db;
  const result = await importExistingPlayers(collectionNames, Number.isFinite(limit) ? limit : 10000, dryRun, sourceDb);
  console.log(`${dryRun ? 'Dry-run checked' : 'Seeded'} existing players: ${JSON.stringify(result)}`);
} finally {
  if (legacyConnection) await legacyConnection.close();
  await disconnectDatabase();
}
