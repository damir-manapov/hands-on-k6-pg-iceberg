import { describe, it, expect, beforeAll } from 'vitest';
import pg from 'pg';

const PRIMARY_PORT = 5432;
const REPLICA_1_PORT = 5433;
const REPLICA_2_PORT = 5434;

const createClient = (port: number) =>
  new pg.Client({
    host: 'localhost',
    port,
    user: 'postgres',
    password: 'postgres',
    database: 'appdb',
  });

describe('PostgreSQL Cluster E2E Tests', () => {
  const testName = `cluster-test-${Date.now()}`;
  let insertedId: number;

  beforeAll(async () => {
    // Write to primary
    const primary = createClient(PRIMARY_PORT);
    await primary.connect();

    // Ensure table exists
    await primary.query(`
      CREATE TABLE IF NOT EXISTS people (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);

    // Insert test data
    const result = await primary.query(
      'INSERT INTO people (name) VALUES ($1) RETURNING id',
      [testName]
    );
    insertedId = result.rows[0].id;
    await primary.end();

    // Give replicas time to catch up
    await new Promise((r) => setTimeout(r, 500));
  });

  describe('Primary (port 5432)', () => {
    it('should have the inserted record', async () => {
      const client = createClient(PRIMARY_PORT);
      await client.connect();
      const result = await client.query('SELECT * FROM people WHERE id = $1', [
        insertedId,
      ]);
      await client.end();

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe(testName);
    });

    it('should allow writes', async () => {
      const client = createClient(PRIMARY_PORT);
      await client.connect();
      const result = await client.query(
        "INSERT INTO people (name) VALUES ('write-test') RETURNING id"
      );
      await client.end();

      expect(result.rows[0].id).toBeDefined();
    });
  });

  describe('Replica 1 - SYNC (port 5433)', () => {
    it('should have the inserted record from primary', async () => {
      const client = createClient(REPLICA_1_PORT);
      await client.connect();
      const result = await client.query('SELECT * FROM people WHERE id = $1', [
        insertedId,
      ]);
      await client.end();

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe(testName);
    });

    it('should reject writes (read-only replica)', async () => {
      const client = createClient(REPLICA_1_PORT);
      await client.connect();

      await expect(
        client.query("INSERT INTO people (name) VALUES ('should-fail')")
      ).rejects.toThrow(/read-only/);

      await client.end();
    });

    it('should report as in_recovery', async () => {
      const client = createClient(REPLICA_1_PORT);
      await client.connect();
      const result = await client.query('SELECT pg_is_in_recovery()');
      await client.end();

      expect(result.rows[0].pg_is_in_recovery).toBe(true);
    });
  });

  describe('Replica 2 - ASYNC (port 5434)', () => {
    it('should have the inserted record from primary', async () => {
      const client = createClient(REPLICA_2_PORT);
      await client.connect();
      const result = await client.query('SELECT * FROM people WHERE id = $1', [
        insertedId,
      ]);
      await client.end();

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe(testName);
    });

    it('should reject writes (read-only replica)', async () => {
      const client = createClient(REPLICA_2_PORT);
      await client.connect();

      await expect(
        client.query("INSERT INTO people (name) VALUES ('should-fail')")
      ).rejects.toThrow(/read-only/);

      await client.end();
    });

    it('should report as in_recovery', async () => {
      const client = createClient(REPLICA_2_PORT);
      await client.connect();
      const result = await client.query('SELECT pg_is_in_recovery()');
      await client.end();

      expect(result.rows[0].pg_is_in_recovery).toBe(true);
    });
  });

  describe('Replication Status', () => {
    it('should show both replicas connected to primary', async () => {
      const client = createClient(PRIMARY_PORT);
      await client.connect();
      const result = await client.query(`
        SELECT application_name, state, sync_state
        FROM pg_stat_replication
        ORDER BY application_name
      `);
      await client.end();

      expect(result.rows.length).toBeGreaterThanOrEqual(2);

      const syncReplica = result.rows.find(
        (r) => r.application_name === 'pg_replica_1'
      );
      expect(syncReplica).toBeDefined();
      expect(syncReplica?.state).toBe('streaming');
      expect(syncReplica?.sync_state).toBe('sync');

      const asyncReplica = result.rows.find((r) => r.sync_state === 'async');
      expect(asyncReplica).toBeDefined();
      expect(asyncReplica?.state).toBe('streaming');
    });
  });
});
