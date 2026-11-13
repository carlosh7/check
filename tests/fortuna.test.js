/**
 * Tests de la Ruleta de la Fortuna (P1 — paridad AppSorteos — v12.44.833)
 * Cubre: CRUD, plantilla por defecto, enlace compartido (solo publicadas),
 * juego público con seguridad (máx. por email, whitelist, dispositivo),
 * probabilidades (chance 100% siempre gana), cantidades (stock se descuenta),
 * CSV y QR.
 *
 * Nota: el router se monta en /api/fortunas — TODAS las rutas de request()
 * llevan ese prefijo.
 */
require('dotenv').config();
const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { generateToken } = require('../src/security/jwt');

const fortunasRoutes = require('../src/routes/fortunas.routes');

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/fortunas', fortunasRoutes);
    return app;
}

function getAdminToken() {
    const admin = db.prepare("SELECT id, username, role FROM users WHERE role = 'ADMIN' LIMIT 1").get();
    if (!admin) return null;
    return generateToken({ userId: admin.id, username: admin.username, role: admin.role });
}

const eventId = uuidv4();
let fortunaId = null;
const adminToken = getAdminToken();

beforeAll(function() {
    db.prepare("INSERT OR IGNORE INTO events (id, user_id, name, date, status, created_at) VALUES (?, (SELECT id FROM users WHERE role='ADMIN' LIMIT 1), ?, ?, 'ACTIVE', ?)")
      .run(eventId, 'Evento Fortuna Test ' + Date.now(), '2026-12-20', new Date().toISOString());
});

afterAll(function() {
    if (fortunaId) {
        db.prepare("DELETE FROM fortuna_plays WHERE fortuna_id = ?").run(fortunaId);
        db.prepare("DELETE FROM fortuna_prizes WHERE fortuna_id = ?").run(fortunaId);
        db.prepare("DELETE FROM fortunas WHERE id = ?").run(fortunaId);
        fortunaId = null;
    }
    db.prepare("DELETE FROM events WHERE id = ?").run(eventId);
});

describe('Fortuna CRUD', () => {
    test('crea una fortuna con plantilla por defecto (config + 6 premios)', async () => {
        if (!adminToken) return;
        const res = await request(createTestApp())
            .post('/api/fortunas/events/' + eventId + '/fortunas')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ name: 'Ruleta de Premios TEST' });
        expect(res.status).toBe(200);
        expect(res.body.id).toBeTruthy();
        fortunaId = res.body.id;
        const get = await request(createTestApp())
            .get('/api/fortunas/' + fortunaId)
            .set('Authorization', 'Bearer ' + adminToken);
        expect(get.status).toBe(200);
        expect(get.body.prizes.length).toBe(6);
        expect(get.body.config.texts.title).toBeTruthy();
        expect(get.body.config.security.max_per_email).toBe(1);
        const tipos = get.body.prizes.map(p => p.type);
        expect(tipos).toContain('cupon');
        expect(tipos).toContain('sin_premio');
    });

    test('rechaza crear sin nombre y sin token', async () => {
        if (!adminToken) return;
        const r1 = await request(createTestApp())
            .post('/api/fortunas/events/' + eventId + '/fortunas')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({});
        expect(r1.status).toBe(400);
        const r2 = await request(createTestApp())
            .post('/api/fortunas/events/' + eventId + '/fortunas')
            .send({ name: 'x' });
        expect(r2.status).toBe(401);
    });

    test('rechaza premios inválidos (cupón sin valor, 1 sección)', async () => {
        if (!adminToken || !fortunaId) return;
        const r1 = await request(createTestApp())
            .put('/api/fortunas/' + fortunaId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ prizes: [{ type: 'cupon', label: 'X', value: '' }] });
        expect(r1.status).toBe(400);
        const r2 = await request(createTestApp())
            .put('/api/fortunas/' + fortunaId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ prizes: [{ type: 'premio', label: 'Único', value: '' }] });
        expect(r2.status).toBe(400);
    });

    test('publica con premios personalizados', async () => {
        if (!adminToken || !fortunaId) return;
        const res = await request(createTestApp())
            .put('/api/fortunas/' + fortunaId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({
                name: 'Ruleta de Premios TEST',
                status: 'published',
                config: { limit_chances: true, security: { max_per_email: 1, allowed_emails: [], device_limit: 'off' } },
                prizes: [
                    { type: 'premio', label: 'Gran Premio', value: '', chance: 100 },
                    { type: 'sin_premio', label: '¡Sigue intentando!', value: '', chance: 0 }
                ]
            });
        expect(res.status).toBe(200);
        const get = await request(createTestApp()).get('/api/fortunas/' + fortunaId).set('Authorization', 'Bearer ' + adminToken);
        expect(get.body.status).toBe('published');
        expect(get.body.prizes.length).toBe(2);
    });

    test('public-editor funciona sin login para publicadas (con valores de cupón)', async () => {
        if (!fortunaId) return;
        // publicar con un cupón que tenga valor — el editor por enlace necesita los valores
        await request(createTestApp())
            .put('/api/fortunas/' + fortunaId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({
                config: { limit_chances: true, security: { max_per_email: 1, allowed_emails: [], device_limit: 'off' } },
                prizes: [
                    { type: 'cupon', label: 'Gran Premio', value: 'SAVE50', chance: 100 },
                    { type: 'sin_premio', label: '¡Sigue intentando!', value: '', chance: 0 }
                ]
            });
        const res = await request(createTestApp()).get('/api/fortunas/' + fortunaId + '/public-editor');
        expect(res.status).toBe(200);
        const cupon = res.body.prizes.find(p => p.type === 'cupon');
        expect(cupon).toBeTruthy();
        expect(cupon.value).toBe('SAVE50');
    });
});

