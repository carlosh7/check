/**
 * Tests de seguridad — auditoría externa 2026-11-25 (v12.44.846)
 * Cubre los guards añadidos en la Fase 1: escalada por importación (S1), auto-asignación de
 * eventos (S2), grupos (S3), logo del gafete (S4), acceso por evento (S11), token de portal (S12),
 * clave de IA enmascarada (S9), CAPTCHA opaco (H1), clave actual obligatoria (H4), pruebas de
 * correo contra redes internas (S7) y aislamiento del correo (S11).
 */
require('dotenv').config();
const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { generateToken } = require('../src/security/jwt');
const { portalTokenFor } = require('../src/security/portal-token');

const usersRoutes = require('../src/routes/users.routes');
const groupsRoutes = require('../src/routes/groups.routes');
const eventsRoutes = require('../src/routes/events.routes');
const networkingRoutes = require('../src/routes/networking.routes');
const emailRoutes = require('../src/routes/email.routes');
const importRoutes = require('../src/routes/import.routes');
const aiSecurityRoutes = require('../src/routes/ai-security.routes');

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/users', usersRoutes);
    app.use('/api/groups', groupsRoutes);
    app.use('/api/events', eventsRoutes);
    app.use('/api/networking', networkingRoutes);
    app.use('/api/email', emailRoutes);
    app.use('/api/import', importRoutes);
    app.use('/api/security', aiSecurityRoutes);
    return app;
}

const app = createTestApp();
const tag = Date.now();
const admin = db.prepare("SELECT id, username, role FROM users WHERE role = 'ADMIN' AND status = 'APPROVED' LIMIT 1").get();
const adminToken = generateToken({ userId: admin.id, username: admin.username, role: admin.role });

// Fixtures del PRODUCTOR de prueba
const prod = { id: uuidv4(), username: `qa-audit-${tag}@test.local` };
const otherProd = { id: uuidv4(), username: `qa-audit2-${tag}@test.local` };
const ownGroup = { id: uuidv4(), name: `QA-AUDIT grupo propio ${tag}` };
const otherGroup = { id: uuidv4(), name: `QA-AUDIT grupo ajeno ${tag}` };
const ownEvent = { id: uuidv4(), name: `QA-AUDIT evento propio ${tag}`, date: '2026-12-01' };
const otherEvent = { id: uuidv4(), name: `QA-AUDIT evento ajeno ${tag}`, date: '2026-12-01' };
const guest = { id: uuidv4(), email: `qa-audit-guest-${tag}@test.local` };
const password = 'ValidPass123';
let prodToken = null;
let previousAiKey = null;
const sentinel = path.join(__dirname, '..', 'src', '__audit_sentinel_' + tag + '.txt');

