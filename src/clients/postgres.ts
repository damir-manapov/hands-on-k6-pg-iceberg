import { Kysely, PostgresDialect, Generated } from 'kysely';
import pg from 'pg';

export type Person = {
  id: Generated<number>;
  name: string;
};

export interface Database {
  people: Person;
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
  await db.schema
    .createTable('people')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .execute();
}
