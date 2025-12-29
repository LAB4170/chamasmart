import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
    stages: [
        { duration: '30s', target: 20 },  // Ramp up to 20 users
        { duration: '1m', target: 50 },   // Ramp up to 50 users
        { duration: '2m', target: 50 },   // Stay at 50 users
        { duration: '30s', target: 100 }, // Spike to 100 users
        { duration: '1m', target: 100 },  // Stay at 100 users
        { duration: '30s', target: 0 },   // Ramp down to 0 users
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
        http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
        errors: ['rate<0.1'],              // Custom error rate should be less than 10%
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Test data
let authToken;
let userId;

export function setup() {
    // Register a test user
    const registerRes = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
        email: `loadtest${Date.now()}@example.com`,
        password: 'Test123!@#',
        firstName: 'Load',
        lastName: 'Test',
        phoneNumber: '1234567890',
    }), {
        headers: { 'Content-Type': 'application/json' },
    });

    const registerData = JSON.parse(registerRes.body);

    return {
        token: registerData.token,
        userId: registerData.data.user_id,
    };
}

export default function (data) {
    // Test 1: Health check
    const healthRes = http.get(`${BASE_URL}/api/health`);
    check(healthRes, {
        'health check status is 200': (r) => r.status === 200,
        'health check response time < 100ms': (r) => r.timings.duration < 100,
    }) || errorRate.add(1);

    sleep(1);

    // Test 2: Get user's chamas
    const chamasRes = http.get(`${BASE_URL}/api/chamas/user/my-chamas`, {
        headers: {
            'Authorization': `Bearer ${data.token}`,
        },
    });

    check(chamasRes, {
        'get chamas status is 200': (r) => r.status === 200,
        'get chamas response time < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);

    sleep(1);

    // Test 3: Get all chamas (cached)
    const allChamasRes = http.get(`${BASE_URL}/api/chamas`);

    check(allChamasRes, {
        'get all chamas status is 200': (r) => r.status === 200,
        'get all chamas response time < 200ms': (r) => r.timings.duration < 200,
    }) || errorRate.add(1);

    sleep(2);

    // Test 4: Metrics endpoint
    const metricsRes = http.get(`${BASE_URL}/metrics`);

    check(metricsRes, {
        'metrics endpoint status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(1);
}

export function teardown(data) {
    // Cleanup if needed
    console.log('Load test completed');
}
