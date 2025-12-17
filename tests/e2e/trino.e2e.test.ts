import { describe, it, expect } from 'vitest';

const BASE_URL = 'http://localhost:3000';

describe('Trino E2E Tests', () => {
  describe('GET /trino/health', () => {
    it('should return ok: true when Trino is connected', async () => {
      const res = await fetch(`${BASE_URL}/trino/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });
  });

  describe('POST /trino/people', () => {
    it('should create a person with valid name', async () => {
      const name = `test-user-${Date.now()}`;
      const res = await fetch(`${BASE_URL}/trino/people`, {
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
      const res = await fetch(`${BASE_URL}/trino/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'name required' });
    });

    it('should return 400 when body is empty object', async () => {
      const res = await fetch(`${BASE_URL}/trino/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'name required' });
    });

    it('should return 400 when name is empty string', async () => {
      const res = await fetch(`${BASE_URL}/trino/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'name required' });
    });
  });

  describe('GET /trino/people', () => {
    it('should return an array of people', async () => {
      const res = await fetch(`${BASE_URL}/trino/people`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it('should include previously created person', async () => {
      const name = `findme-trino-${Date.now()}`;

      // Create a person
      await fetch(`${BASE_URL}/trino/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      // // List all people - Trino/Iceberg may have eventual consistency in cluster mode
      // await new Promise((r) => setTimeout(r, 500));

      const res = await fetch(`${BASE_URL}/trino/people`);
      expect(res.status).toBe(200);

      const body = await res.json();
      const found = body.find((p: { name: string }) => p.name === name);
      expect(found).toBeDefined();
      expect(found.name).toBe(name);
    });
  });
});
