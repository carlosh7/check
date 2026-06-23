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
const { db, getEventConnection, eventDatabaseExists } = require('../../database');
const { generateCaptcha, verifyCaptcha } = require('../security/captcha');
const { AuditLog } = require('../security/audit');

const router = express.Router();
const { castId } = require('../utils/helpers');
const { triggerWebhooks, WEBHOOK_EVENTS } = require('../utils/webhooks');
const { authMiddleware } = require('../middleware/auth');

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
                                     reg_email_whitelist, reg_email_blacklist,
                                     payment_required, currency,
                                     latitude, longitude, map_zoom, music_url, video_conference_url
                              FROM events WHERE id = ?`).get(id);

    if (!event) return res.status(404).json({ success: false, error: 'Evento no encontrado' });
    res.json(event);
});

router.get('/captcha', (req, res) => {
    const captcha = generateCaptcha();
    res.json({ question: captcha.question, token: captcha.token });
});

// Portal del asistente (BL-28)
router.get('/portal/:guestId', (req, res) => {
    try {
        let gId = castId('guests', req.params.guestId);
        if (!gId) return res.status(400).json({ error: 'ID de invitado no válido' });
        let guest = db.prepare("SELECT g.*, e.name as event_name, e.date as event_date, e.location as event_location, e.description as event_description FROM guests g JOIN events e ON g.event_id = e.id WHERE g.id = ?").get(gId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });

        // Sessions from event DB
        let sessions = [];
        try {
            let { getEventConnection } = require('../../database');
            let eventDb = getEventConnection(guest.event_id);
            if (eventDb) {
                sessions = eventDb.prepare("SELECT id, title, date, start_time, end_time, location FROM sessions WHERE event_id = ? ORDER BY start_time ASC").all(guest.event_id);
            }
        } catch(_) {}

        res.json({
            guest: { id: guest.id, name: guest.name, email: guest.email, checked_in: guest.checked_in, qr_token: guest.qr_token, category_id: guest.category_id },
            event: { id: guest.event_id, name: guest.event_name, date: guest.event_date, location: guest.event_location, description: guest.event_description },
            sessions: sessions
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── Kiosko Auto-Check-In (C11-03) ──

// Buscar invitados por nombre (para kiosko)
router.get('/kiosk/:eventId/search', (req, res) => {
    try {
        var q = req.query.q || '';
        if (!q || q.length < 2) return res.json([]);
        var eId = require('../utils/helpers').castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'Evento inválido' });
        var event = db.prepare("SELECT id, has_own_db FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        var targetDb = require('../../database');
        if (event.has_own_db) {
            try { targetDb = require('../utils/database-manager').getEventConnection(eId) || targetDb; } catch(e) {}
        }
        var guests = targetDb.prepare("SELECT id, name, email, organization, checked_in FROM guests WHERE event_id = ? AND (name LIKE ? OR email LIKE ? OR organization LIKE ?) LIMIT 20").all(eId, '%' + q + '%', '%' + q + '%', '%' + q + '%');
        res.json(guests);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Auto-check-in público (vía QR token)
router.post('/kiosk/checkin', (req, res) => {
    try {
        var { guest_token } = req.body;
        if (!guest_token) return res.status(400).json({ error: 'Token requerido' });
        var guest = db.prepare("SELECT * FROM guests WHERE qr_token = ?").get(guest_token);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        if (guest.checked_in) return res.json({ success: true, alreadyCheckedIn: true, guest: { name: guest.name } });
        var targetDb = require('../../database');
        var eventData = db.prepare("SELECT id, has_own_db FROM events WHERE id = ?").get(guest.event_id);
        if (eventData && eventData.has_own_db) {
            try { targetDb = require('../utils/database-manager').getEventConnection(guest.event_id) || targetDb; } catch(e) {}
        }
        targetDb.prepare("UPDATE guests SET checked_in = 1, checkin_time = ?, status = 'attended' WHERE id = ?").run(new Date().toISOString(), guest.id);
        // Trigger webhook
        try {
            var wh = require('./webhooks.routes');
            if (wh && wh.triggerWebhooks) wh.triggerWebhooks('guest.checked_in', { guest_id: guest.id, event_id: guest.event_id, name: guest.name, email: guest.email, source: 'kiosk' }, guest.event_id).catch(function() {});
        } catch(e) {}
        // Emit socket event
        try {
            var io = require('../../src/socket').getIO();
            if (io) { io.to(guest.event_id).emit('update_stats', guest.event_id); io.to(guest.event_id).emit('live_checkin', { name: guest.name, id: guest.id, event_id: guest.event_id, source: 'kiosk' }); }
        } catch(e) {}
        res.json({ success: true, alreadyCheckedIn: false, guest: { name: guest.name } });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Obtener datos del evento para el kiosko
router.get('/kiosk/:eventId/event', (req, res) => {
    try {
        var eId = require('../utils/helpers').castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'Evento inválido' });
        var event = db.prepare("SELECT id, name, date, location, logo_url, banner_url, primary_color FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        // Obtener stats
        var targetDb = require('../../database');
        if (event.has_own_db) {
            try { targetDb = require('../utils/database-manager').getEventConnection(eId) || targetDb; } catch(e) {}
        }
        var total = targetDb.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ?").get(eId).c;
        var checkedIn = targetDb.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND checked_in = 1").get(eId).c;
        event.stats = { total: total, checkedIn: checkedIn };
        res.json(event);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ICS Calendar (C2-07)
router.get('/event/:id/ics', (req, res) => {
    try {
        let id = castId('events', req.params.id);
        if (!id) return res.status(400).json({ error: 'ID inválido' });
        let event = db.prepare("SELECT id, name, date, end_date, location, description FROM events WHERE id = ?").get(id);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        let startDate = event.date ? new Date(event.date) : new Date();
        let endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

        let fmt = function(d) {
            return d.toISOString().replace(/-/g, '').replace(/:/g, '').split('.')[0] + 'Z';
        };

        let esc = function(t) { return (t || '').replace(/,/g, '\\,').replace(/\n/g, '\\n'); };

        let ics = [
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
        let guest = db.prepare("SELECT id, qr_token FROM guests WHERE id = ?").get(req.params.guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        let QRCode = require('qrcode');
        let url = (req.headers['x-forwarded-proto'] || 'http') + '://' + req.get('host') + '/api/guests/by-id/' + guest.id;
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
        let guest = db.prepare("SELECT id, qr_token FROM guests WHERE id = ?").get(req.params.guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        res.json({ token: guest.qr_token });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Buscar evento por slug (para kiosko)
router.get('/event-by-slug/:slug', (req, res) => {
    try {
        var slug = req.params.slug;
        var event = db.prepare("SELECT id, name FROM events WHERE slug = ? OR id = ? LIMIT 1").get(slug, slug);
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
router.post('/public-register', async (req, res) => {
    const { event_id, name, email, phone, organization, position, gender, dietary_notes } = req.body;
    
    if (!event_id || !name || !email) {
        return res.status(400).json({ success: false, error: 'Datos requeridos: event_id, name, email' });
    }
    
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
        res.json({ success: true, message: isWaitlisted ? 'Registrado en lista de espera' : 'Registro exitoso', guestId, qrToken, waitlisted: isWaitlisted, waitlistPosition });
    } catch (err) {
        console.error('[public-register] CRITICAL ERROR:', err);
        res.status(500).json({ success: false, error: 'Error al procesar registro: ' + err.message });
    }
});

router.get('/audit-logs', authMiddleware(['ADMIN']), (req, res) => {
    const { page = 1, limit = 50, action, user_id } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(200, Math.max(1, parseInt(limit)));

    let where = '1=1';
    let params = [];
    if (action) { where += ' AND action = ?'; params.push(action); }
    if (user_id) { where += ' AND user_id = ?'; params.push(user_id); }

    const total = db.prepare(`SELECT COUNT(*) as count FROM audit_logs WHERE ${where}`).get(...params).count;
    const logs = db.prepare(`SELECT * FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, Math.min(200, parseInt(limit)), offset);

    res.json({ data: logs, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
});

module.exports = router;
