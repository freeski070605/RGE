import { createApp } from './app.js';
import { env } from './config.js';
import { connectDatabase } from './db.js';

await connectDatabase();
createApp().listen(env.port, () => {
  console.log(`ReemTeamHQ API listening on ${env.port}`);
});
