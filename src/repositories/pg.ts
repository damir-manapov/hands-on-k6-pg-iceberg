import { db, pool } from '../clients/postgres.js';

export interface Person {
  id: number;
  name: string;
}

export interface TableStats {
  count: number;
  sizeBytes: number;
  size: string;
}

export async function pgHealthCheck(): Promise<boolean> {
  await pool.query('SELECT 1');
  return true;
}

export async function pgGetStats(): Promise<{ people: TableStats }> {
  const countResult = await pool.query('SELECT COUNT(*) as count FROM people');
  const sizeResult = await pool.query(`
    SELECT pg_total_relation_size('people') as size_bytes,
           pg_size_pretty(pg_total_relation_size('people')) as size_pretty
  `);

  return {
    people: {
      count: Number(countResult.rows[0].count),
      sizeBytes: Number(sizeResult.rows[0].size_bytes),
      size: sizeResult.rows[0].size_pretty,
    },
  };
}

export async function pgCreatePerson(name: string): Promise<Person> {
  const inserted = await db
    .insertInto('people')
    .values({ name })
    .returningAll()
    .executeTakeFirst();
  return inserted as Person;
}

export async function pgListPeople(): Promise<Person[]> {
  return db.selectFrom('people').selectAll().execute();
}
