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

describe('PostgreSQL Balance Changes E2E Tests', () => {
  beforeAll(async () => {
    const client = createClient();
    await client.connect();
    // TRUNCATE bypasses row-level triggers
    await client.query('TRUNCATE balance_changes RESTART IDENTITY');
    await client.end();
  });

  describe('Basic balance operations', () => {
    it('should allow accrual (positive amount)', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (1, 100, 200, 1000) RETURNING id`
      );
      await client.end();
      expect(result.rows[0].id).toBeDefined();
    });

    it('should calculate correct balance for profile', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `SELECT SUM(amount) as balance FROM balance_changes WHERE profile_id = 1`
      );
      await client.end();
      expect(Number(result.rows[0].balance)).toBe(1000);
    });

    it('should allow withdrawal when balance is sufficient', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (1, 100, 201, -500) RETURNING id`
      );
      await client.end();
      expect(result.rows[0].id).toBeDefined();
    });

    it('should have correct balance after withdrawal', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `SELECT SUM(amount) as balance FROM balance_changes WHERE profile_id = 1`
      );
      await client.end();
      expect(Number(result.rows[0].balance)).toBe(500);
    });
  });

  describe('Trigger: prevent negative balance', () => {
    it('should reject withdrawal that would make balance negative', async () => {
      const client = createClient();
      await client.connect();
      await expect(
        client.query(
          `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
           VALUES (1, 100, 202, -600)`
        )
      ).rejects.toThrow(/balance cannot be negative/i);
      await client.end();
    });

    it('should allow exact withdrawal to zero balance', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (1, 100, 203, -500) RETURNING id`
      );
      await client.end();
      expect(result.rows[0].id).toBeDefined();
    });

    it('should have zero balance after exact withdrawal', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `SELECT SUM(amount) as balance FROM balance_changes WHERE profile_id = 1`
      );
      await client.end();
      expect(Number(result.rows[0].balance)).toBe(0);
    });

    it('should reject first withdrawal on empty profile', async () => {
      const client = createClient();
      await client.connect();
      await expect(
        client.query(
          `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
           VALUES (999, 100, 300, -100)`
        )
      ).rejects.toThrow(/balance cannot be negative/i);
      await client.end();
    });
  });

  describe('Balance by accrual document', () => {
    beforeAll(async () => {
      const client = createClient();
      await client.connect();
      // Add some changes for accrual doc 500
      await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (10, 500, 600, 2000)`
      );
      await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (11, 500, 601, 3000)`
      );
      await client.end();
    });

    it('should calculate balance grouped by accrual_doc_id', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `SELECT SUM(amount) as balance FROM balance_changes WHERE accrual_doc_id = 500`
      );
      await client.end();
      expect(Number(result.rows[0].balance)).toBe(5000);
    });
  });

  describe('Multiple profiles isolation', () => {
    beforeAll(async () => {
      const client = createClient();
      await client.connect();
      // Profile 20 gets 1000
      await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (20, 700, 800, 1000)`
      );
      // Profile 21 gets 2000
      await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (21, 701, 801, 2000)`
      );
      await client.end();
    });

    it('should track balances separately per profile', async () => {
      const client = createClient();
      await client.connect();

      const result20 = await client.query(
        `SELECT SUM(amount) as balance FROM balance_changes WHERE profile_id = 20`
      );
      const result21 = await client.query(
        `SELECT SUM(amount) as balance FROM balance_changes WHERE profile_id = 21`
      );

      await client.end();

      expect(Number(result20.rows[0].balance)).toBe(1000);
      expect(Number(result21.rows[0].balance)).toBe(2000);
    });

    it('should allow withdrawal from one profile while other has no balance', async () => {
      const client = createClient();
      await client.connect();
      // Withdraw 500 from profile 20
      const result = await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (20, 700, 802, -500) RETURNING id`
      );
      await client.end();
      expect(result.rows[0].id).toBeDefined();
    });
  });

  describe('Trigger: UPDATE operations', () => {
    let accrualId: number;

    beforeAll(async () => {
      const client = createClient();
      await client.connect();
      // Profile 30 gets initial accrual of 1000
      const result = await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (30, 900, 1000, 1000) RETURNING id`
      );
      accrualId = result.rows[0].id;
      await client.end();
    });

    it('should allow UPDATE that keeps balance positive', async () => {
      const client = createClient();
      await client.connect();
      // Change accrual from 1000 to 800 - balance stays positive
      const result = await client.query(
        `UPDATE balance_changes SET amount = 800 WHERE id = $1 RETURNING id`,
        [accrualId]
      );
      await client.end();
      expect(result.rowCount).toBe(1);
    });

    it('should have correct balance after UPDATE', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `SELECT SUM(amount) as balance FROM balance_changes WHERE profile_id = 30`
      );
      await client.end();
      expect(Number(result.rows[0].balance)).toBe(800);
    });

    it('should reject UPDATE that would make balance negative', async () => {
      const client = createClient();
      await client.connect();
      // Try to change accrual from 800 to -100 - balance would become -100
      await expect(
        client.query(`UPDATE balance_changes SET amount = -100 WHERE id = $1`, [
          accrualId,
        ])
      ).rejects.toThrow(/balance cannot be negative/i);
      await client.end();
    });

    it('should allow UPDATE when combined with other records', async () => {
      const client = createClient();
      await client.connect();
      // Add another 500 accrual for profile 30 (total becomes 1300)
      await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (30, 901, 1001, 500)`
      );
      // Now update original to -200 (800 + 500 - 800 + (-200) = 300, still positive)
      const result = await client.query(
        `UPDATE balance_changes SET amount = -200 WHERE id = $1 RETURNING id`,
        [accrualId]
      );
      await client.end();
      expect(result.rowCount).toBe(1);
    });

    it('should have correct balance after multiple operations', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `SELECT SUM(amount) as balance FROM balance_changes WHERE profile_id = 30`
      );
      await client.end();
      expect(Number(result.rows[0].balance)).toBe(300); // -200 + 500 = 300
    });
  });

  describe('Trigger: DELETE operations', () => {
    let accrualId: number;

    beforeAll(async () => {
      const client = createClient();
      await client.connect();
      // Profile 40 gets initial accrual of 1000
      const result = await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (40, 1100, 1200, 1000) RETURNING id`
      );
      accrualId = result.rows[0].id;
      await client.end();
    });

    it('should reject DELETE of accrual that would make balance negative', async () => {
      const client = createClient();
      await client.connect();
      // First add a withdrawal
      await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (40, 1100, 1201, -800)`
      );
      // Balance is now 200
      // Try to delete the +1000 accrual - would make balance -800
      await expect(
        client.query(`DELETE FROM balance_changes WHERE id = $1`, [accrualId])
      ).rejects.toThrow(/balance cannot be negative/i);
      await client.end();
    });

    it('should allow DELETE of withdrawal when balance is sufficient', async () => {
      const client = createClient();
      await client.connect();
      // Insert a new accrual
      await client.query(
        `INSERT INTO balance_changes (profile_id, accrual_doc_id, registrar_doc_id, amount)
         VALUES (40, 1100, 1202, 300)`
      );
      // Balance is now 500 (1000 - 800 + 300)
      // Get the withdrawal record id
      const withdrawalResult = await client.query(
        `SELECT id FROM balance_changes WHERE profile_id = 40 AND amount = -800`
      );
      const withdrawalId = withdrawalResult.rows[0].id;
      // Delete the withdrawal - balance becomes 1300
      const result = await client.query(
        `DELETE FROM balance_changes WHERE id = $1 RETURNING id`,
        [withdrawalId]
      );
      await client.end();
      expect(result.rowCount).toBe(1);
    });

    it('should have correct balance after DELETE', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `SELECT SUM(amount) as balance FROM balance_changes WHERE profile_id = 40`
      );
      await client.end();
      expect(Number(result.rows[0].balance)).toBe(1300); // 1000 + 300
    });

    it('should allow DELETE of accrual when balance remains positive', async () => {
      const client = createClient();
      await client.connect();
      // Get the 300 accrual
      const accrualResult = await client.query(
        `SELECT id FROM balance_changes WHERE profile_id = 40 AND amount = 300`
      );
      const smallAccrualId = accrualResult.rows[0].id;
      // Delete it - balance becomes 1000
      const result = await client.query(
        `DELETE FROM balance_changes WHERE id = $1 RETURNING id`,
        [smallAccrualId]
      );
      await client.end();
      expect(result.rowCount).toBe(1);
    });

    it('should have correct final balance', async () => {
      const client = createClient();
      await client.connect();
      const result = await client.query(
        `SELECT SUM(amount) as balance FROM balance_changes WHERE profile_id = 40`
      );
      await client.end();
      expect(Number(result.rows[0].balance)).toBe(1000);
    });
  });
});
