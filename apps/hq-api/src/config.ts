import 'dotenv/config';

const intFromEnv = (key: string, fallback: number) => {
  const parsed = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveMongoUri = () => {
  const uri = process.env.MONGODB_URI;
  if (uri) return uri;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI is required in production. Set it on the Render rge-api service environment.');
  }

  return 'mongodb://127.0.0.1:27017/reemteam-hq';
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: intFromEnv('PORT', 4000),
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:4000',
  mongoUri: resolveMongoUri(),
  redisUrl: process.env.REDIS_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  authCookieName: process.env.AUTH_COOKIE_NAME ?? 'reemteam_hq_session',
  sessionHours: intFromEnv('AUTH_SESSION_TTL_HOURS', 12),
  internalToken: process.env.HQ_INTERNAL_TOKEN ?? process.env.RGE_INTERNAL_TOKEN ?? '',
  operatorEmail: process.env.OPERATOR_EMAIL ?? 'owner@reemteam.local',
  operatorPassword: process.env.OPERATOR_PASSWORD ?? 'change-me',
  operatorName: process.env.OPERATOR_NAME ?? 'ReemTeam Owner',
  isProduction: process.env.NODE_ENV === 'production'
};
