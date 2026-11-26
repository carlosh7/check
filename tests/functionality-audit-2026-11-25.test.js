/**
 * Tests de funcionalidad — auditoría externa 2026-11-25 (v12.44.848)
 * Fija los arreglos de la Fase 3: check-in de invitados que solo existen en la BD del evento (D4),
 * control de acceso por evento en el resto de routers (S11), sin doble conteo en estadísticas (D7),
 * borrado de la BD del evento al borrar el evento (D5), sesiones/ponentes (D9), certificados PDF (N2),
 * tenants (N17), resultados públicos de sondeos (N4) y varias comprobaciones estáticas de frontend.
 */
require('dotenv').config();
const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { generateToken } = require('../src/security/jwt');
const dm = require('../src/utils/database-manager');

const guestsRoutes = require('../src/routes/guests.routes');
const eventsRoutes = require('../src/routes/events.routes');
const statsRoutes = require('../src/routes/stats.routes');
const certificatesRoutes = require('../src/routes/certificates.routes');
const tenantsRoutes = require('../src/routes/tenants.routes');
const pollsRoutes = require('../src/routes/polls.routes');
const sessionsRoutes = require('../src/routes/sessions.routes');
const quizzesRoutes = require('../src/routes/quizzes.routes');

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/guests', guestsRoutes);
    app.use('/api/events', eventsRoutes);
    app.use('/api', statsRoutes);
    app.use('/api/certificates', certificatesRoutes);
    app.use('/', tenantsRoutes);
    app.use('/api/polls', pollsRoutes);
    app.use('/api/sessions', sessionsRoutes);
    app.use('/api/quizzes', quizzesRoutes);
    return app;
}
const app = createTestApp();
const call = (method, url, token, body) => request(app)[method](url).set('Authorization', 'Bearer ' + token).send(body);

