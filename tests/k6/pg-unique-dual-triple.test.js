import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const insertSuccess = new Counter('insert_success');
const insertLatency = new Trend('insert_latency');

const BASE = 'http://localhost:3000';

export const options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // Less than 1% failures
    insert_latency: ['p(95)<100'],
  },
};

// Generate unique row data
function generateRow() {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1000000);
  const vu = __VU;
  const iter = __ITER;
  return {
    col_a: `dual-a-${vu}-${iter}-${ts}-${rand}`,
    col_b: `dual-b-${vu}-${iter}-${ts}-${rand}`,
    col_c: `dual-c-${vu}-${iter}-${ts}-${rand}`,
    col_d: `dual-d-${vu}-${iter}-${ts}-${rand}`,
    col_e: `dual-e-${vu}-${iter}-${ts}-${rand}`,
    col_f: `dual-f-${vu}-${iter}-${ts}-${rand}`,
  };
}

export default function () {
  const row = generateRow();
  const start = Date.now();

  const res = http.post(`${BASE}/pg/unique/dual-triple`, JSON.stringify(row), {
    headers: { 'Content-Type': 'application/json' },
  });

  insertLatency.add(Date.now() - start);

  const success = check(res, {
    'insert 201': (r) => r.status === 201,
    'has id': (r) => r.json('id') !== undefined,
  });

  if (success) insertSuccess.add(1);
}

export function setup() {
  // Clean up table before test
  http.del(`${BASE}/pg/unique/unique_dual_triple`);
  console.log('Table truncated');
}

export function handleSummary(data) {
  const successTotal = data.metrics.insert_success?.values?.count || 0;
  const p50 = data.metrics.insert_latency?.values?.['p(50)'] || 0;
  const p95 = data.metrics.insert_latency?.values?.['p(95)'] || 0;
  const p99 = data.metrics.insert_latency?.values?.['p(99)'] || 0;

  return {
    stdout: `
=====================================
  DUAL-TRIPLE UNIQUE INSERT SUMMARY
=====================================
Successful inserts: ${successTotal}
-------------------------------------
Latency p50: ${p50.toFixed(1)}ms
Latency p95: ${p95.toFixed(1)}ms
Latency p99: ${p99.toFixed(1)}ms
=====================================
`,
  };
}
