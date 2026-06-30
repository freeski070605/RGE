import path from 'path';
import express from 'express';
import {
  campaigns,
  contentFormats,
  growthPlayTypes,
  hqModules,
  hqPipeline,
  roles,
  userTags
} from '../../../packages/shared/src';
import { cribExamples, eventExamples, signalTypes } from '../../../packages/game-rules/src';
import { commandCenter, cribs, events, growthPlays, profiles, signals, tables, users } from './seed';

export const createHqApp = () => {
  const app = express();
  const dashboardRoot = path.resolve(process.cwd(), 'apps', 'hq-dashboard');

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      product: 'ReemTeam HQ',
      modules: {
        rge: 'RGE Growth Engine',
        intelligence: 'Game Intelligence',
        content: 'Content Studio',
        dashboard: 'Command Center'
      }
    });
  });

  app.get('/api/platform', (_req, res) => {
    res.json({
      productName: 'ReemTeam HQ',
      primaryQuestion: 'What needs attention today?',
      modules: hqModules,
      pipeline: hqPipeline,
      roles,
      userTags,
      growthPlayTypes,
      signalTypes,
      campaigns,
      contentFormats,
      exampleCribs: cribExamples,
      exampleEvents: eventExamples
    });
  });

  app.get('/api/command-center', (_req, res) => {
    res.json(commandCenter);
  });

  app.get('/api/users', (_req, res) => {
    res.json(users);
  });

  app.get('/api/users/:userId/profile', (req, res) => {
    const user = users.find((row) => row.id === req.params.userId);
    const profile = profiles.find((row) => row.userId === req.params.userId);
    if (!user || !profile) {
      res.status(404).json({ message: 'User profile not found' });
      return;
    }

    res.json({ user, profile });
  });

  app.get('/api/cribs', (_req, res) => {
    res.json(cribs);
  });

  app.get('/api/tables', (_req, res) => {
    res.json(tables);
  });

  app.get('/api/events', (_req, res) => {
    res.json(events);
  });

  app.get('/api/game-intelligence/signals', (_req, res) => {
    res.json(signals);
  });

  app.get('/api/rge/growth-plays', (_req, res) => {
    res.json(growthPlays);
  });

  app.get('/api/content-studio', (_req, res) => {
    res.json({
      flow: ['Growth Play', 'Build Content', 'Choose format', 'Generate captions', 'Preview', 'Approve', 'Schedule/Publish', 'Track Performance'],
      supportedFormats: contentFormats,
      drafts: growthPlays.slice(0, 2).map((play) => ({
        id: `draft_${play.id}`,
        growthPlayId: play.id,
        title: play.title,
        format: play.recommendedFormat,
        status: 'draft',
        nextStep: 'Generate captions'
      }))
    });
  });

  app.get('/api/system-health', (_req, res) => {
    res.json(commandCenter.systemHealth);
  });

  app.use(express.static(dashboardRoot));

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dashboardRoot, 'index.html'));
  });

  return app;
};