const tag = Date.now();
const admin = db.prepare("SELECT id, username, role FROM users WHERE role = 'ADMIN' AND status = 'APPROVED' LIMIT 1").get();
const adminToken = generateToken({ userId: admin.id, username: admin.username, role: admin.role });
const prod = { id: uuidv4(), username: `qa-func-${tag}@test.local` };
const ownEvent = { id: uuidv4(), name: `QA-FUNC propio ${tag}` };
const otherEvent = { id: uuidv4(), name: `QA-FUNC ajeno ${tag}` };
const tempEvent = { id: uuidv4(), name: `QA-FUNC temporal ${tag}` };
const gOnlyEvent = { id: uuidv4(), email: `qa-solo-evento-${tag}@test.local` };   // vive solo en la BD del evento
const gBoth = { id: uuidv4(), email: `qa-ambas-${tag}@test.local` };              // vive en las dos BDs
const gOther = { id: uuidv4(), email: `qa-ajeno-${tag}@test.local` };
let prodToken = null;
const eventDbFile = (id) => path.join(__dirname, '..', 'data', 'events', id + '.db');
const insertGuest = (conn, g, eventId) => conn.prepare("INSERT INTO guests (id, event_id, name, email, qr_token, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(g.id, eventId, 'QA ' + g.email, g.email, 'qr-' + g.id, new Date().toISOString());

beforeAll(function() {
    db.prepare("INSERT INTO users (id, username, password, role, display_name, status, created_at) VALUES (?, ?, ?, 'PRODUCTOR', 'QA Funcionalidad', 'APPROVED', ?)").run(prod.id, prod.username, bcrypt.hashSync('QaPass12345', 10), new Date().toISOString());
    db.prepare("INSERT INTO events (id, user_id, name, date, status, created_at, has_own_db) VALUES (?, ?, ?, '2026-12-01', 'ACTIVE', ?, 1)").run(ownEvent.id, prod.id, ownEvent.name, new Date().toISOString());
    db.prepare("INSERT INTO events (id, user_id, name, date, status, created_at) VALUES (?, ?, ?, '2026-12-01', 'ACTIVE', ?)").run(otherEvent.id, admin.id, otherEvent.name, new Date().toISOString());
    db.prepare("INSERT INTO events (id, user_id, name, date, status, created_at, has_own_db) VALUES (?, ?, ?, '2026-12-01', 'ACTIVE', ?, 1)").run(tempEvent.id, prod.id, tempEvent.name, new Date().toISOString());
    dm.createEventDatabase(ownEvent.id);
    dm.createEventDatabase(tempEvent.id);
    const edb = dm.getEventConnection(ownEvent.id);
    insertGuest(edb, gOnlyEvent, ownEvent.id);
    insertGuest(edb, gBoth, ownEvent.id);
    insertGuest(db, gBoth, ownEvent.id);
    insertGuest(db, gOther, otherEvent.id);
    prodToken = generateToken({ userId: prod.id, username: prod.username, role: 'PRODUCTOR' });
});

afterAll(function() {
    const clean = (sql, ...p) => { try { db.prepare(sql).run(...p); } catch (e) {} };
    clean("DELETE FROM guests WHERE id IN (?, ?, ?)", gOnlyEvent.id, gBoth.id, gOther.id);
    clean("DELETE FROM events WHERE id IN (?, ?, ?)", ownEvent.id, otherEvent.id, tempEvent.id);
    clean("DELETE FROM users WHERE id = ?", prod.id);
    dm.closeAllConnections();
    for (const id of [ownEvent.id, tempEvent.id]) { try { fs.unlinkSync(eventDbFile(id)); } catch (e) {} }
});

describe('D4 — check-in de un invitado que solo existe en la BD del evento', () => {
    test('ya no da 404 y se puede deshacer', async () => {
        const first = await call('post', `/api/guests/checkin/${gOnlyEvent.id}`, prodToken, { eventId: ownEvent.id });
        expect(first.status).toBe(200);
        expect(first.body.action).toBe('checkin');
        const edb = dm.getEventConnection(ownEvent.id);
        expect(edb.prepare('SELECT checked_in FROM guests WHERE id = ?').get(gOnlyEvent.id).checked_in).toBe(1);
        const undo = await call('post', `/api/guests/checkin/${gOnlyEvent.id}`, prodToken, { eventId: ownEvent.id });
        expect(undo.status).toBe(200);
        expect(undo.body.action).toBe('uncheckin');
        expect(edb.prepare('SELECT checked_in FROM guests WHERE id = ?').get(gOnlyEvent.id).checked_in).toBe(0);
    });
});

describe('S11 — control de acceso por evento en el resto de routers', () => {
    test('un PRODUCTOR no hace check-in en un evento ajeno', async () => {
        const res = await call('post', `/api/guests/checkin/${gOther.id}`, prodToken, {});
        expect(res.status).toBe(403);
    });
    test('ni lista los quizzes de un evento ajeno', async () => {
        const res = await call('get', `/api/quizzes/events/${otherEvent.id}/quizzes`, prodToken);
        expect(res.status).toBe(403);
    });
    test('ni crea sesiones en un evento ajeno', async () => {
        const res = await call('post', `/api/sessions/${otherEvent.id}`, prodToken, { title: 'Intruso' });
        expect(res.status).toBe(403);
    });
    test('el ADMIN pasa siempre', async () => {
        const res = await call('get', `/api/quizzes/events/${otherEvent.id}/quizzes`, adminToken);
        expect(res.status).toBe(200);
    });
});

describe('D7 — estadísticas sin contar dos veces al mismo invitado', () => {
    test('el total cuenta una sola vez al invitado que está en las dos BDs', async () => {
        const res = await call('get', `/api/stats/${ownEvent.id}`, prodToken);
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(2); // gOnlyEvent + gBoth (no 3)
    });
});

describe('D9 — borrar una sesión ya no da 500', () => {
    test('crear y borrar una sesión en un evento con BD propia', async () => {
        const created = await call('post', `/api/sessions/${ownEvent.id}`, prodToken, { title: 'Sesión QA', speaker_ids: [] });
        expect([200, 201]).toContain(created.status);
        const sessionId = created.body.id || (created.body.session && created.body.session.id);
        expect(sessionId).toBeTruthy();
        const deleted = await call('delete', `/api/sessions/${ownEvent.id}/${sessionId}`, prodToken);
        expect(deleted.status).toBe(200);
    });
});

describe('D5 — al borrar un evento se elimina su BD', () => {
    test('el archivo data/events/<id>.db desaparece', async () => {
        expect(fs.existsSync(eventDbFile(tempEvent.id))).toBe(true);
        const res = await call('delete', `/api/events/${tempEvent.id}`, prodToken);
        expect(res.status).toBe(200);
        expect(fs.existsSync(eventDbFile(tempEvent.id))).toBe(false);
    });
});

describe('Errores 500 que ya no ocurren', () => {
    test('N2 — descargar un certificado inexistente da 404 (antes 500 por tm.name)', async () => {
        const res = await call('get', `/api/certificates/download/${uuidv4()}`, adminToken);
        expect(res.status).toBe(404);
    });
    test('N17 — listar miembros de un tenant inexistente no da 500', async () => {
        const res = await call('get', `/api/tenants/${uuidv4()}/members`, adminToken);
        expect(res.status).not.toBe(500);
    });
    test('N4 — los resultados públicos de un sondeo ya no dan 401', async () => {
        const res = await request(app).get(`/api/polls/public/${uuidv4()}/results`);
        expect(res.status).not.toBe(401);
    });
});

// ─── Comprobaciones estáticas de frontend y de juegos ───
describe('Frontend y juegos (comprobación del código)', () => {
    const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

    test('F10 — el kiosco genera resultados clicables', () => {
        const line = read('public/js/pages/kiosk.js').split('\n').find(l => l.includes("class=\"result-item ' + disabledClass"));
        const escJs = (s) => String(s); const escHtml = escJs;
        const html = new Function('g', 'disabledClass', 'escJs', 'escHtml', 'return ' + line.replace(/^\s*return /, '').replace(/;?\s*$/, ''))({ id: 'abc', name: 'Ana', email: 'a@b.c', organization: '', checked_in: false }, '', escJs, escHtml);
        expect(html).toMatch(/^<div class="result-item " data-act="call" data-call="selectGuest" data-a1="abc" data-a2="Ana"/);
    });

    test('F6 — el teclado ya no dispara acciones de data-act (salvo onEnter)', () => {
        const src = read('public/js/modules/core/DelegatedEvents.js');
        expect(src).toMatch(/function eventTriggersAct\(kind, type\)/);
        expect(src).toMatch(/if \(!eventTriggersAct\(node\.dataset\.act, event\.type\)\) return;\s*\n\s*act\(node, event\);/);
        expect(src).toMatch(/const ACT_KEY_EVENTS = \{ onEnter: \['keydown'\] \}/);
    });

    test('F2 — los datos del invitado se escapan al imprimir el gafete', () => {
        const src = read('public/js/app.js');
        expect(src).toMatch(/name: bEsc\(gd\.name, 'Maria Gonzalez'\)/);
        expect(src).toMatch(/const name = pEsc\(e\.userName \|\| 'Alguien'\)/);
    });

    test('N7 — el estado público del quiz no entrega la respuesta correcta', () => {
        const src = read('src/routes/quizzes.routes.js');
        const publicBlock = src.slice(src.indexOf("router.get('/:id/public'"));
        expect(publicBlock.slice(0, 2500)).toMatch(/delete safe\.correct/);
        expect(src.match(/authMiddleware\(\['ADMIN', 'PRODUCTOR', 'ORGANIZER'\]\), \(req, res\) => \{\s*\/\/ v12\.44\.848/g)).toBeNull();
    });

    test('N8 — la trivia no revela la respuesta correcta ante una respuesta inválida', () => {
        const src = read('src/routes/trivias.routes.js');
        expect(src).toMatch(/answered: false \}\); \/\/ v12\.44\.848/);
    });

    test('N8 — chance 0 pesa 0 en los tres juegos de premio', () => {
        for (const f of ['slots', 'fortunas', 'raspas']) {
            expect(read('src/routes/' + f + '.routes.js')).toMatch(/Math\.max\(0, parseFloat\(p\.chance\) \|\| 0\)/);
        }
    });

    test('N13 — los webhooks de pago y de kiosco usan el valor real del evento', () => {
        expect(read('src/routes/payments.routes.js')).not.toMatch(/triggerWebhooks\('PAYMENT_COMPLETED'/);
        expect(read('src/routes/payments.routes.js')).toMatch(/triggerWebhooks\(WEBHOOK_EVENTS\.PAYMENT_COMPLETED,/);
        expect(read('src/routes/public.routes.js')).toMatch(/require\('\.\.\/utils\/webhooks'\)/);
    });
});
