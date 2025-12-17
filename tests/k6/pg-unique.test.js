import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics
const insertSuccess = new Counter('insert_success');
const duplicateRejected = new Counter('duplicate_rejected');
const insertLatency = new Trend('insert_latency');

const BASE = 'http://localhost:3000';

// Default function (used when running with --vus/--duration flags)
export default function () {
  insertUniqueSingle();
}

// Pre-generate some values for duplicate testing
const duplicateValues = new SharedArray('duplicates', function () {
  return Array.from({ length: 100 }, (_, i) => ({
    col_a: `dup-a-${i}`,
    col_b: `dup-b-${i}`,
    col_c: `dup-c-${i}`,
    col_d: `dup-d-${i}`,
    col_e: `dup-e-${i}`,
    col_f: `dup-f-${i}`,
  }));
});

export const options = {
  scenarios: {
    // Scenario 1: Insert unique rows into single-column unique table
    unique_single_inserts: {
      executor: 'constant-vus',
      vus: 10,
      duration: '20s',
      exec: 'insertUniqueSingle',
      tags: { scenario: 'unique_single' },
    },
    // Scenario 2: Insert unique rows into triple-column unique table
    unique_triple_inserts: {
      executor: 'constant-vus',
      vus: 10,
      duration: '20s',
      exec: 'insertUniqueTriple',
      startTime: '5s',
      tags: { scenario: 'unique_triple' },
    },
    // Scenario 3: Insert unique rows into dual-triple unique table
    unique_dual_triple_inserts: {
      executor: 'constant-vus',
      vus: 10,
      duration: '20s',
      exec: 'insertUniqueDualTriple',
      startTime: '10s',
      tags: { scenario: 'unique_dual_triple' },
    },
    // Scenario 4: Stress test with duplicates (expect rejections)
    duplicate_stress: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '10s', target: 20 },
        { duration: '10s', target: 20 },
        { duration: '5s', target: 0 },
      ],
      exec: 'insertDuplicates',
      startTime: '15s',
      tags: { scenario: 'duplicate_stress' },
    },
  },
  thresholds: {
    'insert_latency{scenario:unique_single}': ['p(95)<500'],
    'insert_latency{scenario:unique_triple}': ['p(95)<500'],
    'insert_latency{scenario:unique_dual_triple}': ['p(95)<500'],
  },
};

// Generate unique row data
function generateRow(prefix) {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1000000);
  return {
    col_a: `${prefix}-a-${ts}-${rand}`,
    col_b: `${prefix}-b-${ts}-${rand}`,
    col_c: `${prefix}-c-${ts}-${rand}`,
    col_d: `${prefix}-d-${ts}-${rand}`,
    col_e: `${prefix}-e-${ts}-${rand}`,
    col_f: `${prefix}-f-${ts}-${rand}`,
  };
}

export function insertUniqueSingle() {
  const row = generateRow('single');
  const start = Date.now();

  const res = http.post(`${BASE}/pg/unique/single`, JSON.stringify(row), {
    headers: { 'Content-Type': 'application/json' },
  });

  insertLatency.add(Date.now() - start);

  const success = check(res, {
    'single insert 201': (r) => r.status === 201,
    'has id': (r) => r.json('id') !== undefined,
  });

  if (success) insertSuccess.add(1);
}

export function insertUniqueTriple() {
  const row = generateRow('triple');
  const start = Date.now();

  const res = http.post(`${BASE}/pg/unique/triple`, JSON.stringify(row), {
    headers: { 'Content-Type': 'application/json' },
  });

  insertLatency.add(Date.now() - start);

  const success = check(res, {
    'triple insert 201': (r) => r.status === 201,
    'has id': (r) => r.json('id') !== undefined,
  });

  if (success) insertSuccess.add(1);
}

export function insertUniqueDualTriple() {
  const row = generateRow('dual');
  const start = Date.now();

  const res = http.post(`${BASE}/pg/unique/dual-triple`, JSON.stringify(row), {
    headers: { 'Content-Type': 'application/json' },
  });

  insertLatency.add(Date.now() - start);

  const success = check(res, {
    'dual-triple insert 201': (r) => r.status === 201,
    'has id': (r) => r.json('id') !== undefined,
  });

  if (success) insertSuccess.add(1);
}

export function insertDuplicates() {
  // Pick a random pre-defined duplicate value
  const idx = Math.floor(Math.random() * duplicateValues.length);
  const row = duplicateValues[idx];

  const res = http.post(`${BASE}/pg/unique/single`, JSON.stringify(row), {
    headers: { 'Content-Type': 'application/json' },
  });

  // First insert should succeed, subsequent should fail with 500
  if (res.status === 201) {
    insertSuccess.add(1);
    check(res, { 'first duplicate insert 201': (r) => r.status === 201 });
  } else if (res.status === 500) {
    duplicateRejected.add(1);
    check(res, { 'duplicate rejected': (r) => r.status === 500 });
  }

  sleep(0.1);
}

export function setup() {
  // Clean up tables before test
  http.del(`${BASE}/pg/unique/unique_single`);
  http.del(`${BASE}/pg/unique/unique_triple`);
  http.del(`${BASE}/pg/unique/unique_dual_triple`);
  console.log('Tables truncated');
}

export function handleSummary(data) {
  const successTotal = data.metrics.insert_success?.values?.count || 0;
  const duplicatesRejected = data.metrics.duplicate_rejected?.values?.count || 0;

  return {
    stdout: `
=====================================
       UNIQUE CONSTRAINT TEST SUMMARY
=====================================
Successful inserts: ${successTotal}
Duplicates rejected: ${duplicatesRejected}
-------------------------------------
`,
  };
}
