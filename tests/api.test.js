/**
 * Tests para el API de Check Pro
 * Usar: npm test
 */

const request = require('supertest');
const express = require('express');

describe('Check Pro API - Auth Middleware', () => {
    test('should export authMiddleware function', () => {
        const { authMiddleware } = require('../src/middleware/auth');
        expect(typeof authMiddleware).toBe('function');
    });
    
    test('should reject requests without token', () => {
        const { authMiddleware } = require('../src/middleware/auth');
        const req = { headers: {} };
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
        const { db } = require('../database');
        const { authMiddleware } = require('../src/middleware/auth');
        
        const admin = db.prepare('SELECT id FROM users WHERE role = ?').get('ADMIN');
        expect(admin).toBeDefined();
        
        const req = { headers: { 'x-user-id': admin.id } };
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
    
    test('should have smtp_config table', () => {
        const { db } = require('../database');
        const config = db.prepare('SELECT * FROM smtp_config WHERE id = 1').get();
        expect(config).toBeDefined();
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
    
    test('GET /api/settings/app-version returns version', async () => {
        const res = await request(app).get('/api/settings/app-version');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('version');
        expect(res.body.version).toBe('12.2.2');
    });
    
    test('GET /api/settings returns settings', async () => {
        const res = await request(app).get('/api/settings');
        expect(res.status).toBe(200);
        expect(typeof res.body).toBe('object');
    });
});
