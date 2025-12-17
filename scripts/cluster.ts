#!/usr/bin/env npx tsx

import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

const WORKER_COUNT = Number(process.env.WORKERS) || 10;
const PORT = Number(process.env.PORT) || 3000;

if (cluster.isPrimary) {
  console.log(`[Primary] Starting ${WORKER_COUNT} workers on port ${PORT}...`);
  console.log(`[Primary] Available CPUs: ${availableParallelism()}\n`);

  let isShuttingDown = false;

  for (let i = 0; i < WORKER_COUNT; i++) {
    cluster.fork({ PORT: String(PORT), WORKER_ID: String(i) });
  }

  cluster.on('exit', (worker, code, signal) => {
    if (isShuttingDown) return; // Don't restart during shutdown

    console.log(
      `[Primary] Worker ${worker.id} died (${signal || code}). Restarting...`
    );
    cluster.fork({ PORT: String(PORT), WORKER_ID: String(worker.id) });
  });

  cluster.on('online', (worker) => {
    console.log(`[Primary] Worker ${worker.id} online`);
  });

  // Graceful shutdown
  let workersRemaining = WORKER_COUNT;

  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('\n[Primary] Shutting down all workers...');
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill('SIGTERM');
    }
  };

  cluster.on('exit', () => {
    if (!isShuttingDown) return;

    workersRemaining--;
    if (workersRemaining === 0) {
      console.log('[Primary] All workers stopped');
      process.exit(0);
    }
  });

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  // Worker process - import and run the server
  const workerId = process.env.WORKER_ID;
  const port = process.env.PORT;
  console.log(`[Worker ${workerId}] Starting on port ${port}...`);

  // Dynamic import to start the server
  import('../src/server.js').catch((err) => {
    console.error(`[Worker ${workerId}] Failed to start:`, err);
    process.exit(1);
  });
}
