/**
 * Tests de la Tragamonedas (P4 — paridad AppSorteos — v12.44.834)
 * Cubre: CRUD, plantilla por defecto (6 premios con combinaciones de símbolos),
 * enlace compartido (solo publicadas), juego público con seguridad
 * (máx. por email, whitelist, dispositivo), probabilidades (chance 100% siempre
 * gana y devuelve SUS símbolos), cantidades (stock se descuenta), CSV y QR.
 *
 * Nota: el router se monta en /api/slots — TODAS las rutas de request()
 * llevan ese prefijo.
 */
require('dotenv').config();
const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { generateToken } = require('../src/security/jwt');

const slotsRoutes = require('../src/routes/slots.routes');

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/slots', slotsRoutes);
    return app;
}

function getAdminToken() {
    const admin = db.prepare("SELECT id, username, role FROM users WHERE role = 'ADMIN' LIMIT 1").get();
    if (!admin) return null;
    return generateToken({ userId: admin.id, username: admin.username, role: admin.role });
}

const eventId = uuidv4();
let slotId = null;
const adminToken = getAdminToken();

beforeAll(function() {
    db.prepare("INSERT OR IGNORE INTO events (id, user_id, name, date, status, created_at) VALUES (?, (SELECT id FROM users WHERE role='ADMIN' LIMIT 1), ?, ?, 'ACTIVE', ?)")
      .run(eventId, 'Evento Tragamonedas Test ' + Date.now(), '2026-12-20', new Date().toISOString());
});

afterAll(function() {
    if (slotId) {
        db.prepare("DELETE FROM slot_plays WHERE slot_id = ?").run(slotId);
        db.prepare("DELETE FROM slot_prizes WHERE slot_id = ?").run(slotId);
        db.prepare("DELETE FROM slots WHERE id = ?").run(slotId);
        slotId = null;
    }
    db.prepare("DELETE FROM events WHERE id = ?").run(eventId);
});

