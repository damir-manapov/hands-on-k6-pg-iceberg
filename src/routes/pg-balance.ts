import { Router } from 'express';
import {
  createBalanceChange,
  getBalanceByProfileId,
  getBalanceByAccrualDocId,
  listChangesByProfileId,
  listChangesByAccrualDocId,
  countBalanceChanges,
  truncateBalanceChanges,
} from '../repositories/pg-balance.js';

export const balanceRouter = Router();

// Create a balance change
balanceRouter.post('/', async (req, res) => {
  const { profile_id, accrual_doc_id, registrar_doc_id, amount } = req.body;

  if (
    typeof profile_id !== 'number' ||
    typeof accrual_doc_id !== 'number' ||
    typeof registrar_doc_id !== 'number' ||
    typeof amount !== 'number'
  ) {
    res.status(400).json({
      error:
        'profile_id, accrual_doc_id, registrar_doc_id, and amount (all integers) required',
    });
    return;
  }

  const created = await createBalanceChange({
    profile_id,
    accrual_doc_id,
    registrar_doc_id,
    amount,
  });
  res.status(201).json(created);
});

// Get balance by profile ID
balanceRouter.get('/profile/:profileId', async (req, res) => {
  const profileId = Number(req.params.profileId);
  if (isNaN(profileId)) {
    res.status(400).json({ error: 'Invalid profile ID' });
    return;
  }
  const balance = await getBalanceByProfileId(profileId);
  res.json({ profile_id: profileId, balance });
});

// Get balance by accrual document ID
balanceRouter.get('/accrual/:accrualDocId', async (req, res) => {
  const accrualDocId = Number(req.params.accrualDocId);
  if (isNaN(accrualDocId)) {
    res.status(400).json({ error: 'Invalid accrual document ID' });
    return;
  }
  const balance = await getBalanceByAccrualDocId(accrualDocId);
  res.json({ accrual_doc_id: accrualDocId, balance });
});

// List changes by profile ID
balanceRouter.get('/profile/:profileId/changes', async (req, res) => {
  const profileId = Number(req.params.profileId);
  if (isNaN(profileId)) {
    res.status(400).json({ error: 'Invalid profile ID' });
    return;
  }
  const changes = await listChangesByProfileId(profileId);
  res.json(changes);
});

// List changes by accrual document ID
balanceRouter.get('/accrual/:accrualDocId/changes', async (req, res) => {
  const accrualDocId = Number(req.params.accrualDocId);
  if (isNaN(accrualDocId)) {
    res.status(400).json({ error: 'Invalid accrual document ID' });
    return;
  }
  const changes = await listChangesByAccrualDocId(accrualDocId);
  res.json(changes);
});

// Get count
balanceRouter.get('/count', async (_req, res) => {
  const count = await countBalanceChanges();
  res.json({ count });
});

// Truncate all
balanceRouter.delete('/', async (_req, res) => {
  await truncateBalanceChanges();
  res.json({ ok: true });
});
