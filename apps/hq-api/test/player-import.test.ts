import assert from 'node:assert/strict';
import test from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';

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
    await mongoose.default.connection.db?.collection('user').insertMany([
      {
        user: {
          displayName: 'Legacy Ace',
          username: 'Legacy Ace!',
          email: 'ace@example.com',
          lastLoginAt: new Date().toISOString(),
          contentSafe: true
        },
        stats: {
          gamesPlayed: 44,
          wins: 25,
          losses: 19,
          reems: 3,
          referrals: 8,
          averageStake: 55
        },
        walletSummary: {
          credits: 2800
        }
      },
      {
        displayName: 'Legacy Admin',
        username: 'legacyadmin',
        role: 'admin'
      }
    ]);

    const result = await importExistingPlayers(['players', 'user'], 100);
    assert.deepEqual(result.collectionsScanned, ['user']);
    assert.deepEqual(result.collectionsMissing, ['players']);
    assert.equal(result.imported, 1);
    assert.equal(result.skipped, 1);

    const user = await User.findOne({ username: 'legacy_ace' }).lean();
    assert.equal(user?.displayName, 'Legacy Ace');
    assert.equal(user?.role, 'player');
    assert.equal(user?.rtcBalance, 2800);
    assert.equal(user?.tags.includes('high_stakes'), true);
    assert.equal(user?.tags.includes('strong_referrer'), true);

    const profile = await UserProfile.findOne({ userId: user?._id }).lean();
    assert.equal(profile?.displayName, 'Legacy Ace');

    const rerun = await importExistingPlayers(['user'], 100);
    assert.equal(rerun.imported, 0);
    assert.equal(rerun.updated, 1);

    const legacyUserId = new ObjectId();
    await mongoose.default.connection.db?.collection('hq_users').insertOne({
      _id: legacyUserId,
      displayName: 'HQ Existing Player',
      username: 'hq_existing',
      role: 'player',
      status: 'active'
    });
    await mongoose.default.connection.db?.collection('hq_user_profiles').insertOne({
      userId: legacyUserId,
      displayName: 'HQ Existing Player',
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      reems: 0,
      referralCount: 4,
      averageStake: 35,
      highestStake: 150,
      walletSummary: { credits: 0 },
      tags: ['vip']
    });
    await mongoose.default.connection.db?.collection('player_stats_daily').insertMany([
      {
        playerId: legacyUserId,
        username: 'hq_existing',
        matchesPlayed: 60,
        wins: 36,
        reems: 5,
        caughtDropWins: 2,
        inviteCount: 3,
        rewardedInvites: 1,
        depositAmount: 43000,
        grossPayout: 12000,
        avgStake: 40,
        highestStakeWin: 150,
        date: new Date()
      },
      {
        playerId: legacyUserId,
        username: 'hq_existing',
        matchesPlayed: 39,
        wins: 25,
        reems: 2,
        caughtDropWins: 1,
        inviteCount: 1,
        rewardedInvites: 1,
        depositAmount: 40000,
        grossPayout: 9000,
        avgStake: 30,
        highestStakeWin: 100,
        date: new Date()
      }
    ]);

    const hqResult = await importExistingPlayers(['hq_user_profiles', 'hq_users'], 100);
    assert.deepEqual(hqResult.collectionsScanned, ['hq_user_profiles', 'hq_users']);
    assert.equal(hqResult.imported, 1);
    assert.equal(hqResult.updated, 1);

    const hqUser = await User.findOne({ username: 'hq_existing' }).lean();
    assert.equal(hqUser?.gamesPlayed, 99);
    assert.equal(hqUser?.wins, 61);
    assert.equal(hqUser?.highestStake, 150);
    assert.equal(hqUser?.reems, 7);
    assert.equal(hqUser?.rtcBalance, 83000);
    assert.equal(hqUser?.walletSummary.winnings, 21000);
    assert.equal(hqUser?.tags.includes('vip'), true);

    const hqProfile = await UserProfile.findOne({ userId: hqUser?._id }).lean();
    assert.equal(hqProfile?.summary.gamesPlayed, 99);

    await User.findByIdAndUpdate(hqUser?._id, { $set: { rtcBalance: 0, 'walletSummary.credits': 0, gamesPlayed: 0, wins: 0, reems: 0 } });
    const refreshed = await importExistingPlayers(['hq_user_profiles', 'hq_users'], 100);
    assert.equal(refreshed.updated, 2);
    const refreshedUser = await User.findOne({ username: 'hq_existing' }).lean();
    assert.equal(refreshedUser?.rtcBalance, 83000);
    assert.equal(refreshedUser?.gamesPlayed, 99);

    await disconnectDatabase();
  } finally {
    await mongo.stop();
  }
});
