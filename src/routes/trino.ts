import { Router } from 'express';
import {
  trinoHealthCheck,
  trinoGetStats,
  trinoCreatePerson,
  trinoCreatePersonBatched,
  trinoListPeople,
  trinoOptimize,
  trinoFlushBatchers,
} from '../repositories/trino.js';

export const trinoRouter = Router();

trinoRouter.get('/health', async (_req, res) => {
  const ok = await trinoHealthCheck();
  res.json({ ok });
});

trinoRouter.get('/stats', async (_req, res) => {
  const stats = await trinoGetStats();
  res.json({ tables: stats });
});

// Immediate write - each request executes its own INSERT
trinoRouter.post('/people', async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const person = await trinoCreatePerson(name);
  res.status(201).json(person);
});

// Batched write - buffers rows and flushes every 500ms
trinoRouter.post('/people/batch', async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const person = await trinoCreatePersonBatched(name);
  res.status(201).json(person);
});

trinoRouter.get('/people', async (_req, res) => {
  const people = await trinoListPeople();
  res.json(people);
});

// Compact/merge small files into larger ones
trinoRouter.post('/optimize', async (_req, res) => {
  const result = await trinoOptimize();
  res.json(result);
});

/** Flush pending writes (for graceful shutdown) */
export async function flushTrinoBatchers(): Promise<void> {
  await trinoFlushBatchers();
}
