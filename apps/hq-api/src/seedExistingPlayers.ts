import { connectDatabase, disconnectDatabase } from './db.js';
import { importExistingPlayers } from './playerImport.js';

const collectionNames = (process.env.PLAYER_SOURCE_COLLECTIONS ?? 'players,Players,users,Users')
  .split(',')
  .map((collection) => collection.trim())
  .filter(Boolean);
const limit = Number.parseInt(process.env.PLAYER_IMPORT_LIMIT ?? '10000', 10);
const dryRun = process.env.PLAYER_IMPORT_DRY_RUN === 'true';

await connectDatabase();
const result = await importExistingPlayers(collectionNames, Number.isFinite(limit) ? limit : 10000, dryRun);
console.log(`${dryRun ? 'Dry-run checked' : 'Seeded'} existing players: ${JSON.stringify(result)}`);
await disconnectDatabase();
