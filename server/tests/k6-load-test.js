import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom Metrics to track specific endpoint latencies
const loginDuration = new Trend('login_duration');
const getPatientsDuration = new Trend('get_patients_duration');
const postAppointmentDuration = new Trend('post_appointment_duration');
const getAppointmentsDuration = new Trend('get_appointments_duration');
const failureRate = new Rate('failure_rate');

// Define Scenarios (Light, Medium, Stress)
// Run with: k6 run -e SCENARIO=medium k6-test.js
const scenarios = {
  light: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 50 },   // Ramp up to 50 users
      { duration: '2m', target: 50 },    // Stay at 50 users
      { duration: '30s', target: 0 },    // Ramp down
    ],
  },
  medium: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 200 },   // Ramp up to 200 users
      { duration: '5m', target: 200 },   // Stay at 200 users
      { duration: '1m', target: 0 },     // Ramp down
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 1000 },  // Ramp up to 1000 users
      { duration: '10m', target: 1000 }, // Stay at 1000 users
      { duration: '2m', target: 0 },     // Ramp down
    ],
  }
};

const SCENARIO = __ENV.SCENARIO || 'light';

export const options = {
  scenarios: {
    [SCENARIO]: scenarios[SCENARIO]
  },
  thresholds: {
    // 95% of requests should be below 500ms
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    // Failure rate should be less than 1% (ignoring 429 Rate Limits as failures for stress tests)
    failure_rate: ['rate<0.01'], 
  }
};

const BASE_URL = 'http://localhost:5000/api/v1';

// Seed mock data for realistic requests
const MOCK_PATIENT_ID = '64abcd1234567890abcd1234'; 
const MOCK_DOCTOR_ID = '64abcd1234567890abcd5678';

export default function () {
  // -----------------------------------------------------------
  // 1. Initial GET request to acquire CSRF Token and Cookies
  // -----------------------------------------------------------
  let res = http.get(`${BASE_URL}/departments`);
  let xsrfToken = res.cookies['XSRF-TOKEN'] ? res.cookies['XSRF-TOKEN'][0].value : '';

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': xsrfToken,
    },
  };

  sleep(randomIntBetween(1, 2));

  // -----------------------------------------------------------
  // 2. Authentication: POST /auth/login
  // -----------------------------------------------------------
  group('Authentication', () => {
    // Note: In a real test, feed from a CSV of test users to avoid IP blocking/Rate Limiting.
    // For this test, we expect 429s if testing strictly on a single IP due to our security upgrades.
    const loginPayload = JSON.stringify({
      email: 'admin@medisync.com', 
      password: 'password123'
    });

    res = http.post(`${BASE_URL}/auth/login`, loginPayload, params);
    
    check(res, {
      'login successful or rate limited': (r) => r.status === 200 || r.status === 429,
    });
    
    loginDuration.add(res.timings.duration);
    failureRate.add(res.status >= 500); // 5xx indicates server crash, 429 is expected defense
    
    // Update CSRF token if rotated during login
    if (res.cookies['XSRF-TOKEN']) {
      xsrfToken = res.cookies['XSRF-TOKEN'][0].value;
      params.headers['X-CSRF-Token'] = xsrfToken;
    }
  });

  sleep(randomIntBetween(1, 3)); // Realistic think time

  // -----------------------------------------------------------
  // 3. Fetch Data: GET /patients
  // -----------------------------------------------------------
  group('Fetch Patients', () => {
    res = http.get(`${BASE_URL}/patients`, params);
    
    check(res, {
      'patients fetched or rate limited': (r) => r.status === 200 || r.status === 429,
    });
    
    getPatientsDuration.add(res.timings.duration);
    failureRate.add(res.status >= 500);
  });

  sleep(randomIntBetween(1, 3)); // Realistic think time

  // -----------------------------------------------------------
  // 4. State Change: POST /appointments
  // -----------------------------------------------------------
  group('Create Appointment', () => {
    const appointmentPayload = JSON.stringify({
      doctorId: MOCK_DOCTOR_ID,
      patientId: MOCK_PATIENT_ID,
      date: new Date(Date.now() + 86400000 * 7).toISOString(), // 1 week from now
      reason: 'Stress Test Automated Checkup'
    });

    res = http.post(`${BASE_URL}/appointments`, appointmentPayload, params);
    
    check(res, {
      'appointment created or rate limited': (r) => r.status === 201 || r.status === 200 || r.status === 429,
    });
    
    postAppointmentDuration.add(res.timings.duration);
    failureRate.add(res.status >= 500);
  });

  sleep(randomIntBetween(1, 3));

  // -----------------------------------------------------------
  // 5. Fetch Data: GET /appointments
  // -----------------------------------------------------------
  group('Get Appointments', () => {
    res = http.get(`${BASE_URL}/appointments`, params);
    
    check(res, {
      'appointments fetched or rate limited': (r) => r.status === 200 || r.status === 429,
    });
    
    getAppointmentsDuration.add(res.timings.duration);
    failureRate.add(res.status >= 500);
  });

  sleep(randomIntBetween(1, 3));
}
