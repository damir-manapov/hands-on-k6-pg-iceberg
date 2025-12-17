import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const successCount = new Counter('successful_writes');
const failCount = new Counter('failed_writes');
const writeLatency = new Trend('write_latency');

export const options = {
  // vus: 50,
  vus: 5_000,
  // duration: '30s',
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.1'], // Less than 10% failures
    write_latency: ['p(95)<5000'], // 95% of writes under 5s
  },
};

const PORT = __ENV.PORT ? parseInt(__ENV.PORT) : 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default function () {
  const name = `user-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const start = Date.now();

  const res = http.post(
    `${BASE_URL}/trino/people/batch`,
    JSON.stringify({ name }),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '30s',
    }
  );

  const latency = Date.now() - start;
  writeLatency.add(latency);

  const success = check(res, {
    'status is 201': (r) => r.status === 201,
    'has id': (r) => r.json('id') !== undefined,
  });

  if (success) {
    successCount.add(1);
  } else {
    failCount.add(1);
    console.log(`Failed: status=${res.status} body=${res.body}`);
  }
}

export function handleSummary(data) {
  const totalReqs = data.metrics.http_reqs.values.count;
  const successRate =
    (data.metrics.successful_writes.values.count / totalReqs) * 100;
  const p50 = data.metrics.write_latency.values['p(50)'];
  const p95 = data.metrics.write_latency.values['p(95)'];
  const p99 = data.metrics.write_latency.values['p(99)'];

  console.log('\n=== Contention Test Summary ===');
  console.log(`Total requests: ${totalReqs}`);
  console.log(`Success rate: ${successRate.toFixed(2)}%`);
  console.log(`Latency p50: ${p50.toFixed(0)}ms`);
  console.log(`Latency p95: ${p95.toFixed(0)}ms`);
  console.log(`Latency p99: ${p99.toFixed(0)}ms`);

  return {};
}
