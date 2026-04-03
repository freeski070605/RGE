import fs from 'fs/promises';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';
import { closeQueues } from './queues';

const bootstrap = async () => {
  await Promise.all([
    connectDatabase(),
    fs.mkdir(env.imageOutputDir, { recursive: true }),
    fs.mkdir(env.videoOutputDir, { recursive: true }),
    fs.mkdir(env.assetOriginalDir, { recursive: true }),
    fs.mkdir(env.assetEditedDir, { recursive: true })
  ]);

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`RGE API listening on port ${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down RGE API`);

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await Promise.allSettled([closeQueues(), disconnectDatabase()]);
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
};

bootstrap().catch((error) => {
  console.error('Failed to start RGE API', error);
  process.exit(1);
});
