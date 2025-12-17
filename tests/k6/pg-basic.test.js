import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 5,
  duration: '10s',
};

const BASE = 'http://localhost:3000';

export default function () {
  const health = http.get(`${BASE}/pg/health`);
  check(health, {
    'health ok': (r) => r.status === 200 && r.json('ok') === true,
  });

  const name = `user-${Math.floor(Math.random() * 100000)}`;
  const created = http.post(`${BASE}/pg/people`, JSON.stringify({ name }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(created, {
    'created 201': (r) => r.status === 201,
    'name matches': (r) => r.json('name') === name,
  });

  const list = http.get(`${BASE}/pg/people`);
  check(list, {
    'list 200': (r) => r.status === 200,
    'has items': (r) => Array.isArray(r.json()) && r.json().length >= 1,
  });

  // sleep(1);
}
