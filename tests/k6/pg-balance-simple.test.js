import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const accrualSuccess = new Counter('accrual_success');
const withdrawalSuccess = new Counter('withdrawal_success');
const operationLatency = new Trend('operation_latency');

const BASE = 'http://localhost:3000';

export const options = {
  vus: 100,
  duration: '300s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // Less than 1% failures
    operation_latency: ['p(95)<100'],
  },
};

// Get random profile from a small pool (ensures balance accumulates)
function getProfileId() {
  return Math.floor(Math.random() * 100) + 1;
}

export default function () {
  const profileId = getProfileId();

  // 80% accruals, 20% small withdrawals (unlikely to overdraft)
  const isAccrual = Math.random() < 0.8;
  const amount = isAccrual
    ? Math.floor(Math.random() * 500) + 100 // +100 to +600
    : -Math.floor(Math.random() * 20) - 5; // -5 to -25 (small)

  const start = Date.now();
  const res = http.post(
    `${BASE}/pg/balance`,
    JSON.stringify({
      profile_id: profileId,
      accrual_doc_id: Math.floor(Math.random() * 1000000),
      registrar_doc_id: Math.floor(Math.random() * 1000000),
      amount: amount,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  operationLatency.add(Date.now() - start);

  if (res.status === 201) {
    if (isAccrual) {
      accrualSuccess.add(1);
      check(res, { 'accrual created': (r) => r.status === 201 });
    } else {
      withdrawalSuccess.add(1);
      check(res, { 'withdrawal created': (r) => r.status === 201 });
    }
  }

  // sleep(0.05);
}

export function setup() {
  // Seed profiles with initial balance
  for (let i = 1; i <= 100; i++) {
    http.post(
      `${BASE}/pg/balance`,
      JSON.stringify({
        profile_id: i,
        accrual_doc_id: 1,
        registrar_doc_id: 1,
        amount: 10000,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
  console.log('Seeded 100 profiles with initial balance of 10000 each');
}

export function handleSummary(data) {
  const accruals = data.metrics.accrual_success?.values?.count || 0;
  const withdrawals = data.metrics.withdrawal_success?.values?.count || 0;
  const total = accruals + withdrawals;
  const p50 = data.metrics.operation_latency?.values?.['p(50)'] || 0;
  const p95 = data.metrics.operation_latency?.values?.['p(95)'] || 0;

  // Calculate throughput from http_reqs metric
  const httpReqs = data.metrics.http_reqs?.values?.rate || 0;
  const iterRate = data.metrics.iterations?.values?.rate || 0;

  return {
    stdout: `
=====================================
    BALANCE SIMPLE TEST SUMMARY
=====================================
Accruals:    ${accruals}
Withdrawals: ${withdrawals}
Total:       ${total}
-------------------------------------
Throughput:  ${iterRate.toFixed(1)} ops/s
HTTP Reqs:   ${httpReqs.toFixed(1)} req/s
-------------------------------------
Latency p50: ${p50.toFixed(1)}ms
Latency p95: ${p95.toFixed(1)}ms
=====================================
`,
  };
}
