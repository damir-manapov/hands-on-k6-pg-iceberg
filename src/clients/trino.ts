import { Trino, BasicAuth } from 'trino-client';

const {
  TRINO_HOST = 'localhost',
  TRINO_PORT = '8080',
  TRINO_USER = 'trino',
  TRINO_CATALOG = 'iceberg',
  TRINO_SCHEMA = 'warehouse',
} = process.env;

const trino = Trino.create({
  server: `http://${TRINO_HOST}:${TRINO_PORT}`,
  catalog: TRINO_CATALOG,
  schema: TRINO_SCHEMA,
  auth: new BasicAuth(TRINO_USER),
});

export async function trinoQuery(sql: string): Promise<unknown[][]> {
  const iter = await trino.query(sql);
  const allData: unknown[][] = [];

  for await (const result of iter) {
    if (result.data) {
      allData.push(...result.data);
    }
  }

  return allData;
}

export async function trinoHealth(): Promise<boolean> {
  try {
    const res = await fetch(`http://${TRINO_HOST}:${TRINO_PORT}/v1/info`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureTrinoSchema() {
  try {
    // Create schema if not exists
    await trinoQuery(
      `CREATE SCHEMA IF NOT EXISTS ${TRINO_CATALOG}.${TRINO_SCHEMA} WITH (location = 's3://warehouse/')`
    );
  } catch (e) {
    console.warn(
      'Trino schema creation skipped (may already exist):',
      String(e)
    );
  }

  try {
    // Create people table if not exists
    await trinoQuery(`
      CREATE TABLE IF NOT EXISTS ${TRINO_CATALOG}.${TRINO_SCHEMA}.people (
        id BIGINT,
        name VARCHAR
      ) WITH (format = 'PARQUET')
    `);
  } catch (e) {
    console.warn(
      'Trino table creation skipped (may already exist):',
      String(e)
    );
  }
}

/**
 * Microbatch writer for Trino. Buffers rows and flushes after `flushIntervalMs`.
 * Each write() returns a promise that resolves when the batch containing that row is written.
 */
export class TrinoBatchWriter<T> {
  private buffer: T[] = [];
  private pending: Array<{
    resolve: () => void;
    reject: (_err: Error) => void;
  }> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private buildSql: (_rows: T[]) => string;
  private flushIntervalMs: number;

  constructor(buildSql: (_rows: T[]) => string, flushIntervalMs: number = 500) {
    this.buildSql = buildSql;
    this.flushIntervalMs = flushIntervalMs;
  }

  write(row: T): Promise<void> {
    return new Promise((resolve, reject) => {
      this.buffer.push(row);
      this.pending.push({ resolve, reject });

      if (!this.timer && !this.flushing) {
        this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      this.timer = null;
      return;
    }

    this.flushing = true;
    this.timer = null;

    const rows = this.buffer;
    const callbacks = this.pending;
    this.buffer = [];
    this.pending = [];

    try {
      const sql = this.buildSql(rows);
      console.log(`[TrinoBatch] Flushing ${rows.length} rows`);
      await trinoQuery(sql);
      callbacks.forEach((cb) => cb.resolve());
    } catch (e) {
      console.error(`[TrinoBatch] Flush failed for ${rows.length} rows:`, e);
      callbacks.forEach((cb) => cb.reject(e as Error));
    } finally {
      this.flushing = false;
      // If new rows arrived during flush, schedule next flush
      if (this.buffer.length > 0 && !this.timer) {
        this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
      }
    }
  }

  /** Force flush any pending writes (useful for graceful shutdown) */
  async flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  get pendingCount(): number {
    return this.buffer.length;
  }
}
