import { connectDatabase, disconnectDatabase } from './db.js';
import { syncPlayerOverlays } from './services/hq/players/reemTeamPlayerAdapter.js';

await connectDatabase();
try {
  const result = await syncPlayerOverlays();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await disconnectDatabase();
}