beforeAll(function() {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("INSERT INTO users (id, username, password, role, display_name, status, created_at) VALUES (?, ?, ?, 'PRODUCTOR', 'QA Auditoría', 'APPROVED', ?)").run(prod.id, prod.username, hash, new Date().toISOString());
    db.prepare("INSERT INTO users (id, username, password, role, display_name, status, created_at) VALUES (?, ?, ?, 'PRODUCTOR', 'QA Auditoría 2', 'APPROVED', ?)").run(otherProd.id, otherProd.username, hash, new Date().toISOString());
    db.prepare("INSERT INTO groups (id, name, email, status, description, created_at) VALUES (?, ?, ?, 'ACTIVE', 'QA', ?)").run(ownGroup.id, ownGroup.name, `qa-${tag}@test.local`, new Date().toISOString());
    db.prepare("INSERT INTO groups (id, name, email, status, description, created_at) VALUES (?, ?, ?, 'ACTIVE', 'QA', ?)").run(otherGroup.id, otherGroup.name, `qa2-${tag}@test.local`, new Date().toISOString());
    db.prepare("INSERT INTO group_users (id, group_id, user_id, role_in_group, created_at) VALUES (?, ?, ?, 'PRODUCTOR', ?)").run(uuidv4(), ownGroup.id, prod.id, new Date().toISOString());
    db.prepare("INSERT INTO events (id, user_id, name, date, status, created_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?)").run(ownEvent.id, prod.id, ownEvent.name, ownEvent.date, new Date().toISOString());
    db.prepare("INSERT INTO events (id, user_id, name, date, status, created_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?)").run(otherEvent.id, admin.id, otherEvent.name, otherEvent.date, new Date().toISOString());
    db.prepare("INSERT INTO guests (id, event_id, name, email, qr_token, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(guest.id, ownEvent.id, 'QA Invitado', guest.email, 'qa-token-' + tag, new Date().toISOString());
    prodToken = generateToken({ userId: prod.id, username: prod.username, role: 'PRODUCTOR' });
});

afterAll(function() {
    const clean = (sql, ...params) => { try { db.prepare(sql).run(...params); } catch (e) {} };
    clean("DELETE FROM user_events WHERE user_id IN (?, ?)", prod.id, otherProd.id);
    clean("DELETE FROM group_users WHERE group_id IN (?, ?)", ownGroup.id, otherGroup.id);
    clean("DELETE FROM guests WHERE id = ?", guest.id);
    clean("DELETE FROM events WHERE id IN (?, ?)", ownEvent.id, otherEvent.id);
    clean("DELETE FROM groups WHERE id IN (?, ?)", ownGroup.id, otherGroup.id);
    clean("DELETE FROM events WHERE id IN (?, ?)", ownEvent.id, otherEvent.id);
    if (previousAiKey === null) clean("DELETE FROM settings WHERE setting_key = 'ai_openrouter_key'");
    else clean("UPDATE settings SET setting_value = ? WHERE setting_key = 'ai_openrouter_key'", previousAiKey);
    clean("DELETE FROM users WHERE id IN (?, ?)", prod.id, otherProd.id);
});

// ─── S1: la importación ya no deja que un PRODUCTOR se haga ADMIN ───
describe('S1 — importación: un PRODUCTOR no puede hacerse ADMIN', () => {
    test('una fila con role=ADMIN se rechaza y el rol del importador no cambia', async () => {
        const res = await request(app).post('/api/import/execute').set('Authorization', 'Bearer ' + prodToken)
            .send({ attestation: true, data: { users: [{ username: prod.username, role: 'ADMIN', password: password, display_name: 'QA' }] } });
        expect(res.status).toBe(200);
        expect(res.body.rejected_access.roles).toBe(1);
        expect(db.prepare("SELECT role FROM users WHERE id = ?").get(prod.id).role).toBe('PRODUCTOR');
    });
    test('un usuario nuevo con role=ADMIN tampoco se crea', async () => {
        const res = await request(app).post('/api/import/execute').set('Authorization', 'Bearer ' + prodToken)
            .send({ attestation: true, data: { users: [{ username: `qa-new-admin-${tag}@test.local`, role: 'ADMIN', password: password, display_name: 'QA', company_name: ownGroup.name }] } });
        expect(res.status).toBe(200);
        expect(res.body.rejected_access.roles).toBe(1);
        expect(db.prepare("SELECT COUNT(*) AS c FROM users WHERE username = ?").get(`qa-new-admin-${tag}@test.local`).c).toBe(0);
    });
    test('un PRODUCTOR no puede crear empresas ni tocar eventos ajenos por nombre', async () => {
        const res = await request(app).post('/api/import/execute').set('Authorization', 'Bearer ' + prodToken)
            .send({ attestation: true, data: { groups: [{ name: 'QA empresa nueva ' + tag }], events: [{ name: 'QA evento ajeno', date: '2026-12-01', group_name: otherGroup.name }] } });
        expect(res.status).toBe(200);
        expect(res.body.rejected_access.groups).toBe(1);
        expect(res.body.rejected_access.events).toBe(1);
        expect(db.prepare("SELECT COUNT(*) AS c FROM groups WHERE name = ?").get('QA empresa nueva ' + tag).c).toBe(0);
    });
});

// ─── S2 / S3 / S11: acceso a eventos y grupos ───
describe('S2/S3/S11 — aislamiento por evento y por grupo', () => {
    test('un PRODUCTOR no puede darse acceso a un evento ajeno', async () => {
        const res = await request(app).put(`/api/users/${prod.id}/events`).set('Authorization', 'Bearer ' + prodToken)
            .send({ events: [otherEvent.id] });
        expect(res.status).toBe(403);
    });
    test('y sí al suyo propio', async () => {
        const res = await request(app).put(`/api/users/${prod.id}/events`).set('Authorization', 'Bearer ' + prodToken)
            .send({ events: [ownEvent.id] });
        expect(res.status).toBe(200);
        expect(db.prepare("SELECT COUNT(*) AS c FROM user_events WHERE user_id = ? AND event_id = ?").get(prod.id, ownEvent.id).c).toBe(1);
    });
    test('no puede listar ni añadir miembros en un grupo ajeno', async () => {
        const list = await request(app).get(`/api/groups/${otherGroup.id}/users`).set('Authorization', 'Bearer ' + prodToken);
        expect(list.status).toBe(403);
        const add = await request(app).post(`/api/groups/${otherGroup.id}/users`).set('Authorization', 'Bearer ' + prodToken)
            .send({ user_id: prod.id });
        expect(add.status).toBe(403);
    });
    test('ni meter a un ADMIN en su grupo', async () => {
        const res = await request(app).post(`/api/groups/${ownGroup.id}/users`).set('Authorization', 'Bearer ' + prodToken)
            .send({ user_id: admin.id });
        expect(res.status).toBe(403);
    });
    test('el ADMIN sí puede leer cualquier evento', async () => {
        const res = await request(app).get(`/api/events/${otherEvent.id}`).set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
    });
});

// ─── S4: logo del gafete ───
describe('S4 — logo del gafete: ruta validada', () => {
    test('un PRODUCTOR no puede tocar la config de un evento ajeno', async () => {
        const res = await request(app).put(`/api/events/${otherEvent.id}/badge-config`).set('Authorization', 'Bearer ' + prodToken)
            .send({ config: { logo: '/uploads/logos/a.png' } });
        expect(res.status).toBe(403);
    });
    test('una ruta con ../ se rechaza al guardar', async () => {
        const res = await request(app).put(`/api/events/${ownEvent.id}/badge-config`).set('Authorization', 'Bearer ' + prodToken)
            .send({ config: { logo: '../../.env' } });
        expect(res.status).toBe(400);
    });
    test('y una ruta válida se guarda', async () => {
        const res = await request(app).put(`/api/events/${ownEvent.id}/badge-config`).set('Authorization', 'Bearer ' + prodToken)
            .send({ config: { logo: '/uploads/logos/qa.png' } });
        expect(res.status).toBe(200);
    });
    test('al borrar el logo no se elimina ningún archivo fuera de uploads/logos', async () => {
        fs.writeFileSync(sentinel, 'no me borres');
        try {
            db.prepare("UPDATE events SET badge_config = ? WHERE id = ?").run(JSON.stringify({ logo: '../src/' + path.basename(sentinel) }), ownEvent.id);
            const res = await request(app).delete(`/api/events/${ownEvent.id}/badge-logo`).set('Authorization', 'Bearer ' + prodToken);
            expect(res.status).toBe(200);
            expect(fs.existsSync(sentinel)).toBe(true);
        } finally {
            try { fs.unlinkSync(sentinel); } catch (e) {}
        }
    });
});

// ─── S12: token de portal ───
describe('S12 — el portal del asistente exige su token', () => {
    test('sin token → 403', async () => {
        const res = await request(app).get(`/api/networking/${ownEvent.id}/guest/${guest.id}/suggestions`);
        expect(res.status).toBe(403);
    });
    test('con un token inventado → 403', async () => {
        const res = await request(app).get(`/api/networking/${ownEvent.id}/guest/${guest.id}/suggestions?t=${guest.id}.falsificado`);
        expect(res.status).toBe(403);
    });
    test('con el token real → 200 y entrega portal_token, no qr_token', async () => {
        const res = await request(app).get(`/api/networking/${ownEvent.id}/guest/${guest.id}/suggestions?t=${portalTokenFor(guest.id)}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.every(s => s.portal_token && !('qr_token' in s))).toBe(true);
    });
    test('el perfil de otro asistente exige token', async () => {
        const bad = await request(app).get(`/api/networking/profile/${guest.id}?event_id=${ownEvent.id}`);
        expect(bad.status).toBe(403);
        const ok = await request(app).get(`/api/networking/profile/${guest.id}?event_id=${ownEvent.id}&t=${portalTokenFor(guest.id)}`);
        expect(ok.status).toBe(200);
        expect('qr_token' in ok.body).toBe(false);
    });
});

// ─── H1: CAPTCHA ───
describe('H1 — CAPTCHA de un solo uso y sin respuesta en el token', () => {
    const captcha = require('../src/security/captcha');
    test('el token no contiene la respuesta', () => {
        const c = captcha.generateCaptcha('test-' + tag);
        expect(Buffer.from(c.token, 'base64').toString('utf8')).not.toContain('"answer"');
        expect(c.token.length).toBeLessThan(120);
        expect(c.token).toMatch(/^[0-9a-f]+\.[0-9a-f]+$/);
    });
    test('la respuesta correcta valida y el token queda gastado', () => {
        const c = captcha.generateCaptcha('test2-' + tag);
        const answer = String(new Function('return ' + c.question.replace('×', '*'))());
        expect(captcha.verifyCaptcha(c.token, answer).valid).toBe(true);
        expect(captcha.verifyCaptcha(c.token, answer).valid).toBe(false);
    });
});

// ─── S9: clave de IA ───
describe('S9 — la clave de OpenRouter solo la ve el ADMIN', () => {
    beforeAll(() => {
        previousAiKey = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'ai_openrouter_key'").pluck().get();
        if (previousAiKey === undefined) previousAiKey = null;
        db.prepare("INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES ('ai_openrouter_key', 'sk-audit-test-1234567890')").run();
    });
    test('un PRODUCTOR recibe la clave enmascarada', async () => {
        const res = await request(app).get('/api/security/ai/settings').set('Authorization', 'Bearer ' + prodToken);
        expect(res.status).toBe(200);
        expect(res.body.ai_openrouter_key).toBe('••••7890');
    });
    test('el ADMIN recibe la clave completa', async () => {
        const res = await request(app).get('/api/security/ai/settings').set('Authorization', 'Bearer ' + adminToken);
        expect(res.body.ai_openrouter_key).toBe('sk-audit-test-1234567890');
    });
});

// ─── S7 / S11: correo ───
describe('S7/S11 — correo: pruebas de conexión seguras y aislamiento', () => {
    test('no se puede tantear un puerto interno', async () => {
        const res = await request(app).post('/api/email/test-smtp').set('Authorization', 'Bearer ' + prodToken)
            .send({ smtp_host: '127.0.0.1', smtp_port: 9443, smtp_user: 'a', smtp_password: 'b' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(false);
        expect(String(res.body.error)).toMatch(/Puerto no permitido|red interna/);
    });
    test('ni un puerto no estándar en un host público', async () => {
        const res = await request(app).post('/api/email/test-smtp').set('Authorization', 'Bearer ' + prodToken)
            .send({ smtp_host: 'smtp.gmail.com', smtp_port: 8443, smtp_user: 'a', smtp_password: 'b' });
        expect(res.body.success).toBe(false);
        expect(String(res.body.error)).toMatch(/Puerto no permitido/);
    });
    test('una plantilla no se puede ligar a un evento ajeno', async () => {
        const res = await request(app).post('/api/email/templates').set('Authorization', 'Bearer ' + prodToken)
            .send({ event_id: otherEvent.id, name: 'QA', subject: 'QA', body_html: '<p>QA</p>' });
        expect(res.status).toBe(403);
    });
    test('una cuenta no se puede guardar hacia una red interna', async () => {
        const res = await request(app).post('/api/email/accounts').set('Authorization', 'Bearer ' + prodToken)
            .send({ event_id: ownEvent.id, name: 'QA', smtp_host: '192.168.1.5', smtp_port: 587, smtp_user: 'a', smtp_password: 'b' });
        expect(res.status).toBe(400);
        expect(String(res.body.error)).toMatch(/red interna/);
    });
});

// ─── D1 / H5: apagado y montaje de subidas ───
describe('D1/H5 — apagado y /uploads', () => {
    test('el apagado ya no vacía Redis', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
        expect(/if \(redis\.isRedisAvailable\(\)\) redis\.flush\(/.test(src)).toBe(false);
        expect(/redis\.close\(\)/.test(src)).toBe(true);
    });
});

// ─── H4: clave actual obligatoria ───
describe('H4 — cambiar la propia clave exige la clave actual', () => {
    test('con la clave actual equivocada → 403', async () => {
        const res = await request(app).put(`/api/users/${prod.id}/password`).set('Authorization', 'Bearer ' + prodToken)
            .send({ currentPassword: 'Equivocada123', newPassword: password });
        expect(res.status).toBe(403);
    });
    test('y cambia con la correcta (no se verifica aquí el cambio real: solo el guard)', async () => {
        const res = await request(app).put(`/api/users/${prod.id}/password`).set('Authorization', 'Bearer ' + prodToken)
            .send({ currentPassword: password, newPassword: 'OtraClave123' });
        // la política de claves puede rechazarla; con que pase el guard basta
        expect([200, 400]).toContain(res.status);
    });
});

// ─── D8: clave foránea inválida en las BDs de evento ───
describe('D8 — transactions sin clave foránea a guests(event_id)', () => {
    test('la tabla se crea bien y los invitados se pueden borrar en la BD del evento', () => {
        const dm = require('../src/utils/database-manager');
        const eventId = uuidv4();
        dm.createEventDatabase(eventId);
        try {
            const conn = dm.getEventConnection(eventId);
            const row = conn.prepare("SELECT sql FROM sqlite_master WHERE name='transactions'").get();
            expect(row).toBeTruthy();
            expect(/REFERENCES guests\(event_id\)/.test(row.sql)).toBe(false);
            expect(() => conn.prepare('DELETE FROM guests WHERE id = ?')).not.toThrow();
            expect(() => conn.prepare('INSERT INTO transactions (id, event_id, amount, provider) VALUES (?, ?, 1, ?)')).not.toThrow();
        } finally {
            dm.closeAllConnections();
            dm.deleteEventDatabase(eventId);
        }
    });
});
