import { db, UniqueTestRow } from '../clients/postgres.js';

type InsertRow = Omit<UniqueTestRow, 'id'>;

// Scenario 1: unique_single - UNIQUE(col_a)
export async function createUniqueSingle(row: InsertRow) {
  return db
    .insertInto('unique_single')
    .values(row)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function listUniqueSingle() {
  return db.selectFrom('unique_single').selectAll().execute();
}

export async function countUniqueSingle() {
  const result = await db
    .selectFrom('unique_single')
    .select(db.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return result.count;
}

export async function truncateUniqueSingle() {
  await db.deleteFrom('unique_single').execute();
}

// Scenario 2: unique_triple - UNIQUE(col_a, col_b, col_c)
export async function createUniqueTriple(row: InsertRow) {
  return db
    .insertInto('unique_triple')
    .values(row)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function listUniqueTriple() {
  return db.selectFrom('unique_triple').selectAll().execute();
}

export async function countUniqueTriple() {
  const result = await db
    .selectFrom('unique_triple')
    .select(db.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return result.count;
}

export async function truncateUniqueTriple() {
  await db.deleteFrom('unique_triple').execute();
}

// Scenario 3: unique_dual_triple - UNIQUE(col_a,b,c) + UNIQUE(col_d,e,f)
export async function createUniqueDualTriple(row: InsertRow) {
  return db
    .insertInto('unique_dual_triple')
    .values(row)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function listUniqueDualTriple() {
  return db.selectFrom('unique_dual_triple').selectAll().execute();
}

export async function countUniqueDualTriple() {
  const result = await db
    .selectFrom('unique_dual_triple')
    .select(db.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return result.count;
}

export async function truncateUniqueDualTriple() {
  await db.deleteFrom('unique_dual_triple').execute();
}
