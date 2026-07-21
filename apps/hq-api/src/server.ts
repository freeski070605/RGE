import { createApp } from './app.js';
import { env } from './config.js';
import { tryConnectDatabase } from './db.js';

await tryConnectDatabase();
createApp().listen(env.port, () => {
  console.log(`ReemTeamHQ API listening on ${env.port}`);
});
