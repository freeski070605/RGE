import assert from 'node:assert/strict';
import test from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';

test('existing players are imported from legacy collections into HQ users and profiles', async (t) => {
  let mongo: MongoMemoryServer | null = null;

  try {
    mongo = await MongoMemoryServer.create();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    t.skip(`MongoDB memory server binary unavailable: ${message}`);
    return;
  }

  try {
    process.env.MONGODB_URI = mongo.getUri('reemteam-hq-player-import-test');
    process.env.JWT_SECRET = 'test-secret';
    const mongoose = await import('mongoose');
    const { connectDatabase, disconnectDatabase } = await import('../src/db.js');
    const { importExistingPlayers } = await import('../src/playerImport.js');
    const { User, UserProfile } = await import('../src/models.js');

    await connectDatabase();
    await mongoose.default.connection.db?.collection('players').insertMany([
      {
        displayName: 'Legacy Ace',
        username: 'Legacy Ace!',
        email: 'ace@example.com',
        gamesPlayed: 44,
        wins: 25,
        losses: 19,
        reems: 3,
        referrals: 8,
        averageStake: 55,
        lastLoginAt: new Date().toISOString(),
        contentSafe: true
      },
      {
        displayName: 'Legacy Admin',
        username: 'legacyadmin',
        role: 'admin'
      }
    ]);

    const result = await importExistingPlayers(['players'], 100);
    assert.deepEqual(result.collectionsScanned, ['players']);
    assert.equal(result.imported, 1);
    assert.equal(result.skipped, 1);

    const user = await User.findOne({ username: 'legacy_ace' }).lean();
    assert.equal(user?.displayName, 'Legacy Ace');
    assert.equal(user?.role, 'player');
    assert.equal(user?.tags.includes('high_stakes'), true);
    assert.equal(user?.tags.includes('strong_referrer'), true);

    const profile = await UserProfile.findOne({ userId: user?._id }).lean();
    assert.equal(profile?.displayName, 'Legacy Ace');

    const rerun = await importExistingPlayers(['players'], 100);
    assert.equal(rerun.imported, 0);
    assert.equal(rerun.updated, 1);

    await disconnectDatabase();
  } finally {
    await mongo.stop();
  }
});
