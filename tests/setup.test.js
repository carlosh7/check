/**
 * Tests del Wizard de Primer Arranque (v12.44.802)
 *
 * Estrategia: este archivo corre en su propio worker de Jest, así que definir
 * DATA_PATH antes de require('../database') crea una BD temporal limpia y
 * vacía — exactamente el estado de una instalación nueva donde el wizard
 * debe actuar. Sin ADMIN_EMAIL/ADMIN_PASSWORD en el entorno, NINGÚN usuario
 * debe existir de antemano (fin de las credenciales expuestas, hallazgo P1-2).
 */
const path = require('path');
const os = require('os');
const fs = require('fs');

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'check-setup-test-'));
process.env.DATA_PATH = TMP_DATA;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jwt-test-secret-setup-wizard-000000';
// Garantizar que ningún seed cree usuarios: el wizard es el único camino
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD;

const request = require('supertest');
const express = require('express');
const { db } = require('../database');

const ADMIN_PAYLOAD = {
    username: 'nuevo-admin@test.local',
    password: 'Clave-Segura-2026',
    display_name: 'Admin del Wizard'
};

afterAll(() => {
    try { db.close(); } catch { /* noop */ }
    try { fs.rmSync(TMP_DATA, { recursive: true, force: true }); } catch { /* noop */ }
});

describe('Setup Wizard: flujo de primer arranque', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/setup', require('../src/routes/setup.routes'));
        app.use('/api', require('../src/routes/auth.routes'));
    });

    test('BD limpia y sin seeds: no existe ningún usuario', () => {
        const count = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
        expect(count).toBe(0);
    });

    test('GET /api/setup/status → needsSetup true', async () => {
        const res = await request(app).get('/api/setup/status');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.needsSetup).toBe(true);
    });

    test('POST /api/setup/admin rechaza contraseña débil', async () => {
        const res = await request(app).post('/api/setup/admin').send({ ...ADMIN_PAYLOAD, password: 'corta123' });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        const count = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
        expect(count).toBe(0);
    });

    test('POST /api/setup/admin rechaza email inválido', async () => {
        const res = await request(app).post('/api/setup/admin').send({ ...ADMIN_PAYLOAD, username: 'no-es-un-email' });
        expect(res.status).toBe(400);
    });

    test('POST /api/setup/admin crea el primer admin APPROVED', async () => {
        const res = await request(app).post('/api/setup/admin').send(ADMIN_PAYLOAD);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);

        const row = db.prepare("SELECT * FROM users WHERE username = ?").get(ADMIN_PAYLOAD.username.toLowerCase());
        expect(row).toBeDefined();
        expect(row.role).toBe('ADMIN');
        expect(row.status).toBe('APPROVED');
    });

    test('Tras crear el admin: GET status → needsSetup false', async () => {
        const res = await request(app).get('/api/setup/status');
        expect(res.status).toBe(200);
        expect(res.body.needsSetup).toBe(false);
    });

    test('Segundo POST /api/setup/admin → 403 (wizard cerrado para siempre)', async () => {
        const res = await request(app).post('/api/setup/admin').send({
            username: 'intruso@test.local', password: 'Intento-2026-A', display_name: 'Intruso'
        });
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        const count = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
        expect(count).toBe(1);
    });

    test('Login funciona con el admin creado por el wizard', async () => {
        const res = await request(app).post('/api/login').send({
            username: ADMIN_PAYLOAD.username, password: ADMIN_PAYLOAD.password
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.role).toBe('ADMIN');
    });

    test('Signup ignora el role del cliente → siempre PRODUCTOR/PENDING', async () => {
        const res = await request(app).post('/api/signup').send({
            username: 'colado@test.local', password: 'Clave-Segura-2026', display_name: 'Colado', role: 'ADMIN'
        });
        expect(res.status).toBe(200);
        const row = db.prepare("SELECT * FROM users WHERE username = 'colado@test.local'").get();
        expect(row).toBeDefined();
        expect(row.role).toBe('PRODUCTOR');
        expect(row.status).toBe('PENDING');
    });
});

describe('Política de contraseñas (password-policy)', () => {
    const {
        validatePasswordStrength, isExposedPassword, MIN_LENGTH, getPasswordRules
    } = require('../src/security/password-policy');

    test(`exige mínimo ${MIN_LENGTH} caracteres`, () => {
        expect(validatePasswordStrength('Ab1x').valid).toBe(false);
        expect(validatePasswordStrength('Ab1'.padEnd(MIN_LENGTH - 1, 'x')).valid).toBe(false);
    });

    test('rechaza sin mayúscula / sin minúscula / sin número', () => {
        expect(validatePasswordStrength('clave-segura-123').valid).toBe(false);
        expect(validatePasswordStrength('CLAVE-SEGURA-123').valid).toBe(false);
        expect(validatePasswordStrength('Clave-Segura-XYZ').valid).toBe(false);
    });

    test('acepta una contraseña que cumple todo', () => {
        expect(validatePasswordStrength('Clave-Segura-2026').valid).toBe(true);
    });

    test('detecta las contraseñas expuestas del repo', () => {
        expect(isExposedPassword('admin123')).toBe(true);
        expect(isExposedPassword('changeme123')).toBe(true);
        expect(isExposedPassword('Clave-Segura-2026')).toBe(false);
    });

    test('rechaza las contraseñas expuestas como contraseña nueva', () => {
        expect(validatePasswordStrength('admin123').valid).toBe(false);
        expect(validatePasswordStrength('changeme123').valid).toBe(false);
    });

    test('getPasswordRules devuelve reglas legibles', () => {
        const rules = getPasswordRules();
        expect(Array.isArray(rules)).toBe(true);
        expect(rules.length).toBeGreaterThanOrEqual(3);
    });
});
