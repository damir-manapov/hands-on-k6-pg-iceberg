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

export interface Database {
  people: Person;
  // Scenario 1: unique on single column (col_a)
  unique_single: UniqueTestRow;
  // Scenario 2: unique on three columns (col_a, col_b, col_c)
  unique_triple: UniqueTestRow;
  // Scenario 3: unique on two sets of three columns each
  unique_dual_triple: UniqueTestRow;
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
}