describe('Tragamonedas CRUD', () => {
    test('crea una tragamonedas con plantilla por defecto (config + 6 premios con símbolos)', async () => {
        if (!adminToken) return;
        const res = await request(createTestApp())
            .post('/api/slots/events/' + eventId + '/slots')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ name: 'Tragamonedas TEST' });
        expect(res.status).toBe(200);
        expect(res.body.id).toBeTruthy();
        slotId = res.body.id;
        const get = await request(createTestApp())
            .get('/api/slots/' + slotId)
            .set('Authorization', 'Bearer ' + adminToken);
        expect(get.status).toBe(200);
        expect(get.body.prizes.length).toBe(6);
        expect(get.body.config.texts.title).toBeTruthy();
        expect(get.body.config.texts.button).toBe('Jalar Palanca');
        expect(get.body.config.security.max_per_email).toBe(1);
        expect(get.body.config.design.machine_color).toBeTruthy();
        expect(get.body.config.design.machine_style).toBe('rounded');
        // cada premio de la plantilla trae SU combinación de 3 símbolos
        get.body.prizes.forEach(p => expect(p.symbols.length).toBe(3));
        const siete = get.body.prizes.find(p => p.label === '20% de descuento');
        expect(siete.symbols).toEqual(['7️⃣', '7️⃣', '7️⃣']);
        const tipos = get.body.prizes.map(p => p.type);
        expect(tipos).toContain('cupon');
        expect(tipos).toContain('sin_premio');
    });

    test('rechaza crear sin nombre y sin token', async () => {
        if (!adminToken) return;
        const r1 = await request(createTestApp())
            .post('/api/slots/events/' + eventId + '/slots')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({});
        expect(r1.status).toBe(400);
        const r2 = await request(createTestApp())
            .post('/api/slots/events/' + eventId + '/slots')
            .send({ name: 'x' });
        expect(r2.status).toBe(401);
    });

    test('rechaza premios inválidos (cupón sin valor, 1 premio, símbolos no-array)', async () => {
        if (!adminToken || !slotId) return;
        const r1 = await request(createTestApp())
            .put('/api/slots/' + slotId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ prizes: [{ type: 'cupon', label: 'X', value: '' }] });
        expect(r1.status).toBe(400);
        const r2 = await request(createTestApp())
            .put('/api/slots/' + slotId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ prizes: [{ type: 'premio', label: 'Único', value: '' }] });
        expect(r2.status).toBe(400);
        const r3 = await request(createTestApp())
            .put('/api/slots/' + slotId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ prizes: [{ type: 'premio', label: 'A', value: '', symbols: '🍒🍒🍒' }, { type: 'sin_premio', label: 'B', value: '' }] });
        expect(r3.status).toBe(400);
        expect(r3.body.error).toMatch(/Símbolos/i);
    });

    test('publica con premios personalizados (los que llegan sin símbolos reciben la combinación por defecto)', async () => {
        if (!adminToken || !slotId) return;
        const res = await request(createTestApp())
            .put('/api/slots/' + slotId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({
                name: 'Tragamonedas TEST',
                status: 'published',
                config: { limit_chances: true, security: { max_per_email: 1, allowed_emails: [], device_limit: 'off' } },
                prizes: [
                    { type: 'premio', label: 'Gran Premio', value: '', chance: 100, symbols: ['💎', '💎', '💎'] },
                    { type: 'sin_premio', label: '¡Sigue intentando!', value: '', chance: 0 }
                ]
            });
        expect(res.status).toBe(200);
        const get = await request(createTestApp()).get('/api/slots/' + slotId).set('Authorization', 'Bearer ' + adminToken);
        expect(get.body.status).toBe('published');
        expect(get.body.prizes.length).toBe(2);
        expect(get.body.prizes[0].symbols).toEqual(['💎', '💎', '💎']);
        // el premio sin símbolos recibió la combinación por defecto
        expect(get.body.prizes[1].symbols).toEqual(['🍒', '🍋', '🔔']);
    });

    test('public-editor funciona sin login para publicadas (con valores de cupón y símbolos)', async () => {
        if (!slotId) return;
        // publicar con un cupón que tenga valor — el editor por enlace necesita los valores
        await request(createTestApp())
            .put('/api/slots/' + slotId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({
                config: { limit_chances: true, security: { max_per_email: 1, allowed_emails: [], device_limit: 'off' } },
                prizes: [
                    { type: 'cupon', label: 'Gran Premio', value: 'SAVE50', chance: 100, symbols: ['7️⃣', '7️⃣', '7️⃣'] },
                    { type: 'sin_premio', label: '¡Sigue intentando!', value: '', chance: 0, symbols: ['🍒', '🍒', '🍋'] }
                ]
            });
        const res = await request(createTestApp()).get('/api/slots/' + slotId + '/public-editor');
        expect(res.status).toBe(200);
        const cupon = res.body.prizes.find(p => p.type === 'cupon');
        expect(cupon).toBeTruthy();
        expect(cupon.value).toBe('SAVE50');
        expect(cupon.symbols).toEqual(['7️⃣', '7️⃣', '7️⃣']);
    });
});

