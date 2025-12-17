import { Kysely, PostgresDialect, Generated } from 'kysely';
import pg from 'pg';

export type Person = {
  id: Generated<number>;
  name: string;
};

// Tables for testing different uniqueness constraints
// All tables have the same columns: id, col_a through col_f
export type UniqueTestRow = {
  id: Generated<number>;
  col_a: string;
  col_b: string;
  col_c: string;
  col_d: string;
  col_e: string;
  col_f: string;
};

// Balance changes table - emulates accrual/withdrawal operations
export type BalanceChange = {
  id: Generated<number>;
  profile_id: number;
  accrual_doc_id: number;
  registrar_doc_id: number;
  amount: number; // positive for accruals, negative for withdrawals
};

export interface Database {
  people: Person;
  // Scenario 1: unique on single column (col_a)
  unique_single: UniqueTestRow;
  // Scenario 2: unique on three columns (col_a, col_b, col_c)
  unique_triple: UniqueTestRow;
  // Scenario 3: unique on two sets of three columns each
  unique_dual_triple: UniqueTestRow;
  // Balance changes with trigger to prevent negative balance
  balance_changes: BalanceChange;
}

const {
  PG_HOST = 'localhost',
  PG_PORT = '5432',
  PG_DATABASE = 'appdb',
  PG_USER = 'postgres',
  PG_PASSWORD = 'postgres',
} = process.env;

export const pool = new pg.Pool({
  host: PG_HOST,
  port: Number(PG_PORT),
  database: PG_DATABASE,
  user: PG_USER,
  password: PG_PASSWORD,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

export async function ensureSchema() {
  // Original people table
  await db.schema
    .createTable('people')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .execute();

  // Scenario 1: UNIQUE on single column (col_a)
  await db.schema
    .createTable('unique_single')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('col_a', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_b', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_c', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_d', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_e', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_f', 'varchar(255)', (col) => col.notNull())
    .addUniqueConstraint('unique_single_col_a', ['col_a'])
    .execute();

  // Scenario 2: UNIQUE on three columns (col_a, col_b, col_c)
  await db.schema
    .createTable('unique_triple')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('col_a', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_b', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_c', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_d', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_e', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_f', 'varchar(255)', (col) => col.notNull())
    .addUniqueConstraint('unique_triple_abc', ['col_a', 'col_b', 'col_c'])
    .execute();

  // Scenario 3: Two UNIQUE constraints on different column sets
  await db.schema
    .createTable('unique_dual_triple')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('col_a', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_b', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_c', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_d', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_e', 'varchar(255)', (col) => col.notNull())
    .addColumn('col_f', 'varchar(255)', (col) => col.notNull())
    .addUniqueConstraint('unique_dual_abc', ['col_a', 'col_b', 'col_c'])
    .addUniqueConstraint('unique_dual_def', ['col_d', 'col_e', 'col_f'])
    .execute();

  // Balance changes table
  await db.schema
    .createTable('balance_changes')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('profile_id', 'integer', (col) => col.notNull())
    .addColumn('accrual_doc_id', 'integer', (col) => col.notNull())
    .addColumn('registrar_doc_id', 'integer', (col) => col.notNull())
    .addColumn('amount', 'integer', (col) => col.notNull())
    .execute();

  // Create trigger function to prevent negative balance per profile
  await pool.query(`
    CREATE OR REPLACE FUNCTION check_balance_not_negative()
    RETURNS TRIGGER AS $$
    DECLARE
      new_balance INTEGER;
      check_profile_id INTEGER;
    BEGIN
      -- Determine which profile to check
      IF TG_OP = 'DELETE' THEN
        check_profile_id := OLD.profile_id;
      ELSE
        check_profile_id := NEW.profile_id;
      END IF;
      
      -- Calculate what the new balance would be
      SELECT COALESCE(SUM(amount), 0) INTO new_balance
      FROM balance_changes
      WHERE profile_id = check_profile_id;
      
      -- Adjust for the operation
      IF TG_OP = 'INSERT' THEN
        new_balance := new_balance + NEW.amount;
      ELSIF TG_OP = 'UPDATE' THEN
        new_balance := new_balance - OLD.amount + NEW.amount;
      ELSIF TG_OP = 'DELETE' THEN
        new_balance := new_balance - OLD.amount;
      END IF;
      
      IF new_balance < 0 THEN
        RAISE EXCEPTION 'Balance cannot be negative. Balance for profile % would be %', check_profile_id, new_balance;
      END IF;
      
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      ELSE
        RETURN NEW;
      END IF;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Drop and recreate trigger to ensure it covers INSERT, UPDATE, DELETE
  await pool.query(`
    DROP TRIGGER IF EXISTS trigger_check_balance ON balance_changes;
    CREATE TRIGGER trigger_check_balance
    BEFORE INSERT OR UPDATE OR DELETE ON balance_changes
    FOR EACH ROW
    EXECUTE FUNCTION check_balance_not_negative();
  `);
}
