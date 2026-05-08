import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom Metrics to track specific bottleneck areas
const loginDuration = new Trend('login_duration');
const dbReadDuration = new Trend('db_read_duration');
const dbWriteDuration = new Trend('db_write_duration');
const serverFailureRate = new Rate('server_failure_rate');

const SCENARIO = __ENV.SCENARIO || 'full';

export const options = {
  scenarios: {},
  thresholds: {
    server_failure_rate: ['rate<0.01'], // Accept less than 1% 5xx errors
  }
};

// -----------------------------------------------------------
// Advanced Scenario Definitions
// -----------------------------------------------------------
if (SCENARIO === 'cpu') {
  options.scenarios.cpu_stress = {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 50 },  // Ramp to 50
      { duration: '3m', target: 500 }, // Ramp to 500 (Heavy bcrypt load)
      { duration: '1m', target: 0 },   // Cool down
    ],
    exec: 'cpuTest'
  };
} else if (SCENARIO === 'db_read') {
  options.scenarios.db_read_stress = {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 100 }, // Ramp to 100
      { duration: '3m', target: 800 }, // Ramp to 800 (Pool exhaustion test)
      { duration: '1m', target: 0 },   // Cool down
    ],
    exec: 'dbReadTest'
  };
} else if (SCENARIO === 'db_write') {
  options.scenarios.db_write_stress = {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 100 }, // Ramp to 100
      { duration: '3m', target: 600 }, // Ramp to 600 (Locking/latency test)
      { duration: '1m', target: 0 },   // Cool down
    ],
    exec: 'dbWriteTest'
  };
} else if (SCENARIO === 'full') {
  options.scenarios.full_system_stress = {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },  // Ramp to 100
      { duration: '6m', target: 1000 }, // Ramp to 1000
      { duration: '2m', target: 0 },    // Cool down
    ],
    exec: 'fullMixedTest'
  };
}

const BASE_URL = 'http://localhost:5000/api/v1';
const MOCK_PATIENT_ID = '64abcd1234567890abcd1234'; 
const MOCK_DOCTOR_ID = '64abcd1234567890abcd5678';

// State maintained per VU
let xsrfToken = null;

function getHeaders() {
  if (!xsrfToken) {
    const res = http.get(`${BASE_URL}/departments`); // Safe endpoint to acquire CSRF cookie
    xsrfToken = res.cookies['XSRF-TOKEN'] ? res.cookies['XSRF-TOKEN'][0].value : 'mock-token';
  }
  return {
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': xsrfToken,
    },
  };
}

// -----------------------------------------------------------
// Execution Functions
// -----------------------------------------------------------

// A: CPU STRESS (AUTH HEAVY)
export function cpuTest() {
  const payload = JSON.stringify({ email: 'admin@medisync.com', password: 'password123' });
  const res = http.post(`${BASE_URL}/auth/login`, payload, getHeaders());
  
  check(res, { 'auth execution complete': (r) => r.status < 500 });
  loginDuration.add(res.timings.duration);
  serverFailureRate.add(res.status >= 500); // Only 5xx indicates a catastrophic failure

  // If token rotated, update it
  if (res.cookies['XSRF-TOKEN']) {
    xsrfToken = res.cookies['XSRF-TOKEN'][0].value;
  }
  
  sleep(randomIntBetween(1, 3));
}

// B: DB STRESS (READ HEAVY)
export function dbReadTest() {
  const res = http.get(`${BASE_URL}/patients`, getHeaders());
  
  check(res, { 'read execution complete': (r) => r.status < 500 });
  dbReadDuration.add(res.timings.duration);
  serverFailureRate.add(res.status >= 500);
  
  sleep(randomIntBetween(1, 3));
}

// C: WRITE STRESS (INSERT LOAD)
export function dbWriteTest() {
  const payload = JSON.stringify({
    doctorId: MOCK_DOCTOR_ID,
    patientId: MOCK_PATIENT_ID,
    date: new Date(Date.now() + 86400000).toISOString(),
    reason: 'Advanced Write Stress'
  });
  
  const res = http.post(`${BASE_URL}/appointments`, payload, getHeaders());
  
  check(res, { 'write execution complete': (r) => r.status < 500 });
  dbWriteDuration.add(res.timings.duration);
  serverFailureRate.add(res.status >= 500);
  
  sleep(randomIntBetween(1, 3));
}

// D: FULL SYSTEM STRESS (MIXED WORKLOAD)
export function fullMixedTest() {
  const rand = Math.random();
  
  if (rand < 0.30) {
    // 30% Login
    cpuTest();
  } else if (rand < 0.70) {
    // 40% DB Read
    dbReadTest();
  } else {
    // 30% DB Write
    dbWriteTest();
  }
}
