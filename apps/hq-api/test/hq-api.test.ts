import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { AdminActionLog } from '../src/models.js';

const port = 4545;
const baseUrl = `http://127.0.0.1:${port}`;
let mongo: MongoMemoryServer;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;

const api = async (path: string, init?: { method?: string; body?: unknown }) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-hq-internal-token': 'test-token'
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body)
  });
  const payload = response.status === 204 ? null : await response.json();
  return { status: response.status, payload };
};

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('reemteam-hq-test');
  process.env.HQ_INTERNAL_TOKEN = 'test-token';
  process.env.JWT_SECRET = 'test-secret';
  process.env.OPERATOR_EMAIL = 'owner@test.local';
  process.env.OPERATOR_PASSWORD = 'password';
  process.env.OPERATOR_NAME = 'Owner';
  await connectDatabase();
  server = createApp().listen(port);
});

beforeEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await disconnectDatabase();
  await mongo.stop();
});

test('ReemTeamHQ CRUD, Growth Plays, Content Studio, and audit log are clean-slate native', async () => {
  const user = await api('/api/hq/users', {
    method: 'POST',
    body: {
      displayName: 'Crown Maya',
      username: 'crownmaya',
      email: 'maya@example.com',
      role: 'player',
      tags: ['vip', 'content_safe'],
      gamesPlayed: 12
    }
  });
  assert.equal(user.status, 201);

  const tagged = await api(`/api/hq/users/${user.payload.id}/tags`, {
    method: 'PATCH',
    body: { add: ['hot_player'], remove: ['vip'] }
  });
  assert.equal(tagged.status, 200);
  assert.equal(tagged.payload.tags.includes('hot_player'), true);
  assert.equal(tagged.payload.tags.includes('vip'), false);

  const crib = await api('/api/hq/cribs', {
    method: 'POST',
    body: {
      cribName: 'The Back Room',
      description: 'Higher-stake games with heat.',
      stakeTier: 'high',
      growthPriority: 88,
      featured: true
    }
  });
  assert.equal(crib.status, 201);

  const table = await api('/api/hq/tables', {
    method: 'POST',
    body: {
      tableName: 'Back Room 1',
      cribId: crib.payload.id,
      stake: 50,
      maxSeats: 4,
      status: 'active'
    }
  });
  assert.equal(table.status, 201);

  const event = await api('/api/hq/events', {
    method: 'POST',
    body: {
      eventName: 'Friday Night Reem',
      eventType: 'reem_chase',
      startTime: new Date(Date.now() + 60_000).toISOString(),
      endTime: new Date(Date.now() + 3_600_000).toISOString(),
      eligibleCribs: [crib.payload.id],
      eligibleTables: [table.payload.id],
      growthGoal: 'Drive high-stake participation.'
    }
  });
  assert.equal(event.status, 201);

  const signal = await api('/api/hq/game-intelligence/signals', {
    method: 'POST',
    body: {
      signalType: 'reem_detected',
      sourceType: 'gameplay',
      sourceId: 'round-1',
      playerId: user.payload.id,
      tableId: table.payload.id,
      cribId: crib.payload.id,
      eventId: event.payload.id,
      title: 'Crown Maya hit a Reem in The Back Room',
      description: 'A content-safe Reem landed during a high-stake run.',
      occurredAt: new Date().toISOString(),
      severity: 'high',
      confidence: 96,
      visibilitySafe: true
    }
  });
  assert.equal(signal.status, 201);

  const play = await api('/api/hq/growth-plays', {
    method: 'POST',
    body: {
      signalId: signal.payload.id,
      playType: 'gameplay_highlight',
      activeCampaign: 'promote_friday_night_reem'
    }
  });
  assert.equal(play.status, 201);
  assert.equal(play.payload.whyThis.sourceSignals[0], 'Crown Maya hit a Reem in The Back Room');
  assert.ok(play.payload.finalScore > 0);

  const approved = await api(`/api/hq/growth-plays/${play.payload.id}/approve`, { method: 'POST' });
  assert.equal(approved.payload.status, 'approved');

  const draft = await api(`/api/hq/growth-plays/${play.payload.id}/build-content`, { method: 'POST' });
  assert.equal(draft.status, 201);
  assert.equal(draft.payload.status, 'needs_review');

  const command = await api('/api/hq/command-center');
  assert.equal(command.status, 200);
  assert.equal(command.payload.product, 'ReemTeamHQ');

  const actions = await AdminActionLog.find().lean();
  assert.equal(actions.some((action) => action.actionType === 'user_created'), true);
  assert.equal(actions.some((action) => action.actionType === 'growth_play_created'), true);
  assert.equal(actions.some((action) => action.actionType === 'content_created'), true);
});
