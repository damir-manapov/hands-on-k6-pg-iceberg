import { Router } from 'express';
import {
  pgHealthCheck,
  pgCreatePerson,
  pgListPeople,
} from '../repositories/pg.js';
import {
  trinoHealthCheck,
  trinoCreatePerson,
  trinoCreatePersonBatched,
  trinoListPeople,
  trinoFlushBatchers,
} from '../repositories/trino.js';

export const dualRouter = Router();

export async function flushDualBatchers() {
  await trinoFlushBatchers();
}

dualRouter.get('/health', async (_req, res) => {
  const [pgOk, trinoOk] = await Promise.all([
    pgHealthCheck(),
    trinoHealthCheck(),
  ]);
  res.json({ pg: pgOk, trino: trinoOk });
});

// Immediate write to both PG and Trino in parallel
dualRouter.post('/people', async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name required' });

  const [pgResult, trinoResult] = await Promise.all([
    pgCreatePerson(name),
    trinoCreatePerson(name),
  ]);

  res.status(201).json({
    pg: pgResult,
    trino: trinoResult,
  });
});

// Batched write - PG immediate, Trino batched
dualRouter.post('/people/batch', async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name required' });

  const [pgResult, trinoResult] = await Promise.all([
    pgCreatePerson(name),
    trinoCreatePersonBatched(name),
  ]);

  res.status(201).json({
    pg: pgResult,
    trino: trinoResult,
  });
});

dualRouter.get('/people', async (_req, res) => {
  const [pgRows, trinoRows] = await Promise.all([
    pgListPeople(),
    trinoListPeople(),
  ]);

  res.json({
    pg: pgRows,
    trino: trinoRows,
  });
});
