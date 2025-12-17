import { db, BalanceChange } from '../clients/postgres.js';
import { sql } from 'kysely';

type InsertBalanceChange = Omit<BalanceChange, 'id'>;

// Create a balance change (accrual or withdrawal)
export async function createBalanceChange(change: InsertBalanceChange) {
  return db
    .insertInto('balance_changes')
    .values(change)
    .returningAll()
    .executeTakeFirstOrThrow();
}

// Get total balance for a profile
export async function getBalanceByProfileId(profileId: number): Promise<number> {
  const result = await db
    .selectFrom('balance_changes')
    .select(sql<number>`COALESCE(SUM(amount), 0)`.as('balance'))
    .where('profile_id', '=', profileId)
    .executeTakeFirstOrThrow();
  return Number(result.balance);
}

// Get total balance for an accrual document
export async function getBalanceByAccrualDocId(accrualDocId: number): Promise<number> {
  const result = await db
    .selectFrom('balance_changes')
    .select(sql<number>`COALESCE(SUM(amount), 0)`.as('balance'))
    .where('accrual_doc_id', '=', accrualDocId)
    .executeTakeFirstOrThrow();
  return Number(result.balance);
}

// List all changes for a profile
export async function listChangesByProfileId(profileId: number) {
  return db
    .selectFrom('balance_changes')
    .selectAll()
    .where('profile_id', '=', profileId)
    .orderBy('id', 'asc')
    .execute();
}

// List all changes for an accrual document
export async function listChangesByAccrualDocId(accrualDocId: number) {
  return db
    .selectFrom('balance_changes')
    .selectAll()
    .where('accrual_doc_id', '=', accrualDocId)
    .orderBy('id', 'asc')
    .execute();
}

// Get count of all balance changes
export async function countBalanceChanges(): Promise<number> {
  const result = await db
    .selectFrom('balance_changes')
    .select(db.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return Number(result.count);
}

// Truncate all balance changes
export async function truncateBalanceChanges() {
  await db.deleteFrom('balance_changes').execute();
}
