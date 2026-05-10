/**
 * Tests integrales del backend de Check Pro
 * Cubre: auth, events, guests, public, webhooks, payments
 */
const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');

// ─── HELPERS ───

function createTestApp(routeModule, path = '/api') {
    const app = express();
    app.use(express.json());
    app.use(path, routeModule);
    return app;
}

function getAdminToken() {
    const admin = db.prepare("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1").get();
    if (!admin) return null;
    // For middleware testing we use x-user-id header
    return admin.id;
}

// ─── AUTH ───

describe('Auth Middleware', () => {
    const { authMiddleware } = require('../src/middleware/auth');

    test('should reject requests without credentials', () => {
        const req = { headers: {} };
        let statusCode;
        const res = { status: (c) => { statusCode = c; return res; }, json: () => {} };
        authMiddleware()(req, res, () => {});
        expect(statusCode).toBe(401);
    });

    test('should reject requests with invalid token', () => {
        const req = { headers: { authorization: 'Bearer invalid_token_xyz' } };
        let statusCode;
        const res = { status: (c) => { statusCode = c; return res; }, json: () => {} };
        authMiddleware()(req, res, () => {});
        expect(statusCode).toBe(401);
    });

    test('should accept admin x-user-id', () => {
        const adminId = getAdminToken();
        if (!adminId) return;
        const req = { headers: { 'x-user-id': adminId } };
        let nextCalled = false;
        authMiddleware(['ADMIN'])(req, { status: () => ({ json: () => {} }) }, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
    });

    test('should reject non-admin for admin-only route', () => {
        const productor = db.prepare("SELECT id FROM users WHERE role = 'PRODUCTOR' LIMIT 1").get();
        if (!productor) return;
        const req = { headers: { 'x-user-id': productor.id } };
        let statusCode;
        const res = { status: (c) => { statusCode = c; return res; }, json: () => {} };
        authMiddleware(['ADMIN'])(req, res, () => {});
        expect(statusCode).toBe(403);
    });
});

// ─── DATABASE ───

describe('Database', () => {
    test('should have required tables', () => {
        const tables = ['users', 'events', 'guests', 'groups', 'webhooks', 'transactions', 'guest_categories', 'settings'];
        tables.forEach(t => {
            const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(t);
            expect(row).toBeDefined();
        });
    });

    test('should have admin user', () => {
        const admin = db.prepare("SELECT * FROM users WHERE role = 'ADMIN' LIMIT 1").get();
        expect(admin).toBeDefined();
        expect(admin.status).toBe('APPROVED');
    });
});

// ─── PUBLIC ROUTES ───

describe('Public Routes', () => {
    const publicRoutes = require('../src/routes/public.routes');
    const app = createTestApp(publicRoutes);

    test('GET /api/event/:id returns 404 for invalid event', async () => {
        const res = await request(app).get('/api/event/invalid-id-12345');
        expect([400, 404]).toContain(res.status);
    });

    test('captcha module exports functions', () => {
        const captcha = require('../src/security/captcha');
        expect(typeof captcha.generateCaptcha).toBe('function');
        expect(typeof captcha.verifyCaptcha).toBe('function');
    });

    test('POST /api/public-register rejects without required fields', async () => {
        const res = await request(app).post('/api/public-register').send({});
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('POST /api/public-register rejects with invalid event', async () => {
        const res = await request(app).post('/api/public-register').send({
            event_id: 'nonexistent',
            name: 'Test User',
            email: 'test@example.com'
        });
        expect(res.status).toBe(400);
    });
});

// ─── EVENTS ROUTES ───

describe('Events Routes', () => {
    const eventsRoutes = require('../src/routes/events.routes');
    const app = createTestApp(eventsRoutes, '/api/events');

    test('GET /api/events returns 401 without auth', async () => {
        const res = await request(app).get('/api/events');
        expect(res.status).toBe(401);
    });

    test('GET /api/events returns list for admin', async () => {
        const adminId = getAdminToken();
        if (!adminId) return;
        const res = await request(app).get('/api/events').set('x-user-id', adminId);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('event has required fields', () => {
        const event = db.prepare("SELECT id, name, date, status FROM events LIMIT 1").get();
        if (!event) return;
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('name');
        expect(event).toHaveProperty('status');
    });
});

// ─── GUESTS ROUTES ───

describe('Guests Routes', () => {
    const guestsRoutes = require('../src/routes/guests.routes');
    const app = createTestApp(guestsRoutes, '/api/guests');

    test('GET /api/guests/by-id/:id returns 404 for invalid guest', async () => {
        const res = await request(app).get('/api/guests/by-id/invalid-id');
        expect([400, 404]).toContain(res.status);
    });

    test('GET /api/guests/:eventId/categories returns 401 without auth', async () => {
        const res = await request(app).get('/api/guests/some-event/categories');
        expect(res.status).toBe(401);
    });

    test('guest has required fields', () => {
        const guest = db.prepare("SELECT id, event_id, name, email FROM guests LIMIT 1").get();
        if (!guest) return;
        expect(guest).toHaveProperty('id');
        expect(guest).toHaveProperty('event_id');
        expect(guest).toHaveProperty('name');
        expect(guest).toHaveProperty('email');
    });
});

// ─── WEBHOOKS ───

describe('Webhooks Routes', () => {
    const webhooksRoutes = require('../src/routes/webhooks.routes');
    const app = createTestApp(webhooksRoutes, '/api/webhooks');

    test('GET /api/webhooks returns 401 without auth', async () => {
        const res = await request(app).get('/api/webhooks');
        expect(res.status).toBe(401);
    });

    test('GET /api/webhooks/events/available returns events list', async () => {
        const adminId = getAdminToken();
        if (!adminId) return;
        const res = await request(app).get('/api/webhooks/events/available').set('x-user-id', adminId);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('events');
        expect(typeof res.body.events).toBe('object');
    });

    test('POST /api/webhooks validates required fields', async () => {
        const adminId = getAdminToken();
        if (!adminId) return;
        const res = await request(app).post('/api/webhooks').set('x-user-id', adminId).send({ name: 'test' });
        expect(res.status).toBe(400);
    });

    test('full webhook CRUD flow', async () => {
        const adminId = getAdminToken();
        if (!adminId) return;

        // Create
        const createRes = await request(app).post('/api/webhooks').set('x-user-id', adminId).send({
            name: 'Test Webhook',
            url: 'https://example.com/webhook',
            events: ['guest.created', 'guest.checked_in']
        });
        expect(createRes.status).toBe(201);
        expect(createRes.body).toHaveProperty('id');
        const webhookId = createRes.body.id;

        // Get by ID
        const getRes = await request(app).get('/api/webhooks/' + webhookId).set('x-user-id', adminId);
        expect(getRes.status).toBe(200);
        expect(getRes.body.name).toBe('Test Webhook');

        // Update
        const putRes = await request(app).put('/api/webhooks/' + webhookId).set('x-user-id', adminId).send({ name: 'Updated Webhook' });
        expect(putRes.status).toBe(200);
        expect(putRes.body.name).toBe('Updated Webhook');

        // List all
        const listRes = await request(app).get('/api/webhooks').set('x-user-id', adminId);
        expect(listRes.status).toBe(200);
        expect(Array.isArray(listRes.body)).toBe(true);

        // Delete
        const delRes = await request(app).delete('/api/webhooks/' + webhookId).set('x-user-id', adminId);
        expect(delRes.status).toBe(204);
    });
});

// ─── WEBHOOK LOGS ───

describe('Webhook Logs', () => {
    const { logWebhookDelivery, getWebhookLogs } = require('../src/utils/webhooks');

    test('logWebhookDelivery handles FK constraint gracefully', () => {
        const logId = logWebhookDelivery('test-webhook-id', 'guest.created', 'https://example.com', '{"test":true}', 200, '{"ok":true}', 150, true);
        // FK constraint fails because no webhooks table has test-webhook-id, returns null
        expect(logId).toBeNull();
    });
});

// ─── WEBHOOK UTILS ───

describe('Webhook Utils', () => {
    const { generateSecret, signPayload, WEBHOOK_EVENTS } = require('../src/utils/webhooks');

    test('generateSecret returns 64-char hex string', () => {
        const secret = generateSecret();
        expect(secret).toMatch(/^[a-f0-9]{64}$/);
    });

    test('signPayload creates HMAC signature', () => {
        const secret = generateSecret();
        const signature = signPayload({ test: true }, secret);
        expect(signature).toMatch(/^[a-f0-9]{64}$/);
        // Same payload should produce same signature
        const sig2 = signPayload({ test: true }, secret);
        expect(signature).toBe(sig2);
    });

    test('WEBHOOK_EVENTS defines all event types', () => {
        expect(WEBHOOK_EVENTS).toHaveProperty('GUEST_CREATED');
        expect(WEBHOOK_EVENTS).toHaveProperty('EVENT_CREATED');
        expect(WEBHOOK_EVENTS).toHaveProperty('PAYMENT_COMPLETED');
        expect(WEBHOOK_EVENTS).toHaveProperty('SURVEY_SUBMITTED');
        expect(Object.keys(WEBHOOK_EVENTS).length).toBeGreaterThanOrEqual(14);
    });
});

// ─── VALIDATION ───

describe('Validation Schemas', () => {
    const { schemas, validate } = require('../src/security/validation');

    test('schemas should have login schema', () => {
        expect(schemas).toHaveProperty('login');
    });

    test('validate rejects invalid login', () => {
        const result = validate(schemas.login, {});
        expect(result.valid).toBe(false);
    });

    test('validate accepts valid login', () => {
        const result = validate(schemas.login, { username: 'admin', password: '123456' });
        expect(result.valid).toBe(true);
    });
});

// ─── HELPERS ───

describe('Helpers', () => {
    const { getValidId, castId } = require('../src/utils/helpers');

    test('getValidId returns a UUID for a valid table', () => {
        const id = getValidId('events');
        expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });

    test('castId returns falsy for undefined', () => {
        expect(castId('events', undefined)).toBeFalsy();
        expect(castId('events', null)).toBeFalsy();
    });

    test('castId returns the ID if valid', () => {
        const id = getValidId('events');
        expect(castId('events', id)).toBe(id);
    });
});

// ─── PAYMENTS ───

describe('Payments Routes', () => {
    const { router: paymentsRoutes } = require('../src/routes/payments.routes');
    const app = createTestApp(paymentsRoutes);

    test('POST /api/events/:id/checkout returns 404 for invalid event', async () => {
        const res = await request(app).post('/api/events/nonexistent/checkout').send({
            name: 'Test', email: 'test@test.com', category_id: 'cat1'
        });
        expect(res.status).toBe(404);
    });

    test('GET /api/events/:id/transactions returns 401 without auth', async () => {
        const res = await request(app).get('/api/events/some-event/transactions');
        expect(res.status).toBe(401);
    });

    test('transactions table schema is correct', () => {
        const txn = db.prepare("PRAGMA table_info(transactions)").all();
        const colNames = txn.map(c => c.name);
        expect(colNames).toContain('id');
        expect(colNames).toContain('event_id');
        expect(colNames).toContain('amount');
        expect(colNames).toContain('status');
        expect(colNames).toContain('provider');
        expect(colNames).toContain('provider_txn_id');
    });
});

// ─── SESSIONS ───

describe('Sessions', () => {
    test('sessions table exists', () => {
        const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();
        expect(table).toBeDefined();
    });

    test('guest_categories table has price column', () => {
        const cols = db.prepare("PRAGMA table_info(guest_categories)").all();
        const colNames = cols.map(c => c.name);
        expect(colNames).toContain('price');
    });

    test('events table has payment_required column', () => {
        const cols = db.prepare("PRAGMA table_info(events)").all();
        const colNames = cols.map(c => c.name);
        expect(colNames).toContain('payment_required');
        expect(colNames).toContain('currency');
    });
});

// ─── RAFELES ───

describe('Raffles', () => {
    test('raffles table exists', () => {
        const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='raffles'").get();
        expect(table).toBeDefined();
    });

    test('raffle_spins table exists with lead_json column', () => {
        const cols = db.prepare("PRAGMA table_info(raffle_spins)").all();
        const colNames = cols.map(c => c.name);
        expect(colNames).toContain('lead_json');
    });
});

// ─── PUBLIC QR ENDPOINTS ───

describe('Public QR Endpoints', () => {
    const publicRoutes = require('../src/routes/public.routes');
    const app = createTestApp(publicRoutes);

    test('GET /api/event/:id/qr returns 400 for invalid event', async () => {
        const res = await request(app).get('/api/event/invalid-id/qr');
        expect([400, 404]).toContain(res.status);
    });

    test('GET /api/guests/qr/:id returns 404 for invalid guest', async () => {
        const res = await request(app).get('/api/guests/qr/nonexistent-guest');
        expect(res.status).toBe(404);
    });

    test('GET /api/portal/:id returns 404 for invalid guest', async () => {
        const res = await request(app).get('/api/portal/nonexistent-guest');
        expect(res.status).toBe(404);
    });
});

// ─── AUTH ROUTES ───

describe('Auth Routes', () => {
    const authRoutes = require('../src/routes/auth.routes');
    const app = createTestApp(authRoutes);

    test('POST /api/login rejects empty body', async () => {
        const res = await request(app).post('/api/login').send({});
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('errors');
    });

    test('POST /api/login rejects invalid credentials', async () => {
        const res = await request(app).post('/api/login').send({ username: 'nonexistent@test.com', password: 'wrong' });
        expect(res.status).toBe(401);
    });

    test('GET /api/me returns 401 without auth', async () => {
        const res = await request(app).get('/api/me');
        expect(res.status).toBe(401);
    });
});

// ─── USERS ROUTES ───

describe('Users Routes', () => {
    const usersRoutes = require('../src/routes/users.routes');
    const app = createTestApp(usersRoutes, '/api/users');

    test('GET /api/users returns 401 without auth', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(401);
    });

    test('GET /api/users/:id returns 401 without auth', async () => {
        const res = await request(app).get('/api/users/some-id');
        expect(res.status).toBe(401);
    });
});

// ─── VENUES ROUTES ───

describe('Venues Routes', () => {
    const venuesRoutes = require('../src/routes/venues.routes');
    const app = createTestApp(venuesRoutes, '/api/venues');

    test('GET /api/venues returns 401 without auth', async () => {
        const res = await request(app).get('/api/venues');
        expect(res.status).toBe(401);
    });
});

// ─── SESSIONS ROUTES ───

describe('Sessions Routes', () => {
    const sessionsRoutes = require('../src/routes/sessions.routes');
    const app = createTestApp(sessionsRoutes, '/api/sessions');

    test('GET /api/sessions/:eventId returns 401 without auth', async () => {
        const res = await request(app).get('/api/sessions/any-event');
        expect(res.status).toBe(401);
    });
});

// ─── GROUPS ROUTES ───

describe('Groups Routes', () => {
    const groupsRoutes = require('../src/routes/groups.routes');
    const app = createTestApp(groupsRoutes, '/api/groups');

    test('GET /api/groups returns 401 without auth', async () => {
        const res = await request(app).get('/api/groups');
        expect(res.status).toBe(401);
    });
});

// ─── VERSION ROUTES ───

describe('Version Routes', () => {
    const versionRoutes = require('../src/routes/version.routes');
    const app = createTestApp(versionRoutes);

    test('GET /api/app-version returns version object', async () => {
        const res = await request(app).get('/api/app-version');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('version');
        expect(typeof res.body.version).toBe('string');
    });

    test('GET /api/health returns ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});

// ─── SURVEYS ROUTES ───

describe('Surveys Routes', () => {
    const surveysRoutes = require('../src/routes/surveys.routes');
    const app = createTestApp(surveysRoutes, '/api/events');

    test('GET /api/events/:id/templates returns 401 without auth', async () => {
        const res = await request(app).get('/api/events/any-event/templates');
        expect(res.status).toBe(401);
    });
});

// ─── RAFELES ROUTES ───

describe('Raffles Routes', () => {
    const rafflesRoutes = require('../src/routes/raffles.routes');
    const app = createTestApp(rafflesRoutes, '/api/raffles');

    test('GET /api/raffles/events/:id/raffles returns 401 without auth', async () => {
        const res = await request(app).get('/api/raffles/events/any-event/raffles');
        expect(res.status).toBe(401);
    });

    test('GET /api/raffles/:id/public returns 404 for nonexistent', async () => {
        const res = await request(app).get('/api/raffles/nonexistent-id/public');
        expect(res.status).toBe(404);
    });
});

// ─── CLIENTS ROUTES ───

describe('Clients Routes', () => {
    const clientsRoutes = require('../src/routes/clients.routes');
    const app = createTestApp(clientsRoutes, '/api/clients');

    test('GET /api/clients returns 401 without auth', async () => {
        const res = await request(app).get('/api/clients');
        expect(res.status).toBe(401);
    });
});

// ─── USERS ROUTES (more tests) ───

describe('Users Routes Extended', () => {
    const usersRoutes = require('../src/routes/users.routes');
    const app = createTestApp(usersRoutes, '/api/users');

    test('GET /api/users returns 401 without auth', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(401);
    });
});

// ─── GROUPS ROUTES ───

describe('Groups Routes', () => {
    const groupsRoutes = require('../src/routes/groups.routes');
    const app = createTestApp(groupsRoutes, '/api/groups');

    test('GET /api/groups returns 401 without auth', async () => {
        const res = await request(app).get('/api/groups');
        expect(res.status).toBe(401);
    });
});

// ─── TENANTS ROUTES ───

describe('Tenants Routes', () => {
    const tenantsRoutes = require('../src/routes/tenants.routes');
    const app = createTestApp(tenantsRoutes);

    test('GET /api/tenant/:slug returns 404 for nonexistent', async () => {
        const res = await request(app).get('/api/tenant/nonexistent-slug-xyz');
        expect(res.status).toBe(404);
    });
});

// ─── AUTOMATION ROUTES ───

describe('Automation Routes', () => {
    const automationRoutes = require('../src/routes/automation.routes');
    const app = createTestApp(automationRoutes, '/api');

    test('GET /api/events/:eventId/automation returns 401 without auth', async () => {
        const res = await request(app).get('/api/events/any-event/automation');
        expect(res.status).toBe(401);
    });

    test('GET /api/automation/options returns available triggers', async () => {
        const adminId = getAdminToken();
        if (!adminId) return;
        const res = await request(app).get('/api/automation/options').set('x-user-id', adminId);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('triggers');
        expect(res.body).toHaveProperty('actions');
    });
});

// ─── PROPOSALS ROUTES ───

describe('Proposals Routes', () => {
    const proposalsRoutes = require('../src/routes/proposals.routes');
    const app = createTestApp(proposalsRoutes, '/api');

    test('GET /api/events/:id/proposals returns array', async () => {
        const res = await request(app).get('/api/events/any-event/proposals');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('POST /api/events/:id/proposals rejects empty body', async () => {
        const res = await request(app).post('/api/events/any-event/proposals').send({});
        expect(res.status).toBe(400);
    });
});

// ─── DATABASE TABLES SCHEMA ───

describe('Database Schema - Recent Tables', () => {
    test('tenants table exists', () => {
        const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tenants'").get();
        expect(t).toBeDefined();
    });

    test('automation_rules table exists', () => {
        const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='automation_rules'").get();
        expect(t).toBeDefined();
    });

    test('proposals table exists', () => {
        const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='proposals'").get();
        expect(t).toBeDefined();
    });

    test('budgets table exists', () => {
        const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='budgets'").get();
        expect(t).toBeDefined();
    });

    test('speakers table exists', () => {
        const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='speakers'").get();
        expect(t).toBeDefined();
    });

    test('guests has otp_code column', () => {
        const cols = db.prepare("PRAGMA table_info(guests)").all();
        const names = cols.map(c => c.name);
        expect(names).toContain('otp_code');
    });

    test('events has video_conference_url column', () => {
        const cols = db.prepare("PRAGMA table_info(events)").all();
        const names = cols.map(c => c.name);
        expect(names).toContain('video_conference_url');
    });
});

// ─── DEPLOY WEBHOOK (C6-14) ───

describe('Deploy Webhook', () => {
    const deployRoutes = require('../src/routes/deploy.routes');
    const crypto = require('crypto');

    function createDeployApp() {
        const app = express();
        app.use('/api/deploy/webhook', express.raw({ type: 'application/json' }));
        app.use('/api', deployRoutes);
        return app;
    }

    function signPayload(payload, secret) {
        return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    }

    test('deploy_logs table exists', () => {
        const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='deploy_logs'").get();
        expect(t).toBeDefined();
    });

    test('POST /api/deploy/webhook returns 401 without valid signature', async () => {
        const app = createDeployApp();
        const res = await request(app)
            .post('/api/deploy/webhook')
            .set('content-type', 'application/json')
            .send(JSON.stringify({ ref: 'refs/heads/main' }));
        expect(res.status).toBe(401);
    });

    test('POST /api/deploy/webhook logs deploy and returns ok', async () => {
        const secret = 'test-secret-123';
        const oldSecret = process.env.DEPLOY_WEBHOOK_SECRET;
        process.env.DEPLOY_WEBHOOK_SECRET = secret;

        const app = createDeployApp();
        const payload = JSON.stringify({
            ref: 'refs/heads/main',
            repository: { full_name: 'carlosh7/check' },
            head_commit: { id: 'abc123', committer: { name: 'Test User' } }
        });
        const signature = signPayload(payload, secret);

        const res = await request(app)
            .post('/api/deploy/webhook')
            .set('content-type', 'application/json')
            .set('x-hub-signature-256', signature)
            .set('x-github-event', 'push')
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        // Verify log was created
        const log = db.prepare("SELECT * FROM deploy_logs ORDER BY created_at DESC LIMIT 1").get();
        expect(log).toBeDefined();
        expect(log.repository).toBe('carlosh7/check');
        expect(log.ref).toBe('refs/heads/main');

        process.env.DEPLOY_WEBHOOK_SECRET = oldSecret;
    });

    test('POST /api/deploy/webhook skips non-main branch', async () => {
        const secret = 'test-secret-456';
        const oldSecret = process.env.DEPLOY_WEBHOOK_SECRET;
        process.env.DEPLOY_WEBHOOK_SECRET = secret;

        const app = createDeployApp();
        const payload = JSON.stringify({
            ref: 'refs/heads/develop',
            repository: { full_name: 'carlosh7/check' },
            head_commit: { id: 'def456', committer: { name: 'Dev User' } }
        });
        const signature = signPayload(payload, secret);

        const res = await request(app)
            .post('/api/deploy/webhook')
            .set('content-type', 'application/json')
            .set('x-hub-signature-256', signature)
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('skipped');

        process.env.DEPLOY_WEBHOOK_SECRET = oldSecret;
    });
});
