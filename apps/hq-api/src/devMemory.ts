import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri('reemteam-hq-dev');
process.env.HQ_INTERNAL_TOKEN = process.env.HQ_INTERNAL_TOKEN ?? 'dev-token';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';
process.env.OPERATOR_EMAIL = process.env.OPERATOR_EMAIL ?? 'owner@reemteam.local';
process.env.OPERATOR_PASSWORD = process.env.OPERATOR_PASSWORD ?? 'change-me';
process.env.OPERATOR_NAME = process.env.OPERATOR_NAME ?? 'ReemTeam Owner';

const { env } = await import('./config.js');
const { connectDatabase } = await import('./db.js');
const { createApp } = await import('./app.js');

await connectDatabase();
createApp().listen(env.port, () => {
  console.log(`ReemTeamHQ memory dev server listening on http://127.0.0.1:${env.port}`);
  console.log(`Sign in with ${env.operatorEmail} / ${env.operatorPassword}`);
});

const shutdown = async () => {
  await mongo.stop();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