describe('Juego público y seguridad', () => {
    test('public devuelve segmentos SIN valores y suma vistas', async () => {
        if (!fortunaId) return;
        const res = await request(createTestApp()).get('/api/fortunas/' + fortunaId + '/public');
        expect(res.status).toBe(200);
        expect(res.body.segments.length).toBe(2);
        expect(res.body.segments.every(s => !s.value && !s.type)).toBe(true);
        const res2 = await request(createTestApp()).get('/api/fortunas/' + fortunaId + '/public');
        expect(res2.body.views).toBeGreaterThan(res.body.views);
    });

    test('403 si no está publicada (comprobando con una borrador nueva)', async () => {
        if (!adminToken) return;
        const cr = await request(createTestApp())
            .post('/api/fortunas/events/' + eventId + '/fortunas')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ name: 'Borrador TEST' });
        const draftId = cr.body.id;
        const res = await request(createTestApp()).get('/api/fortunas/' + draftId + '/public');
        expect(res.status).toBe(403);
        await request(createTestApp())
            .delete('/api/fortunas/' + draftId)
            .set('Authorization', 'Bearer ' + adminToken);
    });

    test('jugar: chance 100% gana siempre el Gran Premio', async () => {
        if (!fortunaId) return;
        const res = await request(createTestApp())
            .post('/api/fortunas/' + fortunaId + '/play')
            .send({ email: 'ana@test.com', name: 'Ana', deviceId: 'dev-1' });
        expect(res.status).toBe(200);
        expect(res.body.prize.win).toBe(true);
        expect(res.body.prize.label).toBe('Gran Premio');
        expect(res.body.segmentIndex).toBe(0);
        expect(res.body.playId).toBeTruthy();
    });

    test('seguridad: máximo de participaciones por email (1)', async () => {
        if (!fortunaId) return;
        const res = await request(createTestApp())
            .post('/api/fortunas/' + fortunaId + '/play')
            .send({ email: 'ana@test.com' });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Ya participaste/i);
    });

    test('seguridad: whitelist de emails', async () => {
        if (!adminToken || !fortunaId) return;
        await request(createTestApp())
            .put('/api/fortunas/' + fortunaId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ config: { limit_chances: true, security: { max_per_email: 1, allowed_emails: ['vip@test.com'], device_limit: 'off' } } });
        const res = await request(createTestApp())
            .post('/api/fortunas/' + fortunaId + '/play')
            .send({ email: 'intruso@test.com' });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/permitidos/i);
        const ok = await request(createTestApp())
            .post('/api/fortunas/' + fortunaId + '/play')
            .send({ email: 'VIP@test.com', deviceId: 'dev-2' });
        expect(ok.status).toBe(200);
    });

    test('seguridad: límite por dispositivo (IP no cuenta cuando es browser)', async () => {
        if (!adminToken || !fortunaId) return;
        // sin whitelist ahora
        await request(createTestApp())
            .put('/api/fortunas/' + fortunaId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ config: { limit_chances: true, security: { max_per_email: 5, allowed_emails: [], device_limit: 'browser', device_max: 1 } } });
        const r1 = await request(createTestApp())
            .post('/api/fortunas/' + fortunaId + '/play')
            .send({ email: 'dev1@test.com', deviceId: 'mismo-device' });
        expect(r1.status).toBe(200);
        const r2 = await request(createTestApp())
            .post('/api/fortunas/' + fortunaId + '/play')
            .send({ email: 'dev2@test.com', deviceId: 'mismo-device' });
        expect(r2.status).toBe(403);
        expect(r2.body.error).toMatch(/dispositivo/i);
        const r3 = await request(createTestApp())
            .post('/api/fortunas/' + fortunaId + '/play')
            .send({ email: 'dev3@test.com', deviceId: 'otro-device' });
        expect(r3.status).toBe(200);
    });

    test('limitar cantidades: el stock se descuenta y el agotado deja de salir', async () => {
        if (!adminToken || !fortunaId) return;
        // configurar: 1 premio con stock 1 y chance 100%, otro sin stock
        await request(createTestApp())
            .put('/api/fortunas/' + fortunaId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({
                config: { limit_chances: true, limit_quantities: true, security: { max_per_email: 99, allowed_emails: [], device_limit: 'off' } },
                prizes: [
                    { type: 'premio', label: 'Stock Único', value: '', chance: 100, quantity: 1 },
                    { type: 'sin_premio', label: 'Sin suerte', value: '', chance: 0 }
                ]
            });
        const r1 = await request(createTestApp())
            .post('/api/fortunas/' + fortunaId + '/play')
            .send({ email: 'stock1@test.com' });
        expect(r1.status).toBe(200);
        expect(r1.body.prize.label).toBe('Stock Único');
        const r2 = await request(createTestApp())
            .post('/api/fortunas/' + fortunaId + '/play')
            .send({ email: 'stock2@test.com' });
        // stock agotado: queda solo la sección sin premio (chance 0 → fallback uniforme)
        expect(r2.status).toBe(200);
        expect(r2.body.prize.win).toBe(false);
        const get = await request(createTestApp()).get('/api/fortunas/' + fortunaId).set('Authorization', 'Bearer ' + adminToken);
        const stockPrize = get.body.prizes.find(p => p.label === 'Stock Único');
        expect(stockPrize.quantity).toBe(0);
    });

    test('leads y CSV', async () => {
        if (!adminToken || !fortunaId) return;
        const leads = await request(createTestApp())
            .get('/api/fortunas/' + fortunaId + '/leads')
            .set('Authorization', 'Bearer ' + adminToken);
        expect(leads.status).toBe(200);
        expect(leads.body.length).toBeGreaterThanOrEqual(3);
        expect(leads.body[0].email).toBeTruthy();
        const csv = await request(createTestApp())
            .get('/api/fortunas/' + fortunaId + '/export-csv')
            .set('Authorization', 'Bearer ' + adminToken);
        expect(csv.status).toBe(200);
        expect(csv.text).toContain('\uFEFF');
        expect(csv.text).toMatch(/email,nombre/);
        const noAuth = await request(createTestApp()).get('/api/fortunas/' + fortunaId + '/export-csv');
        expect(noAuth.status).toBe(401);
    });

    test('QR responde PNG y comprobante PDF de una jugada real', async () => {
        if (!adminToken || !fortunaId) return;
        const qr = await request(createTestApp()).get('/api/fortunas/' + fortunaId + '/qr');
        expect(qr.status).toBe(200);
        expect(qr.headers['content-type']).toMatch(/image\/png/);
        const leads = await request(createTestApp())
            .get('/api/fortunas/' + fortunaId + '/leads')
            .set('Authorization', 'Bearer ' + adminToken);
        const playId = leads.body[0].id;
        const cert = await request(createTestApp())
            .get('/api/fortunas/' + fortunaId + '/certificate?play=' + playId);
        expect(cert.status).toBe(200);
        expect(cert.headers['content-type']).toMatch(/application\/pdf/);
        const certBad = await request(createTestApp())
            .get('/api/fortunas/' + fortunaId + '/certificate?play=no-existe');
        expect(certBad.status).toBe(404);
    });

    test('public-config desde enlace guarda premios (auditado)', async () => {
        if (!fortunaId) return;
        const res = await request(createTestApp())
            .put('/api/fortunas/' + fortunaId + '/public-config')
            .send({
                config: { texts: { title: 'Editada desde el enlace' } },
                prizes: [
                    { type: 'cupon', label: '10% OFF', value: 'OFF10' },
                    { type: 'sin_premio', label: 'Suerte!', value: '' }
                ]
            });
        expect(res.status).toBe(200);
        const pub = await request(createTestApp()).get('/api/fortunas/' + fortunaId + '/public');
        expect(pub.body.segments.map(s => s.label)).toContain('10% OFF');
    });

    test('DELETE elimina todo en cascada', async () => {
        if (!adminToken || !fortunaId) return;
        const res = await request(createTestApp())
            .delete('/api/fortunas/' + fortunaId)
            .set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
        const q = db.prepare("SELECT id FROM fortunas WHERE id = ?").get(fortunaId);
        expect(q).toBeUndefined();
        const plays = db.prepare("SELECT COUNT(*) as c FROM fortuna_plays WHERE fortuna_id = ?").get(fortunaId);
        expect(plays.c).toBe(0);
        fortunaId = null;
    });
});
