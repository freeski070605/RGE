import assert from 'node:assert/strict';
import test from 'node:test';

test('production config does not crash when Mongo URI is missing', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMongoUri = process.env.MONGODB_URI;
  const previousMongoUrl = process.env.MONGO_URL;
  const previousMongoAlt = process.env.MONGO_URI;
  const previousDatabaseUrl = process.env.DATABASE_URL;

  process.env.NODE_ENV = 'production';
  delete process.env.MONGODB_URI;
  delete process.env.MONGO_URL;
  delete process.env.MONGO_URI;
  delete process.env.DATABASE_URL;

  const module = await import(`../src/config.ts?missing-mongo-${Date.now()}`);
  assert.equal(module.env.mongoUri, '');
  assert.equal(module.env.mongoUriSource, '');

  process.env.NODE_ENV = previousNodeEnv;
  if (previousMongoUri) process.env.MONGODB_URI = previousMongoUri;
  if (previousMongoUrl) process.env.MONGO_URL = previousMongoUrl;
  if (previousMongoAlt) process.env.MONGO_URI = previousMongoAlt;
  if (previousDatabaseUrl) process.env.DATABASE_URL = previousDatabaseUrl;
});

test('Mongo URI aliases are accepted', async () => {
  const previousMongoUri = process.env.MONGODB_URI;
  const previousMongoAlt = process.env.MONGO_URI;

  delete process.env.MONGODB_URI;
  process.env.MONGO_URI = 'mongodb+srv://example.invalid/reemteam';

  const module = await import(`../src/config.ts?mongo-alias-${Date.now()}`);
  assert.equal(module.env.mongoUri, 'mongodb+srv://example.invalid/reemteam');
  assert.equal(module.env.mongoUriSource, 'MONGO_URI');

  if (previousMongoUri) process.env.MONGODB_URI = previousMongoUri;
  if (previousMongoAlt) {
    process.env.MONGO_URI = previousMongoAlt;
  } else {
    delete process.env.MONGO_URI;
  }
});
