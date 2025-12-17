import express, { Request, Response, NextFunction } from 'express';
import { ensureSchema, pool } from './clients/postgres.js';
import { ensureTrinoSchema } from './clients/trino.js';
import { pgRouter } from './routes/pg.js';
import { pgUniqueRouter } from './routes/pg-unique.js';
import { balanceRouter } from './routes/pg-balance.js';
import { trinoRouter, flushTrinoBatchers } from './routes/trino.js';
import { dualRouter, flushDualBatchers } from './routes/dual.js';

const { PORT = '3000' } = process.env;

const app = express();
app.use(express.json());

app.use('/pg', pgRouter);
app.use('/pg/unique', pgUniqueRouter);
app.use('/pg/balance', balanceRouter);
app.use('/trino', trinoRouter);
app.use('/dual', dualRouter);

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(`${req.method} ${req.path} error:`, err);
  res.status(500).json({ error: err.message });
});

let server: ReturnType<typeof app.listen>;

async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }

  try {
    await Promise.all([flushTrinoBatchers(), flushDualBatchers()]);
    console.log('Trino batchers flushed');
  } catch (e) {
    console.error('Error flushing Trino batchers:', e);
  }

  try {
    await pool.end();
    console.log('PostgreSQL pool closed');
  } catch (e) {
    console.error('Error closing PostgreSQL pool:', e);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch uncaught errors to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

Promise.all([ensureSchema(), ensureTrinoSchema()])
  .then(() => {
    server = app.listen(Number(PORT), () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    });
  })
  .catch((e) => {
    console.error('Failed to init schema', e);
    process.exit(1);
  });
