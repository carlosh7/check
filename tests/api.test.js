/**
 * Tests para el API de Check Pro
 * Usar: npm test
 */

require('dotenv').config();
const request = require('supertest');
const express = require('express');
const { db } = require('../database');
const { generateToken } = require('../src/security/jwt');

function getAdminToken() {
    const admin = db.prepare("SELECT id, username, role FROM users WHERE role = 'ADMIN' LIMIT 1").get();
    if (!admin) return null;
    return generateToken({ userId: admin.id, username: admin.username, role: admin.role });
}

describe('Check Pro API - Auth Middleware', () => {
    test('should export authMiddleware function', () => {
        const { authMiddleware } = require('../src/middleware/auth');
        expect(typeof authMiddleware).toBe('function');
    });
    
    test('should reject requests without token', () => {
        const { authMiddleware } = require('../src/middleware/auth');
        const req = { headers: {}, query: {} };
        let statusCode;
        const res = {
            status: (code) => { statusCode = code; return res; },
            json: () => {}
        };
        const next = () => {};
        
        authMiddleware()(req, res, next);
        expect(statusCode).toBe(401);
    });
    
    test('should call next with valid admin token', () => {
        const { authMiddleware } = require('../src/middleware/auth');
        const admin = db.prepare('SELECT id FROM users WHERE role = ?').get('ADMIN');
        expect(admin).toBeDefined();
        
        const token = getAdminToken();
        const req = { headers: { authorization: 'Bearer ' + token }, query: {} };
        let nextCalled = false;
        const res = {
            status: () => res,
            json: () => {}
        };
        const next = () => { nextCalled = true; };
        
        authMiddleware(['ADMIN'])(req, res, next);
        expect(nextCalled).toBe(true);
        expect(req.userId).toBe(admin.id);
        expect(req.userRole).toBe('ADMIN');
    });
});

describe('Check Pro API - Database', () => {
    test('should export db from database module', () => {
        const { db } = require('../database');
        expect(db).toBeDefined();
        expect(typeof db.prepare).toBe('function');
    });
    
    test('should have admin user', () => {
        const { db } = require('../database');
        const admin = db.prepare('SELECT * FROM users WHERE role = ?').get('ADMIN');
        expect(admin).toBeDefined();
        expect(admin.username).toBe('admin@check.com');
    });
    
    test('should have events table', () => {
        const { db } = require('../database');
        const events = db.prepare('SELECT * FROM events LIMIT 1').all();
        expect(Array.isArray(events)).toBe(true);
    });
    
    test('should have email_accounts table', () => {
        const { db } = require('../database');
        const accounts = db.prepare('SELECT COUNT(*) as c FROM email_accounts').get();
        expect(accounts).toBeDefined();
    });
});

describe('Check Pro API - Settings Routes', () => {
    let app;
    
    beforeAll(() => {
        app = express();
        app.use(express.json());
        
        const settingsRoutes = require('../src/routes/settings.routes');
        app.use('/api/settings', settingsRoutes);
    });
    
    test('GET /api/settings returns 401 without auth', async () => {
        const res = await request(app).get('/api/settings');
        expect(res.status).toBe(401);
    });
});

describe('Check Pro API - Polls Routes (C11-01)', () => {
    test('GET /api/polls/:eventId returns 401 without auth', async () => {
        const app = express();
        app.use(express.json());
        const pollsRoutes = require('../src/routes/polls.routes');
        app.use('/api/polls', pollsRoutes);
        const res = await request(app).get('/api/polls/nonexistent');
        expect(res.status).toBe(401);
    });
    
    test('polls DB table exists', () => {
        const { db } = require('../database');
        const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='polls'").get();
        expect(result).toBeDefined();
    });
    
    test('leaderboard DB table exists', () => {
        const { db } = require('../database');
        const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leaderboard'").get();
        expect(result).toBeDefined();
    });
    
    test('networking_connections DB table exists', () => {
        const { db } = require('../database');
        const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='networking_connections'").get();
        expect(result).toBeDefined();
    });
    
    test('event_photos DB table exists', () => {
        const { db } = require('../database');
        const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='event_photos'").get();
        expect(result).toBeDefined();
    });
    
    test('certificate_templates DB table exists', () => {
        const { db } = require('../database');
        const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='certificate_templates'").get();
        expect(result).toBeDefined();
    });
    
    test('plugins DB table exists', () => {
        const { db } = require('../database');
        const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plugins'").get();
        expect(result).toBeDefined();
    });
});

describe('Check Pro API - Health Routes', () => {
    test('GET /api/health returns ok', async () => {
        const app = express();
        const versionRoutes = require('../src/routes/version.routes');
        app.use('/api', versionRoutes);
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
    
    test('GET /api/health/full returns system checks', async () => {
        const app = express();
        const versionRoutes = require('../src/routes/version.routes');
        app.use('/api', versionRoutes);
        const res = await request(app).get('/api/health/full');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('database');
        expect(res.body).toHaveProperty('disk');
        expect(res.body).toHaveProperty('memory');
        expect(res.body).toHaveProperty('responseTimeMs');
    });
});
