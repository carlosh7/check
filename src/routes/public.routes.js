/**
 * Rutas públicas de Check Pro
 *
 * @openapi
 * tags:
 *   - name: Public
 *     description: Rutas públicas (registro, captcha, versión)
 *
 * /api/event/{id}:
 *   get:
 *     tags: [Public]
 *     summary: Obtener detalles públicos de un evento
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Datos públicos del evento }
 *
 * /api/public-register:
 *   post:
 *     tags: [Public]
 *     summary: Registro público de invitado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event_id: { type: string }
 *               name: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *     responses:
 *       200: { description: Registro exitoso }
 *       400: { description: Error de validación }
 *
 * /api/captcha:
 *   get:
 *     tags: [Public]
 *     summary: Generar captcha
 *     responses:
 *       200: { description: SVG del captcha }
 *
 * /api/app-version:
 *   get:
 *     tags: [Public]
 *     summary: Obtener versión de la app
 *     responses:
 *       200: { description: Versión actual }
 */

const express = require('express');
const crypto = require('crypto');
const { db, getEventConnection, eventDatabaseExists } = require('../../database');
const { generateCaptcha, verifyCaptcha } = require('../security/captcha');

const logger = require("../utils/logger");
const router = express.Router();
const { castId } = require('../utils/helpers');
const { triggerWebhooks, WEBHOOK_EVENTS } = require('../utils/webhooks');
const { authMiddleware } = require('../middleware/auth');
const { maskEmail, sha256Hex } = require('../utils/privacy');

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Obtener detalles públicos de un evento para registro
router.get('/event/:id', (req, res) => {
    const id = castId('events', req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID de evento no válido' });

    const event = db.prepare(`SELECT id, name, date, end_date, location, description,
                                     reg_title, reg_welcome_text, reg_success_message, reg_show_phone,
                                     reg_show_org, reg_show_position, reg_show_vegan, reg_show_dietary,
                                     reg_show_gender, reg_require_agreement, reg_policy, reg_logo_url,
                                     reg_email_whitelist, reg_email_blacklist, reg_min_age,
                                     payment_required, currency,
                                     latitude, longitude, map_zoom, music_url, video_conference_url
                              FROM events WHERE id = ?`).get(id);

    if (!event) return res.status(404).json({ success: false, error: 'Evento no encontrado' });
    res.json(event);
});

router.get('/captcha', (req, res) => {
    // N-5 (v12.44.819): se pasa req.ip para que el límite de desafíos sea POR IP
    // (antes usaba la clave 'unknown', compartida por todos los visitantes).
    const captcha = generateCaptcha(req.ip);
    if (captcha.error) return res.status(429).json({ success: false, error: captcha.error });
    res.json({ question: captcha.question, token: captcha.token });
});

// v12.44.849 (auditoría 2026-11-25, I8): busca por id (lo que usan los enlaces) y por `slug` solo si esa columna existe.
// La tabla events no tiene columna `slug`: la consulta original daba 500 siempre, también cuando se
// pasaba el id del evento (kiosco, landing y portal abiertos por enlace).
function findEventBySlugOrId(slug) {
    if (castId('events', slug)) {
        const byId = db.prepare('SELECT id, name FROM events WHERE id = ? LIMIT 1').get(slug);
        if (byId) return byId;
    }
    const cols = db.prepare('PRAGMA table_info(events)').all().map(function(c) { return c.name; });
    if (cols.includes('slug')) return db.prepare('SELECT id, name FROM events WHERE slug = ? LIMIT 1').get(slug) || null;
    return null;
}

// // v12.44.850 (auditoría 2026-11-25, F12): categorías de pago del evento para el formulario público de registro (antes
// el visitante recibía 401 al pedir /api/guests/:id/categories).
router.get('/event/:eventId/categories', (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'Evento inválido' });
        const exists = db.prepare('SELECT id FROM events WHERE id = ?').get(eId);
        if (!exists) return res.status(404).json({ error: 'Evento no encontrado' });
        let conn = db;
        try { const { getEventDb } = require('../utils/event-db'); conn = getEventDb(eId) || db; } catch (_) {}
        const rows = conn.prepare('SELECT id, name, price, color FROM guest_categories WHERE event_id = ? ORDER BY sort_order ASC, name ASC').all(eId); // v12.44.851: description no existe en la BD de evento (daba 500)
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Error al obtener categorías' }); }
});

