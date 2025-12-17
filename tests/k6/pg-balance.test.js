import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics
const accrualSuccess = new Counter('accrual_success');
const withdrawalSuccess = new Counter('withdrawal_success');
const withdrawalRejected = new Counter('withdrawal_rejected');
const balanceCheckSuccess = new Counter('balance_check_success');
const triggerRejectionRate = new Rate('trigger_rejection_rate');
const operationLatency = new Trend('operation_latency');

const BASE = 'http://localhost:3000';

// Default function (used when running with --vus/--duration flags)
export default function () {
  mixedOperations();
}

// Pre-allocate profile IDs for testing
const profileIds = new SharedArray('profiles', function () {
  return Array.from({ length: 1000 }, (_, i) => i + 1);
});

export const options = {
  scenarios: {
    // Scenario 1: Warm up - create accruals for profiles
    warmup_accruals: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 20,
      exec: 'createAccrual',
      maxDuration: '30s',
      tags: { scenario: 'warmup' },
    },
    // Scenario 2: Mixed workload - accruals and valid withdrawals
    mixed_operations: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 20 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 50 },
        { duration: '10s', target: 0 },
      ],
      exec: 'mixedOperations',
      startTime: '15s',
      tags: { scenario: 'mixed' },
    },
    // Scenario 3: Stress test - attempt overdrafts (trigger rejections)
    overdraft_stress: {
      executor: 'constant-vus',
      vus: 30,
      duration: '20s',
      exec: 'attemptOverdraft',
      startTime: '40s',
      tags: { scenario: 'overdraft' },
    },
    // Scenario 4: Balance reads under load
    balance_reads: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 20,
      maxVUs: 50,
      exec: 'readBalance',
      startTime: '20s',
      tags: { scenario: 'reads' },
    },
    // Scenario 5: Concurrent operations on same profile (contention)
    contention_test: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 50,
      exec: 'contentionOperations',
      startTime: '65s',
      tags: { scenario: 'contention' },
    },
  },
  thresholds: {
    'operation_latency{scenario:mixed}': ['p(95)<200'],
    'operation_latency{scenario:reads}': ['p(95)<100'],
    trigger_rejection_rate: ['rate>0'], // We expect some rejections
  },
};

// Helper to get random profile ID
function getRandomProfileId() {
  return profileIds[Math.floor(Math.random() * profileIds.length)];
}

// Create an accrual (positive amount)
export function createAccrual() {
  const profileId = getRandomProfileId();
  const amount = Math.floor(Math.random() * 9000) + 1000; // 1000-10000
  const accrualDocId = Math.floor(Math.random() * 1000000);
  const registrarDocId = Math.floor(Math.random() * 1000000);

  const start = Date.now();
  const res = http.post(
    `${BASE}/pg/balance`,
    JSON.stringify({
      profile_id: profileId,
      accrual_doc_id: accrualDocId,
      registrar_doc_id: registrarDocId,
      amount: amount,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  operationLatency.add(Date.now() - start);

  const success = check(res, {
    'accrual created': (r) => r.status === 201,
  });

  if (success) accrualSuccess.add(1);
}

// Mixed operations - 70% accruals, 30% valid withdrawals
export function mixedOperations() {
  const profileId = getRandomProfileId();

  if (Math.random() < 0.7) {
    // Accrual
    const amount = Math.floor(Math.random() * 500) + 100;
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
    if (res.status === 201) accrualSuccess.add(1);
  } else {
    // Small withdrawal (likely to succeed)
    const amount = -Math.floor(Math.random() * 50) - 10; // -10 to -60
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
      withdrawalSuccess.add(1);
      triggerRejectionRate.add(false);
    } else if (res.status === 500) {
      withdrawalRejected.add(1);
      triggerRejectionRate.add(true);
    }
  }

  sleep(0.05);
}

// Attempt overdraft (should be rejected by trigger)
export function attemptOverdraft() {
  // Use a fresh profile to ensure no balance
  const profileId = 100000 + Math.floor(Math.random() * 100000);
  const amount = -Math.floor(Math.random() * 1000) - 100; // -100 to -1100

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

  const rejected = check(res, {
    'overdraft rejected': (r) => r.status === 500,
    'error message contains balance': (r) =>
      r.body && r.body.includes('Balance cannot be negative'),
  });

  if (rejected) {
    withdrawalRejected.add(1);
    triggerRejectionRate.add(true);
  }

  sleep(0.1);
}

// Read balance for random profile
export function readBalance() {
  const profileId = getRandomProfileId();
  const start = Date.now();

  const res = http.get(`${BASE}/pg/balance/profile/${profileId}`);

  operationLatency.add(Date.now() - start);

  const success = check(res, {
    'balance read 200': (r) => r.status === 200,
    'has balance field': (r) => r.json('balance') !== undefined,
  });

  if (success) balanceCheckSuccess.add(1);
}

// Contention test - multiple VUs hit same profile
export function contentionOperations() {
  // All VUs target same small set of profiles
  const profileId = (__VU % 5) + 1; // Profiles 1-5

  // Alternate between accrual and small withdrawal
  const isAccrual = __ITER % 2 === 0;
  const amount = isAccrual
    ? Math.floor(Math.random() * 100) + 50
    : -Math.floor(Math.random() * 20) - 5;

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

  if (res.status === 201) {
    if (isAccrual) {
      accrualSuccess.add(1);
    } else {
      withdrawalSuccess.add(1);
    }
  } else if (res.status === 500) {
    withdrawalRejected.add(1);
  }

  sleep(0.02);
}

export function setup() {
  // Clean up before test
  const res = http.del(`${BASE}/pg/balance`);
  check(res, { 'cleanup successful': (r) => r.status === 200 });
  console.log('Balance changes table truncated');

  // Create initial accruals for contention profiles
  for (let i = 1; i <= 5; i++) {
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
  console.log('Initial balances created for contention profiles');
}

export function handleSummary(data) {
  const accruals = data.metrics.accrual_success?.values?.count || 0;
  const withdrawals = data.metrics.withdrawal_success?.values?.count || 0;
  const rejected = data.metrics.withdrawal_rejected?.values?.count || 0;
  const balanceReads = data.metrics.balance_check_success?.values?.count || 0;

  const p50 = data.metrics.operation_latency?.values?.['p(50)'] || 0;
  const p95 = data.metrics.operation_latency?.values?.['p(95)'] || 0;
  const p99 = data.metrics.operation_latency?.values?.['p(99)'] || 0;

  return {
    stdout: `
=====================================
       BALANCE TRIGGER TEST SUMMARY
=====================================
Successful accruals:    ${accruals}
Successful withdrawals: ${withdrawals}
Rejected (trigger):     ${rejected}
Balance reads:          ${balanceReads}
-------------------------------------
Latency p50: ${p50.toFixed(1)}ms
Latency p95: ${p95.toFixed(1)}ms
Latency p99: ${p99.toFixed(1)}ms
=====================================
`,
  };
}