describe('Juego público y seguridad', () => {
    test('public devuelve segmentos SIN valores ni símbolos y suma vistas', async () => {
        if (!slotId) return;
        const res = await request(createTestApp()).get('/api/slots/' + slotId + '/public');
        expect(res.status).toBe(200);
        expect(res.body.segments.length).toBe(2);
        expect(res.body.segments.every(s => !s.value && !s.type && !s.symbols)).toBe(true);
        const res2 = await request(createTestApp()).get('/api/slots/' + slotId + '/public');
        expect(res2.body.views).toBeGreaterThan(res.body.views);
    });

    test('403 si no está publicada (comprobando con una borrador nueva)', async () => {
        if (!adminToken) return;
        const cr = await request(createTestApp())
            .post('/api/slots/events/' + eventId + '/slots')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ name: 'Borrador TEST' });
        const draftId = cr.body.id;
        const res = await request(createTestApp()).get('/api/slots/' + draftId + '/public');
        expect(res.status).toBe(403);
        await request(createTestApp())
            .delete('/api/slots/' + draftId)
            .set('Authorization', 'Bearer ' + adminToken);
    });

    test('jugar: chance 100% gana siempre y devuelve los SÍMBOLOS del premio elegido', async () => {
        if (!slotId) return;
        const res = await request(createTestApp())
            .post('/api/slots/' + slotId + '/play')
            .send({ email: 'ana@test.com', name: 'Ana', deviceId: 'dev-1' });
        expect(res.status).toBe(200);
        expect(res.body.prize.win).toBe(true);
        expect(res.body.prize.label).toBe('Gran Premio');
        expect(res.body.symbols).toEqual(['7️⃣', '7️⃣', '7️⃣']);
        expect(res.body.symbols.length).toBe(3);
        expect(res.body.playId).toBeTruthy();
    });

    test('seguridad: máximo de participaciones por email (1)', async () => {
        if (!slotId) return;
        const res = await request(createTestApp())
            .post('/api/slots/' + slotId + '/play')
            .send({ email: 'ana@test.com' });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Ya participaste/i);
    });

    test('seguridad: whitelist de emails', async () => {
        if (!adminToken || !slotId) return;
        await request(createTestApp())
            .put('/api/slots/' + slotId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ config: { limit_chances: true, security: { max_per_email: 1, allowed_emails: ['vip@test.com'], device_limit: 'off' } } });
        const res = await request(createTestApp())
            .post('/api/slots/' + slotId + '/play')
            .send({ email: 'intruso@test.com' });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/permitidos/i);
        const ok = await request(createTestApp())
            .post('/api/slots/' + slotId + '/play')
            .send({ email: 'VIP@test.com', deviceId: 'dev-2' });
        expect(ok.status).toBe(200);
    });

    test('seguridad: límite por dispositivo (IP no cuenta cuando es browser)', async () => {
        if (!adminToken || !slotId) return;
        // sin whitelist ahora
        await request(createTestApp())
            .put('/api/slots/' + slotId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ config: { limit_chances: true, security: { max_per_email: 5, allowed_emails: [], device_limit: 'browser', device_max: 1 } } });
        const r1 = await request(createTestApp())
            .post('/api/slots/' + slotId + '/play')
            .send({ email: 'dev1@test.com', deviceId: 'mismo-device' });
        expect(r1.status).toBe(200);
        const r2 = await request(createTestApp())
            .post('/api/slots/' + slotId + '/play')
            .send({ email: 'dev2@test.com', deviceId: 'mismo-device' });
        expect(r2.status).toBe(403);
        expect(r2.body.error).toMatch(/dispositivo/i);
        const r3 = await request(createTestApp())
            .post('/api/slots/' + slotId + '/play')
            .send({ email: 'dev3@test.com', deviceId: 'otro-device' });
        expect(r3.status).toBe(200);
    });

    test('limitar cantidades: el stock se descuenta y el agotado deja de salir', async () => {
        if (!adminToken || !slotId) return;
        // configurar: 1 premio con stock 1 y chance 100%, otro sin stock
        await request(createTestApp())
            .put('/api/slots/' + slotId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({
                config: { limit_chances: true, limit_quantities: true, security: { max_per_email: 99, allowed_emails: [], device_limit: 'off' } },
                prizes: [
                    { type: 'premio', label: 'Stock Único', value: '', chance: 100, quantity: 1, symbols: ['🔔', '🔔', '🔔'] },
                    { type: 'sin_premio', label: 'Sin suerte', value: '', chance: 0, symbols: ['🍋', '🍋', '🍒'] }
                ]
            });
        const r1 = await request(createTestApp())
            .post('/api/slots/' + slotId + '/play')
            .send({ email: 'stock1@test.com' });
        expect(r1.status).toBe(200);
        expect(r1.body.prize.label).toBe('Stock Único');
        expect(r1.body.symbols).toEqual(['🔔', '🔔', '🔔']);
        const r2 = await request(createTestApp())
            .post('/api/slots/' + slotId + '/play')
            .send({ email: 'stock2@test.com' });
        // stock agotado: queda solo la combinación sin premio (chance 0 → fallback uniforme)
        expect(r2.status).toBe(200);
        expect(r2.body.prize.win).toBe(false);
        const get = await request(createTestApp()).get('/api/slots/' + slotId).set('Authorization', 'Bearer ' + adminToken);
        const stockPrize = get.body.prizes.find(p => p.label === 'Stock Único');
        expect(stockPrize.quantity).toBe(0);
    });

    test('leads (con combinación) y CSV con BOM', async () => {
        if (!adminToken || !slotId) return;
        const leads = await request(createTestApp())
            .get('/api/slots/' + slotId + '/leads')
            .set('Authorization', 'Bearer ' + adminToken);
        expect(leads.status).toBe(200);
        expect(leads.body.length).toBeGreaterThanOrEqual(3);
        expect(leads.body[0].email).toBeTruthy();
        const conSyms = leads.body.find(p => Array.isArray(p.symbols) && p.symbols.length === 3);
        expect(conSyms).toBeTruthy();
        const csv = await request(createTestApp())
            .get('/api/slots/' + slotId + '/export-csv')
            .set('Authorization', 'Bearer ' + adminToken);
        expect(csv.status).toBe(200);
        expect(csv.text).toContain('\uFEFF');
        expect(csv.text).toMatch(/email,nombre/);
        expect(csv.text).toMatch(/combinacion/);
        const noAuth = await request(createTestApp()).get('/api/slots/' + slotId + '/export-csv');
        expect(noAuth.status).toBe(401);
    });

    test('QR responde PNG y comprobante PDF de una jugada real', async () => {
        if (!adminToken || !slotId) return;
        const qr = await request(createTestApp()).get('/api/slots/' + slotId + '/qr');
        expect(qr.status).toBe(200);
        expect(qr.headers['content-type']).toMatch(/image\/png/);
        const leads = await request(createTestApp())
            .get('/api/slots/' + slotId + '/leads')
            .set('Authorization', 'Bearer ' + adminToken);
        const playId = leads.body[0].id;
        const cert = await request(createTestApp())
            .get('/api/slots/' + slotId + '/certificate?play=' + playId);
        expect(cert.status).toBe(200);
        expect(cert.headers['content-type']).toMatch(/application\/pdf/);
        const certBad = await request(createTestApp())
            .get('/api/slots/' + slotId + '/certificate?play=no-existe');
        expect(certBad.status).toBe(404);
    });

    test('public-config desde enlace guarda premios (auditado)', async () => {
        if (!slotId) return;
        const res = await request(createTestApp())
            .put('/api/slots/' + slotId + '/public-config')
            .send({
                config: { texts: { title: 'Editada desde el enlace' } },
                prizes: [
                    { type: 'cupon', label: '10% OFF', value: 'OFF10', symbols: ['7️⃣', '🍋', '🔔'] },
                    { type: 'sin_premio', label: 'Suerte!', value: '' }
                ]
            });
        expect(res.status).toBe(200);
        const pub = await request(createTestApp()).get('/api/slots/' + slotId + '/public');
        expect(pub.body.segments.map(s => s.label)).toContain('10% OFF');
    });

    test('DELETE elimina todo en cascada', async () => {
        if (!adminToken || !slotId) return;
        const res = await request(createTestApp())
            .delete('/api/slots/' + slotId)
            .set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
        const q = db.prepare("SELECT id FROM slots WHERE id = ?").get(slotId);
        expect(q).toBeUndefined();
        const plays = db.prepare("SELECT COUNT(*) as c FROM slot_plays WHERE slot_id = ?").get(slotId);
        expect(plays.c).toBe(0);
        slotId = null;
    });
});
