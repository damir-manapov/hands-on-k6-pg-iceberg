import { Router } from 'express';
import {
  pgHealthCheck,
  pgGetStats,
  pgCreatePerson,
  pgListPeople,
} from '../repositories/pg.js';

export const pgRouter = Router();

pgRouter.get('/health', async (_req, res) => {
  await pgHealthCheck();
  res.json({ ok: true });
});

pgRouter.get('/stats', async (_req, res) => {
  const stats = await pgGetStats();
  res.json({ tables: stats });
});

pgRouter.post('/people', async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const person = await pgCreatePerson(name);
  res.status(201).json(person);
});

pgRouter.get('/people', async (_req, res) => {
  const people = await pgListPeople();
  res.json(people);
});
