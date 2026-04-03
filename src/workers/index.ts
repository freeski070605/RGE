import startIntelligenceWorker from './intelligenceWorker';
import startContentWorker from './contentWorker';
import startMediaWorker from './mediaWorker';
import startSchedulerWorker from './schedulerWorker';
import { disconnectDatabase } from '../config/db';
import { closeQueues } from '../queues';

const bootstrapWorkers = async () => {
  const workers = await Promise.all([
    startIntelligenceWorker(),
    startContentWorker(),
    startMediaWorker(),
    startSchedulerWorker()
  ]);
  console.log('All RGE workers are running');

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down RGE workers`);
    await Promise.allSettled([...workers.map((worker) => worker.close()), closeQueues(), disconnectDatabase()]);
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
};

bootstrapWorkers().catch((error) => {
  console.error('Failed to start worker cluster', error);
  process.exit(1);
});
