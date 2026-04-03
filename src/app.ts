import fs from 'fs';
import path from 'path';
import express, { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import router from './api/routes';
import { AppError } from './utils/errors';
import { env } from './config/env';

export const createApp = () => {
  const app = express();
  const dashboardDistDir = path.resolve(process.cwd(), 'dashboard', 'dist');
  const dashboardIndexFile = path.join(dashboardDistDir, 'index.html');
  const apiLimiter = rateLimit({
    windowMs: env.API_RATE_LIMIT_WINDOW_MS,
    limit: env.API_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      message: 'Too many requests, please try again shortly.'
    }
  });

  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false
    })
  );
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/media', express.static(env.mediaRoot));
  app.use('/assets', express.static(env.assetRoot));
  app.use('/api', apiLimiter);
  app.use('/api', router);

  if (fs.existsSync(dashboardIndexFile)) {
    app.use(express.static(dashboardDistDir));

    app.get(/^(?!\/api|\/media|\/assets).*/, (_req, res) => {
      res.sendFile(dashboardIndexFile);
    });
  }

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (!(error instanceof AppError)) {
      console.error(error);
    }

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        message: error.message
      });
      return;
    }

    res.status(500).json({
      message: env.isProduction ? 'Unexpected server error' : error.message || 'Unexpected server error'
    });
  });

  return app;
};