// Portal del asistente (BL-28)
router.get('/portal/:guestId', (req, res) => {
    try {
        const gId = castId('guests', req.params.guestId);
        if (!gId) return res.status(400).json({ error: 'ID de invitado no válido' });
        // v12.44.846 (auditoría 2026-11-25, S12): el portal exige el token de portal del asistente.
        // Antes bastaba conocer el id del invitado para leer sus datos y obtener su qr_token
        // (la credencial del check-in).
        const { verifyPortalToken, portalTokenFor } = require('../security/portal-token');
        if (!verifyPortalToken(req.query.t, gId)) return res.status(403).json({ error: 'Token de portal inválido' });
        const guest = db.prepare("SELECT g.*, e.name as event_name, e.date as event_date, e.location as event_location, e.description as event_description FROM guests g JOIN events e ON g.event_id = e.id WHERE g.id = ?").get(gId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });

        // Sessions from event DB
        let sessions = [];
        try {
            const { getEventConnection } = require('../../database');
            const eventDb = getEventConnection(guest.event_id);
            if (eventDb) {
                sessions = eventDb.prepare("SELECT id, title, date, start_time, end_time, location FROM sessions WHERE event_id = ? ORDER BY start_time ASC").all(guest.event_id);
            }
        } catch(_) {}

        res.json({
            guest: { id: guest.id, name: guest.name, email: guest.email, checked_in: guest.checked_in, qr_token: guest.qr_token, category_id: guest.category_id, portal_token: portalTokenFor(guest.id) },
            event: { id: guest.event_id, name: guest.event_name, date: guest.event_date, location: guest.event_location, description: guest.event_description },
            sessions: sessions
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── Kiosko Auto-Check-In (C11-03) ──

// L-2.1 (v12.44.818): token de kiosco por evento.
// - Si el evento tiene kiosk_token configurado → es OBLIGATORIO (header x-kiosk-token o ?kt=).
// - Si NO tiene token: en modo 'optional' (default) se permite como antes (compatibilidad
//   con kioscos existentes); en modo 'strict' (env KIOSK_TOKEN_MODE=strict) se bloquea.
// El token se genera con POST /api/events/:id/kiosk-token (ADMIN/PRODUCTOR).

// v12.44.846 (auditoría 2026-11-25, H7): comparación de secrets en tiempo constante.
// `provided === configured` sale en el primer byte distinto: el tiempo de respuesta delata
// cuántos caracteres del token van bien. crypto.timingSafeEqual compara siempre los buffers
// completos, pero exige la MISMA longitud (si no lanza RangeError): longitudes distintas se
// rechazan sin comparar. El token es un uuidv4 (36 caracteres fijos), así que su longitud no es
// un secreto.
function secretEquals(provided, expected) {
    const a = Buffer.from(String(provided), 'utf8');
    const b = Buffer.from(String(expected), 'utf8');
    if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function kioskTokenOk(eventId, req) {
    let configured = null;
    try {
        const ev = db.prepare("SELECT kiosk_token FROM events WHERE id = ?").get(eventId);
        configured = ev ? ev.kiosk_token : null;
    } catch (_) {
        // v12.44.846 (auditoría 2026-11-25, H7): antes `return true` (fail-open): si la lectura
        // fallaba, el kiosco quedaba autorizado en todos los eventos. Ahora se deniega.
        return false;
    }
    if (!configured) {
        return String(process.env.KIOSK_TOKEN_MODE || 'optional') !== 'strict';
    }
    const provided = String(req.get('x-kiosk-token') || req.query.kt || '');
    // v12.44.846 (auditoría 2026-11-25, H7): antes `provided === configured` (comparación cortante)
    return secretEquals(provided, configured);
}

// Buscar invitados por nombre (para kiosko)
router.get('/kiosk/:eventId/search', (req, res) => {
    try {
        const q = req.query.q || '';
        if (!q || q.length < 2) return res.json([]);
        const eId = require('../utils/helpers').castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'Evento inválido' });
        if (!kioskTokenOk(eId, req)) return res.status(403).json({ error: 'Kiosco no autorizado para este evento' });
        const event = db.prepare("SELECT id, has_own_db FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        let targetDb = require('../../database');
        if (event.has_own_db) {
            try { targetDb = require('../utils/database-manager').getEventConnection(eId) || targetDb; } catch(e) {}
        }
        const guests = targetDb.prepare("SELECT id, name, email, organization, checked_in FROM guests WHERE event_id = ? AND (name LIKE ? OR email LIKE ? OR organization LIKE ?) LIMIT 20").all(eId, '%' + q + '%', '%' + q + '%', '%' + q + '%');
        // L-2.2 (v12.44.818): minimización — el kiosco no necesita emails completos
        res.json(guests.map(function(g) { return Object.assign({}, g, { email: maskEmail(g.email) }); }));
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Auto-check-in público (vía QR token)
router.post('/kiosk/checkin', (req, res) => {
    try {
        const { guest_token } = req.body;
        if (!guest_token) return res.status(400).json({ error: 'Token requerido' });
        const guest = db.prepare("SELECT * FROM guests WHERE qr_token = ?").get(guest_token);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        if (!kioskTokenOk(guest.event_id, req)) return res.status(403).json({ error: 'Kiosco no autorizado para este evento' });
        if (guest.checked_in) return res.json({ success: true, alreadyCheckedIn: true, guest: { name: guest.name } });
        let targetDb = require('../../database');
        const eventData = db.prepare("SELECT id, has_own_db FROM events WHERE id = ?").get(guest.event_id);
        if (eventData && eventData.has_own_db) {
            try { targetDb = require('../utils/database-manager').getEventConnection(guest.event_id) || targetDb; } catch(e) {}
        }
        targetDb.prepare("UPDATE guests SET checked_in = 1, checkin_time = ?, status = 'attended' WHERE id = ?").run(new Date().toISOString(), guest.id);
        // Trigger webhook
        try {
            // v12.44.848 (auditoría 2026-11-25, N13): se importaba desde ./webhooks.routes, que solo exporta el router → el webhook de
            // check-in del kiosco nunca se disparaba.
            const wh = require('../utils/webhooks');
            if (wh && wh.triggerWebhooks) wh.triggerWebhooks('guest.checked_in', { guest_id: guest.id, event_id: guest.event_id, name: guest.name, email: guest.email, source: 'kiosk' }, guest.event_id).catch(function() {});
        } catch(e) {}
        // Emit socket event
        try {
            const io = require('../../src/socket').getIO();
            if (io) { io.to(guest.event_id).emit('update_stats', guest.event_id); io.to(guest.event_id).emit('live_checkin', { name: guest.name, id: guest.id, event_id: guest.event_id, source: 'kiosk' }); }
        } catch(e) {}
        res.json({ success: true, alreadyCheckedIn: false, guest: { name: guest.name } });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Obtener datos del evento para el kiosko
router.get('/kiosk/:eventId/event', (req, res) => {
    try {
        const eId = require('../utils/helpers').castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'Evento inválido' });
        // v12.44.846 (auditoría 2026-11-25, N3): se pide has_own_db porque el bloque de abajo lo
        // consulta (sin ella era siempre undefined y nunca se usaba la BD del evento).
        const event = db.prepare("SELECT id, name, date, location, logo_url, brand_primary_color as primary_color, has_own_db FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        // Obtener stats
        // v12.44.846 (auditoría 2026-11-25, N3): aquí se asignaba el MÓDULO require('../../database')
        // en vez de una conexión → "targetDb.prepare is not a function" → 500 SIEMPRE. Ahora: la BD
        // del evento si tiene una propia, y si no la maestra.
        let targetDb = db;
        if (event.has_own_db) {
            try { targetDb = getEventConnection(eId) || targetDb; } catch(e) {}
        }
        // v12.44.846 (N3): has_own_db es un detalle interno; esta ruta es pública y su respuesta
        // nunca lo incluyó.
        delete event.has_own_db;
        const total = targetDb.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ?").get(eId).c;
        const checkedIn = targetDb.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND checked_in = 1").get(eId).c;
        event.stats = { total: total, checkedIn: checkedIn };
        res.json(event);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ICS Calendar (C2-07)
router.get('/event/:id/ics', (req, res) => {
    try {
        const id = castId('events', req.params.id);
        if (!id) return res.status(400).json({ error: 'ID inválido' });
        const event = db.prepare("SELECT id, name, date, end_date, location, description FROM events WHERE id = ?").get(id);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        const startDate = event.date ? new Date(event.date) : new Date();
        const endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

        const fmt = function(d) {
            return d.toISOString().replace(/-/g, '').replace(/:/g, '').split('.')[0] + 'Z';
        };

        const esc = function(t) { return (t || '').replace(/,/g, '\\,').replace(/\n/g, '\\n'); };

        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Check Pro//ES',
            'BEGIN:VEVENT',
            'UID:' + event.id + '@checkpro',
            'DTSTART:' + fmt(startDate),
            'DTEND:' + fmt(endDate),
            'SUMMARY:' + esc(event.name),
            'LOCATION:' + esc(event.location),
            'DESCRIPTION:' + esc(event.description),
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="' + (event.name || 'evento').replace(/\s+/g, '_') + '.ics"');
        res.send(ics);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// QR del evento (BL-17)
router.get('/event/:id/qr', (req, res) => {
    try {
        const id = castId('events', req.params.id);
        if (!id) return res.status(400).json({ error: 'ID inválido' });
        const event = db.prepare("SELECT id, name FROM events WHERE id = ?").get(id);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        const regUrl = (req.headers['x-forwarded-proto'] || 'http') + '://' + req.get('host') + '/registro.html?event=' + id;
        const QRCode = require('qrcode');
        QRCode.toBuffer(regUrl, { width: 400, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } }).then(function(buf) {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.send(buf);
        }).catch(function(err) { res.status(500).json({ error: err.message }); });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// QR del invitado individual (para portal/ticket)
router.get('/guests/qr/:guestId', (req, res) => {
    try {
        const guest = db.prepare("SELECT id, qr_token FROM guests WHERE id = ?").get(req.params.guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        const QRCode = require('qrcode');
        const url = (req.headers['x-forwarded-proto'] || 'http') + '://' + req.get('host') + '/api/guests/by-id/' + guest.id;
        QRCode.toBuffer(url, { width: 300, margin: 1, color: { dark: '#1e293b', light: '#ffffff' } }).then(function(buf) {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.send(buf);
        }).catch(function(err) { res.status(500).json({ error: err.message }); });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Token QR del invitado (para kiosko)
router.get('/guests/qr/:guestId/token', (req, res) => {
    try {
        const guest = db.prepare("SELECT id, qr_token, event_id FROM guests WHERE id = ?").get(req.params.guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        // L-2.2 (v12.44.818): este endpoint entrega el token de check-in; exige autorización
        // de kiosco cuando el evento la tiene configurada (evita GuestId -> qr_token público).
        if (!kioskTokenOk(guest.event_id, req)) return res.status(403).json({ error: 'Kiosco no autorizado para este evento' });
        res.json({ token: guest.qr_token });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Buscar evento por slug (para kiosko)
router.get('/event-by-slug/:slug', (req, res) => {
    try {
        const slug = req.params.slug;
        // // v12.44.849 (auditoría 2026-11-25, I8): el evento se resuelve por id (o por slug si la columna existe)
        const event = findEventBySlugOrId(slug);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        res.json(event);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/captcha/verify', (req, res) => {
    const { token, answer } = req.body;
    if (!token || answer === undefined) {
        return res.status(400).json({ valid: false, error: 'Token y respuesta requeridos' });
    }
    const valid = verifyCaptcha(token, answer);
    res.json({ valid });
});

router.get('/unsubscribe/:token', (req, res) => {
    const token = req.params.token;
    const guest = db.prepare("SELECT id, name FROM guests WHERE unsubscribe_token = ?").get(token);

    if (!guest) {
        return res.send('<h1>Enlace no válido</h1><p>No pudimos encontrar tu suscripción.</p>');
    }

    db.prepare("UPDATE guests SET unsubscribed = 1 WHERE id = ?").run(guest.id);

    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>Desuscripción Exitosa</h1>
            <p>Hola ${escapeHtml(guest.name)}, hemos procesado tu solicitud. No recibirás más correos automáticos.</p>
            <p><small>Si fue un error, contacta con soporte.</small></p>
        </div>
    `);
});

// Registro público de invitados
router.post('/public-register', (req, res) => {
    const { event_id, name, email, phone, organization, position, gender, dietary_notes } = req.body;

    if (!event_id || !name || !email) {
        return res.status(400).json({ success: false, error: 'Datos requeridos: event_id, name, email' });
    }

    // ── N-5 (v12.44.819): captcha anti-bots OBLIGATORIO en el registro público ──
    // El desafío es de un solo uso y expira en 5 minutos (src/security/captcha.js).
    const captchaCheck = verifyCaptcha(req.body.captcha_token, req.body.captcha_answer);
    if (!captchaCheck.valid) {
        return res.status(400).json({ success: false, captcha_failed: true, error: 'Verificación anti-robots inválida o expirada. Resuelve el desafío e inténtalo de nuevo.' });
    }

    // L-1A.1 (v12.44.818): enforcement server-side de la autorización de tratamiento
    // (Ley 1581 arts. 8-9). El checkbox del cliente ya no es suficiente: si el evento
    // exige acuerdo, el backend rechaza el registro sin `agreement=true`.
    const agreementGiven = req.body.agreement === true || req.body.agreement === 'true' || req.body.agreement === 1;
    
    try {
        const { getValidId, castId } = require('../utils/helpers');
        const { v4: uuidv4 } = require('uuid');
        
        const eId = castId('events', event_id);
        if (!eId) {
            return res.status(400).json({ success: false, error: 'Evento no válido' });
        }
        
        const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eId);
        if (!event) {
            return res.status(404).json({ success: false, error: 'Evento no encontrado' });
        }

        if (event.reg_require_agreement !== 0 && !agreementGiven) {
            return res.status(400).json({ success: false, error: 'Debes aceptar la política de tratamiento de datos personales para registrarte' });
        }

        // ── C-11 (v12.44.820): edad mínima por evento (menores de edad, Ley 1581 art. 7) ──
        // Si el evento define reg_min_age > 0, el formulario público muestra el campo de
        // edad y el backend RECHAZA sin edad declarada o por debajo del mínimo.
        const declaredAge = parseInt(req.body.age, 10);
        if (event.reg_min_age > 0) {
            if (!declaredAge || declaredAge < 1 || declaredAge > 120) {
                return res.status(400).json({ success: false, age_required: true, min_age: event.reg_min_age, error: 'Debes declarar tu edad para registrarte en este evento' });
            }
            if (declaredAge < event.reg_min_age) {
                return res.status(400).json({ success: false, under_age: true, min_age: event.reg_min_age, error: `Este evento es para mayores de ${event.reg_min_age} años. Si eres menor de edad, se requiere autorización del representante legal: contacta al organizador.` });
            }
        }
        
        // Verificar whitelist/blacklist de emails
        if (event.reg_email_whitelist) {
            const whitelist = event.reg_email_whitelist.split(',').map(e => e.trim().toLowerCase());
            if (!whitelist.some(domain => email.endsWith('@' + domain))) {
                return res.status(400).json({ success: false, error: 'Email no permitido para este evento' });
            }
        }
        
        if (event.reg_email_blacklist) {
            const blacklist = event.reg_email_blacklist.split(',').map(e => e.trim().toLowerCase());
            if (blacklist.some(domain => email.endsWith('@' + domain))) {
                return res.status(400).json({ success: false, error: 'Email bloqueado para este evento' });
            }
        }
        
        // Determinar qué base de datos usar (del evento o maestra)
        const useEventDb = event.has_own_db === 1 && eventDatabaseExists(eId);
        const targetDb = useEventDb ? getEventConnection(eId) : db;
        
        // Verificar si ya existe el invitado (por correo o por teléfono si no es vacío)
        const existing = targetDb.prepare(`
            SELECT id FROM guests 
            WHERE event_id = ? AND (email = ? OR (phone != '' AND phone IS NOT NULL AND phone = ?))
        `).get(eId, email, phone || '');
        if (existing) {
            return res.status(400).json({ success: false, error: 'Ya estás registrado en este evento' });
        }

        // v12.44.852 (P3): validar TODO antes de insertar. Antes el invitado se creaba primero y dos
        // validaciones posteriores respondían 400: el reintento chocaba con 'Ya estás registrado'.
        const cfEarly = req.body.custom_fields || {};
        let missingEarly = [];
        try {
            const reqFieldsEarly = db.prepare('SELECT id, label FROM registration_fields WHERE event_id = ? AND required = 1').all(eId);
            missingEarly = reqFieldsEarly.filter(f => !cfEarly[f.id] || String(cfEarly[f.id]).trim() === '');
        } catch (_) {}
        if (missingEarly.length > 0) {
            return res.status(400).json({ success: false, error: `Campo obligatorio pendiente: ${missingEarly[0].label}` });
        }
        const plusOnesEarly = Array.isArray(req.body.plus_ones) ? req.body.plus_ones.filter(p => p && p.name && p.name.trim()) : [];
        if (plusOnesEarly.length > 0) {
            const declaredEarly = req.body.plusone_declaration === true || req.body.plusone_declaration === 'true';
            if (!declaredEarly) {
                return res.status(400).json({ success: false, error: 'Debes declarar que cuentas con la autorización de tus acompañantes para registrar sus datos' });
            }
        }
        
        const guestId = getValidId('guests');
        const qrToken = uuidv4();
        const now = new Date().toISOString();
        
        // Verificar cupo por categoria para waitlist
        let isWaitlisted = false;
        let waitlistPosition = null;
        const catId = req.body.category_id || null;
        if (catId) {
            try {
                const cat = targetDb.prepare("SELECT capacity FROM guest_categories WHERE id = ? AND event_id = ?").get(catId, eId);
                if (cat && cat.capacity > 0) {
                    const activeCount = targetDb.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND category_id = ? AND (status IS NULL OR status != 'waitlisted')").get(eId, catId);
                    if (activeCount.c >= cat.capacity) {
                        isWaitlisted = true;
                        const maxPos = targetDb.prepare("SELECT MAX(waitlist_position) as m FROM guests WHERE event_id = ? AND category_id = ? AND status = 'waitlisted'").get(eId, catId);
                        waitlistPosition = (maxPos.m || 0) + 1;
                    }
                }
            } catch(_) {}
        }
        
        targetDb.prepare(`INSERT INTO guests (id, event_id, name, email, phone, organization, position, gender, dietary_notes, qr_token, category_id, status, waitlist_position, waitlisted_at, is_new_registration, checked_in)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`)
          .run(guestId, eId, name, email, phone || '', organization || '', position || '', gender || 'O', dietary_notes || '', qrToken, catId,
               isWaitlisted ? 'waitlisted' : null, isWaitlisted ? waitlistPosition : null, isWaitlisted ? now : null);

        // ── L-1A.1 (v12.44.818): prueba de la autorización (Ley 1581 arts. 8-9, Decreto 1377) ──
        // Se conserva QUÉ texto aceptó (con hash de versión), CUÁNDO y DESDE DÓNDE.
        const policyText = (event.reg_policy && String(event.reg_policy).trim())
            || 'Al registrarse, acepta que sus datos sean utilizados únicamente para la gestión del evento.';
        const policyHash = sha256Hex(policyText);
        const consentIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';
        const consentUa = req.get('User-Agent') || null;
        try {
            db.prepare(`INSERT INTO consent_logs (id, guest_id, event_id, consent_type, consent_given, consent_text, ip_address, user_agent)
                        VALUES (?, ?, ?, 'data_treatment', 1, ?, ?, ?)`)
              .run(uuidv4(), guestId, eId, `[sha256:${policyHash}] ${policyText}`.slice(0, 4000), consentIp, consentUa);
        } catch (cErr) {
            logger.warn('[public-register] No se pudo registrar consentimiento:', cErr.message);
        }

        // ── C-4 (v12.44.820): consentimiento DIFERENCIADO para datos sensibles (Ley 1581 art. 6) ──
        // Las alergias/restricciones alimentarias revelan condiciones de salud = dato sensible:
        // requieren autorización específica e informada, separada del consentimiento general.
        // Se registra SOLO cuando el titular llena el campo (opt-in, nunca bloquea el registro).
        if (dietary_notes && String(dietary_notes).trim()) {
            try {
                const sensitiveText = `[sha256:${policyHash}] Autorización específica para datos sensibles: el titular declaró información de salud/alimentaria ("${String(dietary_notes).slice(0, 200)}") para la logística del evento. Base: autorización previa y expresa (Ley 1581 art. 6).`;
                db.prepare(`INSERT INTO consent_logs (id, guest_id, event_id, consent_type, consent_given, consent_text, ip_address, user_agent)
                            VALUES (?, ?, ?, 'sensitive_data', 1, ?, ?, ?)`)
                  .run(uuidv4(), guestId, eId, sensitiveText.slice(0, 4000), consentIp, consentUa);
            } catch (_) {}
        }

        // ── F4: campos personalizados del formulario (valores junto al invitado) ──
        try {
            const cf = req.body.custom_fields || {};
            const fieldIds = Object.keys(cf);
            const fieldsDb = useEventDb ? targetDb : db;
            for (const fid of fieldIds) {
                const val = typeof cf[fid] === 'boolean' ? (cf[fid] ? 'true' : String(cf[fid])) : String(cf[fid] ?? '');
                if (!val) continue;
                fieldsDb.prepare("INSERT INTO registration_field_values (id, event_id, guest_id, field_id, value) VALUES (?, ?, ?, ?, ?)")
                  .run(uuidv4(), eId, guestId, fid, val);
            }
            // Validar required de los campos definidos
            const reqFields = db.prepare("SELECT id, label FROM registration_fields WHERE event_id = ? AND required = 1").all(eId);
            const missing = reqFields.filter(f => !cf[f.id] || String(cf[f.id]).trim() === '');
            if (missing.length > 0) {
                // v12.44.852 (P3): ya respondido antes del INSERT; aquí solo se registra la anomalía
                logger.warn('[public-register] required pendiente tras insert (no debería ocurrir):', missing[0].label);
            }
        } catch (cfErr) {
            logger.warn('[public-register] custom_fields:', cfErr.message);
        }

        // ── F4: plus-ones / acompañantes con cupo por evento ──
        let plusOnesCreated = 0;
        try {
            const plusOnes = Array.isArray(req.body.plus_ones) ? req.body.plus_ones.filter(p => p && p.name && p.name.trim()) : [];
            if (plusOnes.length > 0) {
                // L-1A.2 (v12.44.818): el registrante debe declarar que cuenta con la
                // autorización de sus acompañantes (los titulares no están presentes).
                const plusOneDeclared = req.body.plusone_declaration === true || req.body.plusone_declaration === 'true';
                if (!plusOneDeclared) {
                    // v12.44.852 (P3): ya respondido antes del INSERT; no se crean acompañantes
                    logger.warn('[public-register] declaración de acompañantes ausente tras insert (no debería ocurrir)');
                }
                let quota = null;
                try { quota = db.prepare("SELECT plus_one_quota FROM events WHERE id = ?").get(eId)?.plus_one_quota; } catch (_) {}
                const allowed = quota == null || quota < 0 ? plusOnes.length : Math.min(quota, plusOnes.length);
                for (let i = 0; i < allowed; i++) {
                    const po = plusOnes[i];
                    const poEmail = (po.email || '').trim().toLowerCase();
                    if (poEmail) {
                        const dupPo = targetDb.prepare("SELECT id FROM guests WHERE event_id = ? AND email = ?").get(eId, poEmail);
                        if (dupPo) continue;
                    }
                    const poId = uuidv4();
                    targetDb.prepare(`INSERT INTO guests (id, event_id, name, email, phone, gender, qr_token, parent_guest_id, guest_type, checked_in)
                                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'plus_one', 0)`)
                        .run(poId, eId, po.name.trim(), poEmail, po.phone || '', gender || 'O', uuidv4(), guestId);
                    plusOnesCreated++;

                    // L-1A.2 (v12.44.818): evidencia de la declaración del registrante por cada acompañante
                    try {
                        db.prepare(`INSERT INTO consent_logs (id, guest_id, event_id, consent_type, consent_given, consent_text, ip_address, user_agent)
                                    VALUES (?, ?, ?, 'plus_one_declaration', 1, ?, ?, ?)`)
                          .run(uuidv4(), poId, eId,
                               `[sha256:${policyHash}] Declaración de ${name} (${email}): cuenta con autorización para registrar los datos del acompañante "${po.name.trim()}"`
                                   .slice(0, 4000), consentIp, consentUa);
                    } catch (_) {}
                    // Aviso al acompañante con canal de salida (best-effort; si no hay SMTP, la prueba queda en logs)
                    if (poEmail) {
                        try {
                            if (global.emailService && typeof global.emailService.sendEmail === 'function') {
                                const poHtml = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#1e293b">'
                                    + '<h2 style="font-size:18px">Te registraron como acompañante</h2>'
                                    + '<p style="font-size:14px">' + escapeHtml(name) + ' te registró como acompañante para el evento <b>' + escapeHtml(event.name || '') + '</b>.</p>'
                                    + '<p style="font-size:13px;color:#475569">Si no autorizaste el registro de tus datos, responde a este correo para solicitar la eliminación de tu información.</p>'
                                    + '<p style="font-size:11px;color:#94a3b8;margin-top:16px">Tratamiento de datos conforme a la Ley 1581 de 2012 (Colombia).</p></div>';
                                global.emailService.sendEmail({ to: poEmail, subject: 'Te registraron como acompañante — ' + (event.name || 'Evento'), html: poHtml, eventId: null }).catch(function() {});
                            }
                        } catch (_) {}
                    }
                }
            }
        } catch (poErr) {
            logger.warn('[public-register] plus_ones:', poErr.message);
        }

        // Si usa BD del evento, también registrar en BD maestra
        if (useEventDb && targetDb !== db) {
            try {
                db.prepare(`INSERT OR IGNORE INTO guests (id, event_id, name, email, phone, organization, position, gender, dietary_notes, qr_token, category_id, status, waitlist_position, waitlisted_at, is_new_registration, checked_in)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`)
                  .run(guestId, eId, name, email, phone || '', organization || '', position || '', gender || 'O', dietary_notes || '', qrToken, catId,
                       isWaitlisted ? 'waitlisted' : null, isWaitlisted ? waitlistPosition : null, isWaitlisted ? now : null);
            } catch (_) {}
        }
        
        try { triggerWebhooks(WEBHOOK_EVENTS.PRE_REGISTRATION_CREATED, { guestId, event_id: eId, name, email }, eId).catch(() => {}); } catch(_) {}
        res.json({ success: true, message: isWaitlisted ? 'Registrado en lista de espera' : 'Registro exitoso', guestId, qrToken, waitlisted: isWaitlisted, waitlistPosition, plusOnesCreated });
    } catch (err) {
        logger.error('[public-register] CRITICAL ERROR:', err);
        res.status(500).json({ success: false, error: 'Error al procesar registro: ' + err.message });
    }
});

router.get('/audit-logs', authMiddleware(['ADMIN']), (req, res) => {
    const { page = 1, limit = 50, action, user_id } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(200, Math.max(1, parseInt(limit)));

    let where = '1=1';
    const params = [];
    if (action) { where += ' AND action = ?'; params.push(action); }
    if (user_id) { where += ' AND user_id = ?'; params.push(user_id); }

    const total = db.prepare(`SELECT COUNT(*) as count FROM audit_logs WHERE ${where}`).get(...params).count;
    const logs = db.prepare(`SELECT * FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, Math.min(200, parseInt(limit)), offset);

    res.json({ data: logs, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
});

module.exports = router;
