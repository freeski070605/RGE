import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { router } from './routes.js';

export const createApp = () => {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(morgan('dev'));
  app.use('/api', router);

  const dashboardDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../hq-dashboard/dist');
  app.use(express.static(dashboardDist));
  app.get('*splat', (_request, response) => {
    response.sendFile(path.join(dashboardDist, 'index.html'));
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected ReemTeamHQ error';
    response.status(message.includes('not found') ? 404 : 400).json({ message });
  });

  return app;
};
