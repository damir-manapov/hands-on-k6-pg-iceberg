#!/usr/bin/env npx tsx

(async () => {
  const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

  interface PgStats {
    tables: {
      people: {
        count: number;
        sizeBytes: number;
        size: string;
      };
    };
  }

  interface TrinoStats {
    tables: {
      people: {
        count: number;
        sizeBytes: number;
        size: string;
        fileCount: number;
      };
    };
  }

  async function fetchJson<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  console.log('=== Database Stats ===\n');

  console.log('📊 Postgres:');
  const pgStats = await fetchJson<PgStats>(`${BASE_URL}/pg/stats`);
  if (pgStats) {
    const { count, size } = pgStats.tables.people;
    console.log(`   people: ${count} rows, ${size}`);
  } else {
    console.log('   ❌ Failed to fetch stats (is server running?)');
  }

  console.log('\n📊 Trino/Iceberg:');
  const trinoStats = await fetchJson<TrinoStats>(`${BASE_URL}/trino/stats`);
  if (trinoStats) {
    const { count, size, fileCount } = trinoStats.tables.people;
    console.log(`   people: ${count} rows, ${size}, ${fileCount} files`);
  } else {
    console.log('   ❌ Failed to fetch stats (is server running?)');
  }

  console.log('');
})();
