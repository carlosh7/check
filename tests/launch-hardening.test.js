/**
 * Tests v12.44.819 — Protocolo de lanzamiento seguro (hallazgos N-3 y N-5):
 *   N-5 → captcha anti-bots: desafío de un solo uso y validación estricta.
 *   N-3 → borrado de cuenta self-service con anonimización (Ley 1581 arts. 8-15).
 * Patrón de BD temporal: mismo enfoque de tests/setup.test.js (worker propio,
 * DATA_PATH antes de require('../database')).
 */
const path = require('path');
const os = require('os');
const fs = require('fs');

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'check-launch-test-'));
process.env.DATA_PATH = TMP_DATA;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jwt-test-secret-launch-000000';
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD;

const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { generateToken } = require('../src/security/jwt');
const { generateCaptcha, verifyCaptcha } = require('../src/security/captcha');

// Los desafíos del captcha son del tipo "a + b", "a × b" o "a × b + c":
// se resuelven parseando la pregunta (el módulo no expone la respuesta).
function solveQuestion(q) {
    const hard = q.match(/(\d+)\s*×\s*(\d+)\s*\+\s*(\d+)/);
    if (hard) return Number(hard[1]) * Number(hard[2]) + Number(hard[3]);
    const mult = q.match(/(\d+)\s*×\s*(\d+)/);
    if (mult) return Number(mult[1]) * Number(mult[2]);
    const sum = q.match(/(\d+)\s*\+\s*(\d+)/);
    if (sum) return Number(sum[1]) + Number(sum[2]);
    return NaN;
}

// Sin contraseñas literales en el repo (regla GitGuardian v12.44.803).
const TEST_PASSWORD = 'Wz7' + uuidv4().replace(/-/g, '') + 'Qr';

afterAll(() => {
    try { db.close(); } catch { /* noop */ }
    try { fs.rmSync(TMP_DATA, { recursive: true, force: true }); } catch { /* noop */ }
});

describe('N-5: captcha anti-bots (módulo)', () => {
    test('un desafío resuelto correctamente valida UNA sola vez (anti-replay)', () => {
        const cap = generateCaptcha('test-ip-a');
        const answer = solveQuestion(cap.question);
        expect(Number.isFinite(answer)).toBe(true);
        expect(verifyCaptcha(cap.token, String(answer)).valid).toBe(true);
        expect(verifyCaptcha(cap.token, String(answer)).valid).toBe(false);
    });

    test('respuesta equivocada no valida', () => {
        const cap = generateCaptcha('test-ip-b');
        const answer = solveQuestion(cap.question);
        expect(verifyCaptcha(cap.token, String(answer + 1)).valid).toBe(false);
    });

    test('sin token o sin respuesta no valida', () => {
        expect(verifyCaptcha(null, '5').valid).toBe(false);
        const cap = generateCaptcha('test-ip-c');
        expect(verifyCaptcha(cap.token, '').valid).toBe(false);
    });
});

describe('N-3: borrado de cuenta self-service (POST /api/me/delete-account)', () => {
    let app;
    let productorToken;
    let productorId;
    const PRODUCTOR_EMAIL = `prod-${Date.now()}@test.local`;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api', require('../src/routes/auth.routes'));

        productorId = uuidv4();
        db.prepare(`INSERT INTO users (id, username, password, role, status, display_name, created_at)
                    VALUES (?, ?, ?, 'PRODUCTOR', 'APPROVED', 'Productor de Prueba', ?)`)
          .run(productorId, PRODUCTOR_EMAIL, bcrypt.hashSync(TEST_PASSWORD, 10), new Date().toISOString());
        productorToken = generateToken({ userId: productorId, username: PRODUCTOR_EMAIL, role: 'PRODUCTOR' });
    });

    test('rechaza sin contraseña', async () => {
        const res = await request(app)
            .post('/api/me/delete-account')
            .set('Authorization', `Bearer ${productorToken}`)
            .send({ confirmation: 'ELIMINAR' });
        expect(res.status).toBe(400);
    });

    test('rechaza contraseña incorrecta', async () => {
        const res = await request(app)
            .post('/api/me/delete-account')
            .set('Authorization', `Bearer ${productorToken}`)
            .send({ password: 'incorrecta-XX1', confirmation: 'ELIMINAR' });
        expect(res.status).toBe(401);
    });

    test('rechaza sin la frase de confirmación ELIMINAR', async () => {
        const res = await request(app)
            .post('/api/me/delete-account')
            .set('Authorization', `Bearer ${productorToken}`)
            .send({ password: TEST_PASSWORD, confirmation: 'borrar' });
        expect(res.status).toBe(400);
    });

    test('borra: anonimiza datos, estado DELETED y el token queda inutilizable', async () => {
        const res = await request(app)
            .post('/api/me/delete-account')
            .set('Authorization', `Bearer ${productorToken}`)
            .send({ password: TEST_PASSWORD, confirmation: 'ELIMINAR' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const row = db.prepare("SELECT username, display_name, status, password FROM users WHERE id = ?").get(productorId);
        expect(row.status).toBe('DELETED');
        expect(row.display_name).toBe('Usuario eliminado');
        expect(row.username).toMatch(/^eliminado\+[0-9a-f-]+@anulado\.local$/);
        expect(bcrypt.compareSync(TEST_PASSWORD, row.password)).toBe(false);

        // authMiddleware consulta el estado en cada petición: DELETED → sin acceso
        const me = await request(app).get('/api/me').set('Authorization', `Bearer ${productorToken}`);
        expect([401, 403]).toContain(me.status);
    });

    test('una cuenta ADMIN no puede autodestruirse (403 y sigue APPROVED)', async () => {
        const adminId = uuidv4();
        const adminEmail = `adm-${Date.now()}@test.local`;
        db.prepare(`INSERT INTO users (id, username, password, role, status, created_at)
                    VALUES (?, ?, ?, 'ADMIN', 'APPROVED', ?)`)
          .run(adminId, adminEmail, bcrypt.hashSync(TEST_PASSWORD, 10), new Date().toISOString());
        const adminToken = generateToken({ userId: adminId, username: adminEmail, role: 'ADMIN' });

        const res = await request(app)
            .post('/api/me/delete-account')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ password: TEST_PASSWORD, confirmation: 'ELIMINAR' });
        expect(res.status).toBe(403);

        const row = db.prepare("SELECT status FROM users WHERE id = ?").get(adminId);
        expect(row.status).toBe('APPROVED');
    });
});
