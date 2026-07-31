/**
 * Load and Stress Testing with k6
 * Tests de carga y estrés para la aplicación
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Ramp up to 100 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'], // Error rate < 1%
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';

export default function () {
  // Test 1: Load main page
  const res1 = http.get(`${BASE_URL}/`);
  
  check(res1, {
    'main page status 200': (r) => r.status === 200,
    'main page has content': (r) => r.body.length > 0,
    'main page response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: Navigate to a game (simulated)
  const res2 = http.get(`${BASE_URL}/#termita`);
  
  check(res2, {
    'game page status 200': (r) => r.status === 200,
    'game page response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(2);

  // Test 3: Simulate game interaction (POST request if applicable)
  const res3 = http.post(`${BASE_URL}/api/score`, JSON.stringify({
    game: 'termita',
    score: 100,
    timestamp: Date.now()
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  // This might fail if the endpoint doesn't exist, which is okay for testing
  if (res3.status !== 404) {
    check(res3, {
      'score endpoint status 200': (r) => r.status === 200,
      'score endpoint response time < 300ms': (r) => r.timings.duration < 300,
    }) || errorRate.add(1);
  }

  sleep(1);
}

export function handleSummary(data) {
  console.log('Load Test Summary:');
  console.log(`Total requests: ${data.metrics.http_reqs.count}`);
  console.log(`Failed requests: ${data.metrics.http_req_failed.count}`);
  console.log(`Error rate: ${(data.metrics.http_req_failed.count / data.metrics.http_reqs.count * 100).toFixed(2)}%`);
  console.log(`95th percentile response time: ${data.metrics.http_req_duration.values['p(95)']}ms`);
  console.log(`99th percentile response time: ${data.metrics.http_req_duration.values['p(99)']}ms`);
}
