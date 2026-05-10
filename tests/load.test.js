/**
 * Tests de carga con k6
 * 
 * Instalar k6: https://k6.io/docs/getting-started/installation/
 * Ejecutar: k6 run tests/load.test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
    stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        errors: ['rate<0.05'],
        response_time: ['p(95)<2000'],
        http_req_duration: ['p(95)<3000'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || '';

export default function () {
    const headers = {
        'Content-Type': 'application/json',
        'x-user-id': ADMIN_TOKEN || 'test-admin-id',
    };

    // GET /api/version
    let res = http.get(`${BASE_URL}/api/version`);
    check(res, { 'version ok': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
    responseTime.add(res.timings.duration);

    // GET /api/events
    res = http.get(`${BASE_URL}/api/events`, { headers });
    check(res, { 'events ok': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);

    sleep(1);
}
