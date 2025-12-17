import { Router } from 'express';
import {
  createUniqueSingle,
  listUniqueSingle,
  countUniqueSingle,
  truncateUniqueSingle,
  createUniqueTriple,
  listUniqueTriple,
  countUniqueTriple,
  truncateUniqueTriple,
  createUniqueDualTriple,
  listUniqueDualTriple,
  countUniqueDualTriple,
  truncateUniqueDualTriple,
} from '../repositories/pg-unique.js';

export const pgUniqueRouter = Router();

// Helper to validate row input
function validateRow(body: Record<string, unknown>) {
  const { col_a, col_b, col_c, col_d, col_e, col_f } = body;
  if (!col_a || !col_b || !col_c || !col_d || !col_e || !col_f) {
    return null;
  }
  return {
    col_a: String(col_a),
    col_b: String(col_b),
    col_c: String(col_c),
    col_d: String(col_d),
    col_e: String(col_e),
    col_f: String(col_f),
  };
}

// ============ Scenario 1: unique_single - UNIQUE(col_a) ============

pgUniqueRouter.get('/single', async (_req, res) => {
  const rows = await listUniqueSingle();
  res.json(rows);
});

pgUniqueRouter.get('/single/count', async (_req, res) => {
  const count = await countUniqueSingle();
  res.json({ count });
});

pgUniqueRouter.post('/single', async (req, res) => {
  const row = validateRow(req.body);
  if (!row) {
    res.status(400).json({ error: 'col_a through col_f required' });
    return;
  }
  const created = await createUniqueSingle(row);
  res.status(201).json(created);
});

pgUniqueRouter.delete('/single', async (_req, res) => {
  await truncateUniqueSingle();
  res.json({ ok: true });
});

// ============ Scenario 2: unique_triple - UNIQUE(col_a, col_b, col_c) ============

pgUniqueRouter.get('/triple', async (_req, res) => {
  const rows = await listUniqueTriple();
  res.json(rows);
});

pgUniqueRouter.get('/triple/count', async (_req, res) => {
  const count = await countUniqueTriple();
  res.json({ count });
});

pgUniqueRouter.post('/triple', async (req, res) => {
  const row = validateRow(req.body);
  if (!row) {
    res.status(400).json({ error: 'col_a through col_f required' });
    return;
  }
  const created = await createUniqueTriple(row);
  res.status(201).json(created);
});

pgUniqueRouter.delete('/triple', async (_req, res) => {
  await truncateUniqueTriple();
  res.json({ ok: true });
});

// ============ Scenario 3: unique_dual - UNIQUE(a,b,c) + UNIQUE(d,e,f) ============

pgUniqueRouter.get('/dual', async (_req, res) => {
  const rows = await listUniqueDualTriple();
  res.json(rows);
});

pgUniqueRouter.get('/dual/count', async (_req, res) => {
  const count = await countUniqueDualTriple();
  res.json({ count });
});

pgUniqueRouter.post('/dual', async (req, res) => {
  const row = validateRow(req.body);
  if (!row) {
    res.status(400).json({ error: 'col_a through col_f required' });
    return;
  }
  const created = await createUniqueDualTriple(row);
  res.status(201).json(created);
});

pgUniqueRouter.delete('/dual', async (_req, res) => {
  await truncateUniqueDualTriple();
  res.json({ ok: true });
});
