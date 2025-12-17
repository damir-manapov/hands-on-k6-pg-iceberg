import { describe, it, expect, beforeAll } from 'vitest';
import pg from 'pg';

const PRIMARY_PORT = 5432;

const createClient = () =>
  new pg.Client({
    host: 'localhost',
    port: PRIMARY_PORT,
    user: 'postgres',
    password: 'postgres',
    database: 'appdb',
  });

describe('PostgreSQL Unique Constraints E2E Tests', () => {
  beforeAll(async () => {
    const client = createClient();
    await client.connect();
    // Clear test tables
    await client.query('DELETE FROM unique_single');
    await client.query('DELETE FROM unique_triple');
    await client.query('DELETE FROM unique_dual_triple');
    await client.end();
  });

  describe('Scenario 1: unique_single - UNIQUE(col_a)', () => {
    it('should allow insert with unique col_a', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `INSERT INTO unique_single (col_a, col_b, col_c, col_d, col_e, col_f)
         VALUES ('a1', 'b1', 'c1', 'd1', 'e1', 'f1') RETURNING id`
      );
      await client.end();
      expect(result.rows[0].id).toBeDefined();
    });

    it('should reject duplicate col_a', async () => {
      const client = createClient();
      await client.connect();
      await expect(
        client.query(
          `INSERT INTO unique_single (col_a, col_b, col_c, col_d, col_e, col_f)
           VALUES ('a1', 'b2', 'c2', 'd2', 'e2', 'f2')`
        )
      ).rejects.toThrow(/unique.*col_a/i);
      await client.end();
    });

    it('should allow different col_a with same other columns', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `INSERT INTO unique_single (col_a, col_b, col_c, col_d, col_e, col_f)
         VALUES ('a2', 'b1', 'c1', 'd1', 'e1', 'f1') RETURNING id`
      );
      await client.end();
      expect(result.rows[0].id).toBeDefined();
    });
  });

  describe('Scenario 2: unique_triple - UNIQUE(col_a, col_b, col_c)', () => {
    it('should allow insert with unique (a,b,c) combination', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `INSERT INTO unique_triple (col_a, col_b, col_c, col_d, col_e, col_f)
         VALUES ('a1', 'b1', 'c1', 'd1', 'e1', 'f1') RETURNING id`
      );
      await client.end();
      expect(result.rows[0].id).toBeDefined();
    });

    it('should reject duplicate (a,b,c) combination', async () => {
      const client = createClient();
      await client.connect();
      await expect(
        client.query(
          `INSERT INTO unique_triple (col_a, col_b, col_c, col_d, col_e, col_f)
           VALUES ('a1', 'b1', 'c1', 'd2', 'e2', 'f2')`
        )
      ).rejects.toThrow(/unique.*abc/i);
      await client.end();
    });

    it('should allow same col_a with different (b,c)', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `INSERT INTO unique_triple (col_a, col_b, col_c, col_d, col_e, col_f)
         VALUES ('a1', 'b2', 'c1', 'd1', 'e1', 'f1') RETURNING id`
      );
      await client.end();
      expect(result.rows[0].id).toBeDefined();
    });
  });

  describe('Scenario 3: unique_dual_triple - UNIQUE(a,b,c) + UNIQUE(d,e,f)', () => {
    it('should allow insert with unique (a,b,c) and (d,e,f)', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `INSERT INTO unique_dual_triple (col_a, col_b, col_c, col_d, col_e, col_f)
         VALUES ('a1', 'b1', 'c1', 'd1', 'e1', 'f1') RETURNING id`
      );
      await client.end();
      expect(result.rows[0].id).toBeDefined();
    });

    it('should reject duplicate (a,b,c) even with different (d,e,f)', async () => {
      const client = createClient();
      await client.connect();
      await expect(
        client.query(
          `INSERT INTO unique_dual_triple (col_a, col_b, col_c, col_d, col_e, col_f)
           VALUES ('a1', 'b1', 'c1', 'd2', 'e2', 'f2')`
        )
      ).rejects.toThrow(/unique.*abc/i);
      await client.end();
    });

    it('should reject duplicate (d,e,f) even with different (a,b,c)', async () => {
      const client = createClient();
      await client.connect();
      await expect(
        client.query(
          `INSERT INTO unique_dual_triple (col_a, col_b, col_c, col_d, col_e, col_f)
           VALUES ('a2', 'b2', 'c2', 'd1', 'e1', 'f1')`
        )
      ).rejects.toThrow(/unique.*def/i);
      await client.end();
    });

    it('should allow different (a,b,c) and different (d,e,f)', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `INSERT INTO unique_dual_triple (col_a, col_b, col_c, col_d, col_e, col_f)
         VALUES ('a2', 'b2', 'c2', 'd2', 'e2', 'f2') RETURNING id`
      );
      await client.end();
      expect(result.rows[0].id).toBeDefined();
    });
  });
});
