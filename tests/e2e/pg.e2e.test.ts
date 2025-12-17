import { describe, it, expect } from 'vitest';

const BASE_URL = 'http://localhost:3000';

describe('Server E2E Tests', () => {
  describe('GET /pg/health', () => {
    it('should return ok: true when database is connected', async () => {
      const res = await fetch(`${BASE_URL}/pg/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });
  });

  describe('POST /pg/people', () => {
    it('should create a person with valid name', async () => {
      const name = `test-user-${Date.now()}`;
      const res = await fetch(`${BASE_URL}/pg/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toMatchObject({ name });
      expect(body.id).toBeDefined();
      expect(typeof body.id).toBe('number');
    });

    it('should return 400 when name is missing', async () => {
      const res = await fetch(`${BASE_URL}/pg/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'name required' });
    });

    it('should return 400 when body is empty object', async () => {
      const res = await fetch(`${BASE_URL}/pg/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'name required' });
    });

    it('should return 400 when name is empty string', async () => {
      const res = await fetch(`${BASE_URL}/pg/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'name required' });
    });
  });

  describe('GET /pg/people', () => {
    it('should return an array of people', async () => {
      const res = await fetch(`${BASE_URL}/pg/people`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it('should include previously created person', async () => {
      const name = `findme-${Date.now()}`;

      // Create a person
      await fetch(`${BASE_URL}/pg/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      // List all people
      const res = await fetch(`${BASE_URL}/pg/people`);
      expect(res.status).toBe(200);

      const body = await res.json();
      const found = body.find((p: { name: string }) => p.name === name);
      expect(found).toBeDefined();
      expect(found.name).toBe(name);
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await fetch(`${BASE_URL}/unknown-route`);
      expect(res.status).toBe(404);
    });
  });
});
