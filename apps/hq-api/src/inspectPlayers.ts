import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from './db.js';
import { inspectLegacyCollections } from './playerImport.js';

const legacyUri = process.env.LEGACY_MONGODB_URI?.trim();

await connectDatabase();
let legacyConnection: mongoose.Connection | null = null;

try {
  legacyConnection = legacyUri ? await mongoose.createConnection(legacyUri).asPromise() : null;
  const summaries = await inspectLegacyCollections(legacyConnection?.db ?? mongoose.connection.db);
  console.log(JSON.stringify(summaries, null, 2));
} finally {
  if (legacyConnection) await legacyConnection.close();
  await disconnectDatabase();
}
