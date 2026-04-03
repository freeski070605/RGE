import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4010),
  APP_BASE_URL: z.string().default(''),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_ORGANIZATION: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  BACKEND_API_BASE_URL: z.string().default('http://localhost:4000'),
  BACKEND_INTERNAL_TOKEN: z.string().default(''),
  RGE_INTERNAL_TOKEN: z.string().default(''),
  OPERATOR_EMAIL: z.string().email().default('ops@reemteam.local'),
  OPERATOR_PASSWORD: z.string().default('changeme'),
  OPERATOR_NAME: z.string().default('ReemGrowth Operator'),
  JWT_SECRET: z.string().default('development-rge-secret'),
  AUTH_COOKIE_NAME: z.string().default('rge_operator_session'),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  MEDIA_OUTPUT_DIR: z.string().default('storage/generated'),
  ASSET_UPLOAD_DIR: z.string().default('storage/assets'),
  VIDEO_DURATION_SECONDS: z.coerce.number().default(6),
  ENABLE_VIDEO_GENERATION: z.coerce.boolean().default(true),
  UPLOAD_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(250 * 1024 * 1024),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  DEFAULT_POST_PLATFORMS: z.string().default('instagram'),
  DEFAULT_TIMEZONE: z.string().default('America/New_York'),
  CONTENT_WORKER_CONCURRENCY: z.coerce.number().default(3),
  MEDIA_WORKER_CONCURRENCY: z.coerce.number().default(2),
  SCHEDULER_WORKER_CONCURRENCY: z.coerce.number().default(2),
  INTELLIGENCE_WORKER_CONCURRENCY: z.coerce.number().default(1),
  QUEUE_JOB_ATTEMPTS: z.coerce.number().default(3),
  REFERRAL_REWARD_CENTS: z.coerce.number().default(500),
  RGE_SYNC_DAYS: z.coerce.number().default(30),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  CLOUDINARY_FOLDER: z.string().default('rge'),
  INSTAGRAM_GRAPH_VERSION: z.string().default('v23.0'),
  INSTAGRAM_USER_ID: z.string().default(''),
  INSTAGRAM_ACCESS_TOKEN: z.string().default('')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid environment configuration\n${issues}`);
}

const requiredProductionKeys = [
  ['JWT_SECRET', parsed.data.JWT_SECRET],
  ['OPERATOR_PASSWORD', parsed.data.OPERATOR_PASSWORD],
  ['RGE_INTERNAL_TOKEN', parsed.data.RGE_INTERNAL_TOKEN],
  ['CLOUDINARY_CLOUD_NAME', parsed.data.CLOUDINARY_CLOUD_NAME],
  ['CLOUDINARY_API_KEY', parsed.data.CLOUDINARY_API_KEY],
  ['CLOUDINARY_API_SECRET', parsed.data.CLOUDINARY_API_SECRET]
];

if (parsed.data.NODE_ENV === 'production') {
  const missingProductionKeys = requiredProductionKeys
    .filter(([, value]) => !value || String(value).trim().length === 0)
    .map(([key]) => key);

  if (missingProductionKeys.length) {
    throw new Error(`Missing required production environment variables: ${missingProductionKeys.join(', ')}`);
  }
}

const mediaRoot = path.resolve(process.cwd(), parsed.data.MEDIA_OUTPUT_DIR);
const assetRoot = path.resolve(process.cwd(), parsed.data.ASSET_UPLOAD_DIR);
const appBaseUrl = parsed.data.APP_BASE_URL.replace(/\/+$/, '');

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  defaultPlatforms: parsed.data.DEFAULT_POST_PLATFORMS.split(',')
    .map((platform) => platform.trim())
    .filter(Boolean),
  appBaseUrl,
  mediaRoot,
  assetRoot,
  imageOutputDir: path.join(mediaRoot, 'images'),
  videoOutputDir: path.join(mediaRoot, 'videos'),
  assetOriginalDir: path.join(assetRoot, 'original'),
  assetEditedDir: path.join(assetRoot, 'edited'),
  isCloudinaryConfigured: Boolean(
    parsed.data.CLOUDINARY_CLOUD_NAME && parsed.data.CLOUDINARY_API_KEY && parsed.data.CLOUDINARY_API_SECRET
  ),
  isInstagramConfigured: Boolean(parsed.data.INSTAGRAM_USER_ID && parsed.data.INSTAGRAM_ACCESS_TOKEN)
};
