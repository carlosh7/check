/**
 * E2E Integration Tests (v12.44.779)
 * Flujos críticos: login→event→guest→checkin→webhook→health
 */
require('dotenv').config();
const request = require('supertest');
const express = require('express');
const { db } = require('../database');
const { generateToken } = require('../src/security/jwt');

let app, adminToken, eventId, guestId;

beforeAll(() => {
    app = express();
    app.use(express.json());
    
    app.use('/api', require('../src/routes/auth.routes'));
    app.use('/api/events', require('../src/routes/events.routes'));
    app.use('/api/guests', require('../src/routes/guests.routes'));
    app.use('/api/events', require('../src/routes/surveys.routes'));
    app.use('/api/settings', require('../src/routes/settings.routes'));
    app.use('/api', require('../src/routes/version.routes'));
    app.use('/api', require('../src/routes/stats.routes'));
    app.use('/api/webhooks', require('../src/routes/webhooks.routes'));
    
    const admin = db.prepare("SELECT id, username, role FROM users WHERE role = 'ADMIN' LIMIT 1").get();
    adminToken = generateToken({ userId: admin.id, username: admin.username, role: admin.role });
});

describe('E2E: Auth Flow', () => {
    test('Login returns valid JWT', async () => {
        const res = await request(app).post('/api/login').send({ username: 'admin@check.com', password: 'admin123' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.role).toBe('ADMIN');
    });
    
    test('Rejected login returns 401', async () => {
        const res = await request(app).post('/api/login').send({ username: 'wrong@test.com', password: 'wrong' });
        expect(res.status).toBe(401);
    });
    
    test('GET /api/me returns user info', async () => {
        const res = await request(app).get('/api/me').set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('username');
    });
});

describe('E2E: Event CRUD', () => {
    test('Create event', async () => {
        const res = await request(app).post('/api/events').set('Authorization', 'Bearer ' + adminToken).send({
            name: 'E2E Test Event', date: '2026-12-31', location: 'Test Location'
        });
        expect([200, 201]).toContain(res.status);
        eventId = res.body.eventId || res.body.id;
        expect(eventId).toBeDefined();
    });
    
    test('List events includes created event', async () => {
        const res = await request(app).get('/api/events').set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const found = res.body.find(e => e.id === eventId);
        expect(found).toBeDefined();
    });
    
    test('Clone event', async () => {
        const res = await request(app).post('/api/events/' + eventId + '/clone').set('Authorization', 'Bearer ' + adminToken);
        expect([200, 201]).toContain(res.status);
    });
});

describe('E2E: Guest Flow', () => {
    test('Add guest via attendance', async () => {
        const res = await request(app).post('/api/events/' + eventId + '/attendance').set('Authorization', 'Bearer ' + adminToken).send({
            name: 'E2E Guest', email: 'e2e@test.com'
        });
        expect([200, 201]).toContain(res.status);
    });
    
    test('List guests', async () => {
        const res = await request(app).get('/api/events/' + eventId + '/attendance').set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const guest = res.body.find(g => g.client_email === 'e2e@test.com');
        expect(guest).toBeDefined();
        guestId = guest.id || guest.guest_id;
    });
    
    test('Check-in guest', async () => {
        if (!guestId) return;
        const res = await request(app).post('/api/events/' + eventId + '/attendance/' + guestId + '/checkin').set('Authorization', 'Bearer ' + adminToken);
        expect([200, 201]).toContain(res.status);
    });
    
    test('Verify guest checked_in in DB', async () => {
        if (!guestId) return;
        const guest = db.prepare("SELECT checked_in FROM guests WHERE id = ?").get(guestId);
        expect(guest).toBeDefined();
        expect(guest.checked_in).toBe(1);
    });
    
    test('Change guest status', async () => {
        if (!guestId) return;
        const res = await request(app).patch('/api/events/' + eventId + '/guest-status/' + guestId).set('Authorization', 'Bearer ' + adminToken).send({ status: 'confirmed' });
        expect(res.status).toBe(200);
    });
});

describe('E2E: Settings & Analytics', () => {
    test('Get settings', async () => {
        const res = await request(app).get('/api/settings').set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
        expect(typeof res.body).toBe('object');
    });
    
    test('Get analytics', async () => {
        const res = await request(app).get('/api/analytics?period=30').set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('totalEvents');
    });
});

describe('E2E: Webhooks CRUD', () => {
    let webhookId;
    
    test('Create webhook', async () => {
        const res = await request(app).post('/api/webhooks').set('Authorization', 'Bearer ' + adminToken).send({
            name: 'E2E Webhook', url: 'https://example.com/hook', events: ['guest.created']
        });
        expect(res.status).toBe(201);
        webhookId = res.body.id;
    });
    
    test('List webhooks', async () => {
        const res = await request(app).get('/api/webhooks').set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
    
    test('Delete webhook', async () => {
        if (!webhookId) return;
        const res = await request(app).delete('/api/webhooks/' + webhookId).set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(204);
    });
});

describe('E2E: Health', () => {
    test('Health returns ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
    
    test('Version returns version string', async () => {
        const res = await request(app).get('/api/app-version');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('version');
    });
});

describe('E2E: Cleanup', () => {
    test('Delete test event', async () => {
        if (!eventId) return;
        const res = await request(app).delete('/api/events/' + eventId).set('Authorization', 'Bearer ' + adminToken);
        expect([200, 204]).toContain(res.status);
    });
});
