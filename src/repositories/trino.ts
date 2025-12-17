import format from 'pg-format';
import { trinoQuery, trinoHealth, TrinoBatchWriter } from '../clients/trino.js';

export interface Person {
  id: number;
  name: string;
}

export interface TableStats {
  count: number;
  sizeBytes: number;
  size: string;
  fileCount: number;
}

export interface OptimizeResult {
  optimized: boolean;
  filesBefore: number;
  filesAfter: number;
  filesRemoved: number;
}

// Batch writer for people table - flushes every 500ms
const peopleBatcher = new TrinoBatchWriter<Person>((rows) => {
  const values = rows.map((r) => format('(%s, %L)', r.id, r.name)).join(', ');
  return `INSERT INTO people VALUES ${values}`;
}, 500);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export async function trinoHealthCheck(): Promise<boolean> {
  return trinoHealth();
}

export async function trinoGetStats(): Promise<{ people: TableStats }> {
  const countRows = await trinoQuery('SELECT COUNT(*) FROM people');
  const count = Number(countRows[0]?.[0] ?? 0);

  let sizeBytes = 0;
  let fileCount = 0;
  try {
    const filesRows = await trinoQuery(`
      SELECT SUM(file_size_in_bytes), COUNT(*)
      FROM iceberg.warehouse."people$files"
    `);
    sizeBytes = Number(filesRows[0]?.[0] ?? 0);
    fileCount = Number(filesRows[0]?.[1] ?? 0);
  } catch {
    // Table might not have files metadata yet
  }

  return {
    people: {
      count,
      sizeBytes,
      size: formatSize(sizeBytes),
      fileCount,
    },
  };
}

export async function trinoCreatePerson(name: string): Promise<Person> {
  const id = Date.now();
  const sql = format('INSERT INTO people VALUES (%s, %L)', id, name);
  await trinoQuery(sql);
  return { id, name };
}

export async function trinoCreatePersonBatched(name: string): Promise<Person> {
  const id = Date.now();
  await peopleBatcher.write({ id, name });
  return { id, name };
}

export async function trinoListPeople(): Promise<Person[]> {
  const rows = await trinoQuery('SELECT id, name FROM people');
  return rows.map(([id, name]) => ({ id: id as number, name: name as string }));
}

export async function trinoOptimize(): Promise<OptimizeResult> {
  let filesBefore = 0;
  try {
    const before = await trinoQuery(
      'SELECT COUNT(*) FROM iceberg.warehouse."people$files"'
    );
    filesBefore = Number(before[0]?.[0] ?? 0);
  } catch {
    // ignore
  }

  await trinoQuery('ALTER TABLE people EXECUTE optimize');

  let filesAfter = 0;
  try {
    const after = await trinoQuery(
      'SELECT COUNT(*) FROM iceberg.warehouse."people$files"'
    );
    filesAfter = Number(after[0]?.[0] ?? 0);
  } catch {
    // ignore
  }

  return {
    optimized: true,
    filesBefore,
    filesAfter,
    filesRemoved: filesBefore - filesAfter,
  };
}

export async function trinoFlushBatchers(): Promise<void> {
  await peopleBatcher.flushNow();
}
