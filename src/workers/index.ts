import { ChildProcess, fork } from 'child_process';
import path from 'path';

type WorkerProcessDefinition = {
  name: string;
  script: string;
};

const workerDefinitions: WorkerProcessDefinition[] = [
  { name: 'intelligence', script: 'intelligenceWorker.js' },
  { name: 'content', script: 'contentWorker.js' },
  { name: 'media', script: 'mediaWorker.js' },
  { name: 'scheduler', script: 'schedulerWorker.js' }
];

const stopChild = async (child: ChildProcess, signal: NodeJS.Signals) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }

      finished = true;
      resolve();
    };

    child.once('exit', finish);
    child.kill(signal);

    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }

      finish();
    }, 5_000).unref();
  });
};

const startWorkerProcess = (definition: WorkerProcessDefinition) => {
  const child = fork(path.resolve(__dirname, definition.script), {
    env: process.env,
    stdio: 'inherit'
  });

  console.log(`Started ${definition.name} worker process (pid ${child.pid ?? 'unknown'})`);
  return child;
};

const bootstrapWorkers = async () => {
  const workers = workerDefinitions.map((definition) => ({
    ...definition,
    child: startWorkerProcess(definition)
  }));
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals, reason: string, exitCode = 0) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`${reason}. Shutting down RGE worker processes.`);
    await Promise.allSettled(workers.map(({ child }) => stopChild(child, signal)));
    process.exit(exitCode);
  };

  for (const worker of workers) {
    worker.child.on('error', (error) => {
      console.error(`Failed to start ${worker.name} worker process`, error);
      void shutdown('SIGTERM', `Unable to continue because ${worker.name} worker failed to start`, 1);
    });

    worker.child.on('exit', (code, signal) => {
      if (shuttingDown) {
        return;
      }

      const reason = `${worker.name} worker exited unexpectedly (code: ${code ?? 'null'}, signal: ${signal ?? 'none'})`;
      console.error(reason);
      void shutdown('SIGTERM', reason, code ?? 1);
    });
  }

  console.log('All RGE worker processes are running');

  process.on('SIGINT', () => {
    void shutdown('SIGINT', 'Received SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM', 'Received SIGTERM');
  });
};

bootstrapWorkers().catch((error) => {
  console.error('Failed to start worker cluster', error);
  process.exit(1);
});
