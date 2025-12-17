#!/usr/bin/env npx tsx

(async () => {
  const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

  interface OptimizeResult {
    optimized: boolean;
    filesBefore: number;
    filesAfter: number;
    filesRemoved: number;
  }

  console.log('🔄 Optimizing Trino/Iceberg tables...\n');

  try {
    const res = await fetch(`${BASE_URL}/trino/optimize`, { method: 'POST' });

    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ Failed to optimize: ${res.status} ${text}`);
      process.exit(1);
    }

    const result = (await res.json()) as OptimizeResult;

    console.log('✅ Optimization complete');
    console.log(`   Files before: ${result.filesBefore}`);
    console.log(`   Files after:  ${result.filesAfter}`);
    console.log(`   Files merged: ${result.filesRemoved}`);
  } catch (err) {
    console.error('❌ Failed to optimize (is server running?)');
    console.error(err);
    process.exit(1);
  }
})();
