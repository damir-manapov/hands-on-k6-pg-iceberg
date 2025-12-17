import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100,
  duration: '1000s',
};

const BASE = 'http://localhost:3000';

export default function () {
  const name = `user-${Math.floor(Math.random() * 100000)}`;
  const created = http.post(`${BASE}/pg/people`, JSON.stringify({ name }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(created, {
    'created 201': (r) => r.status === 201,
    'name matches': (r) => r.json('name') === name,
  });
}
