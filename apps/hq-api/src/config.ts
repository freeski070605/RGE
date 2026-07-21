import 'dotenv/config';

const intFromEnv = (key: string, fallback: number) => {
  const parsed = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveMongoUri = () => {
  const candidates = ['MONGODB_URI', 'MONGO_URI', 'MONGO_URL', 'DATABASE_URL', 'MONGODB_URL', 'DB_URI'];
  for (const key of candidates) {
    const value = process.env[key]?.trim();
    if (value) {
      return { uri: value, source: key };
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    return { uri: 'mongodb://127.0.0.1:27017/reemteam-hq', source: 'development_default' };
  }

  return { uri: '', source: '' };
};

const mongo = resolveMongoUri();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: intFromEnv('PORT', 4000),
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:4000',
  mongoUri: mongo.uri,
  mongoUriSource: mongo.source,
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
