/**
 * Rutas de eventos
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { getValidId, castId, getProducerGroups, hasEventAccess } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { schemas, validate } = require('../security/validation');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');
const { CACHE_KEYS, cacheOrFetch, del } = require('../utils/cache');
const { triggerWebhooks, WEBHOOK_EVENTS } = require('../utils/webhooks');

const router = express.Router();

router.get('/', authMiddleware(), async (req, res) => {
    const cacheKey = req.userRole === 'ADMIN' 
        ? CACHE_KEYS.EVENT_LIST 
        : `events:list:user:${req.userId}`;
    
    const rows = await cacheOrFetch(cacheKey, () => {
        if (req.userRole === 'ADMIN') {
            return db.prepare("SELECT * FROM events ORDER BY created_at DESC").all();
        } else {
            const groupIds = getProducerGroups(req.userId);
            if (groupIds.length === 0) {
                return [];
            } else {
                const placeholders = groupIds.map(() => '?').join(',');
                return db.prepare(`SELECT * FROM events WHERE group_id IN (${placeholders}) ORDER BY created_at DESC`).all(...groupIds);
            }
        }
    }, 60); // TTL 60 seconds
    
    res.json(rows);
});

router.get('/:id', authMiddleware(), async (req, res) => {
    const eventId = castId('events', req.params.id);
    const row = await cacheOrFetch(CACHE_KEYS.EVENT(eventId), () => {
        return db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    }, 300); // TTL 5 minutes
    
    if (!row) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(row);
});

router.post('/', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const v = validate(schemas.createEvent, req.body);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const { name, date, location, logo_url, description, group_id, end_date } = v.data;
    const id = getValidId('events');
    const eventGroupId = group_id || (req.userRole === 'ADMIN' ? null : getProducerGroups(req.userId)[0]);

    db.prepare("INSERT INTO events (id, user_id, name, date, location, logo_url, description, status, created_at, group_id, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)")
      .run(id, req.userId, name, date, location, logo_url || '', description || '', new Date().toISOString(), eventGroupId, end_date || null);

    const userEventId = getValidId('user_events');
    db.prepare("INSERT OR IGNORE INTO user_events (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)")
      .run(userEventId, req.userId, id, new Date().toISOString());

    // Invalidate cache
    await del(CACHE_KEYS.EVENT_LIST);
    if (req.userRole !== 'ADMIN') {
        await del(`events:list:user:${req.userId}`);
    }

    logAction(req, AUDIT_ACTIONS.EVENT_CREATED, { eventId: id, name });

    res.json({ success: true, eventId: id });
});

router.put('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const v = validate(schemas.updateEvent, req.body);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const eventId = castId('events', req.params.id);
    const d = v.data;

    db.prepare(`
        UPDATE events SET 
            name = COALESCE(?, name),
            date = COALESCE(?, date),
            location = COALESCE(?, location),
            logo_url = COALESCE(?, logo_url),
            description = COALESCE(?, description),
            end_date = COALESCE(?, end_date),
            status = COALESCE(?, status),
            reg_title = COALESCE(?, reg_title),
            reg_welcome_text = COALESCE(?, reg_welcome_text),
            reg_policy = COALESCE(?, reg_policy),
            reg_success_message = COALESCE(?, reg_success_message),
            reg_logo_url = COALESCE(?, reg_logo_url),
            reg_show_phone = COALESCE(?, reg_show_phone),
            reg_show_org = COALESCE(?, reg_show_org),
            reg_show_position = COALESCE(?, reg_show_position),
            reg_show_vegan = COALESCE(?, reg_show_vegan),
            reg_show_dietary = COALESCE(?, reg_show_dietary),
            reg_show_gender = COALESCE(?, reg_show_gender),
            reg_require_agreement = COALESCE(?, reg_require_agreement),
            qr_color_dark = COALESCE(?, qr_color_dark),
            qr_color_light = COALESCE(?, qr_color_light),
            qr_logo_url = COALESCE(?, qr_logo_url),
            ticket_bg_url = COALESCE(?, ticket_bg_url),
            ticket_accent_color = COALESCE(?, ticket_accent_color),
            reg_email_whitelist = COALESCE(?, reg_email_whitelist),
            reg_email_blacklist = COALESCE(?, reg_email_blacklist)
        WHERE id = ?
    `).run(d.name, d.date, d.location, logo_url, d.description, d.end_date, d.status, d.reg_title, d.reg_welcome_text, d.reg_policy, d.reg_success_message, d.reg_logo_url, d.reg_show_phone, d.reg_show_org, d.reg_show_position, d.reg_show_vegan, d.reg_show_dietary, d.reg_show_gender, d.reg_require_agreement, d.qr_color_dark, d.qr_color_light, d.qr_logo_url, d.ticket_bg_url, d.ticket_accent_color, d.reg_email_whitelist, d.reg_email_blacklist, eventId);

    // Invalidate cache
    await del(CACHE_KEYS.EVENT_LIST);
    await del(CACHE_KEYS.EVENT(eventId));
    if (req.userRole !== 'ADMIN') {
        await del(`events:list:user:${req.userId}`);
    }

    logAction(req, AUDIT_ACTIONS.EVENT_UPDATED, { eventId });

    res.json({ success: true });
});

router.delete('/:id', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('events', req.params.id);

    logAction(req, AUDIT_ACTIONS.EVENT_DELETED, { eventId: targetId });

    db.prepare("DELETE FROM events WHERE id = ?").run(targetId);
    res.json({ success: true });
});

// Obtener invitados de evento
router.get('/:id/guests', authMiddleware(), (req, res) => {
    const eId = castId('events', req.params.id);
    const rows = db.prepare("SELECT * FROM guests WHERE event_id = ? ORDER BY name ASC").all(eId);
    res.json(rows);
});

// Obtener pre-registros de evento
router.get('/:id/pre-registrations', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eId = castId('events', req.params.id);
    const rows = db.prepare("SELECT * FROM pre_registrations WHERE event_id = ? AND status = 'PENDING' ORDER BY registered_at DESC").all(eId);
    res.json(rows);
});

// Aprobar o rechazar pre-registro
router.put('/pre-registrations/:id/status', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { status } = req.body;
    const id = castId('pre_registrations', req.params.id);
    
    if (status === 'APPROVED') {
        const pre = db.prepare("SELECT * FROM pre_registrations WHERE id = ?").get(id);
        if (pre) {
            const guestId = getValidId('guests');
            const qrToken = uuidv4();
            db.prepare(`INSERT INTO guests (id, event_id, name, email, phone, organization, position, gender, dietary_notes, qr_token, is_new_registration)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
              .run(guestId, pre.event_id, pre.name, pre.email, pre.phone, pre.organization, pre.position, pre.gender, pre.dietary_notes, qrToken);
            
            const guestData = {
                id: guestId,
                event_id: pre.event_id,
                name: pre.name,
                email: pre.email,
                phone: pre.phone,
                organization: pre.organization,
                position: pre.position,
                gender: pre.gender,
                dietary_notes: pre.dietary_notes,
                qr_token: qrToken,
                is_new_registration: 1
            };
            
            // Trigger webhooks for guest creation
            triggerWebhooks(WEBHOOK_EVENTS.GUEST_CREATED, guestData, pre.event_id).catch(err => 
                console.error(`Error triggering webhook for guest ${guestId}:`, err.message)
            );
            
            // Trigger webhook for pre-registration confirmation
            triggerWebhooks(WEBHOOK_EVENTS.PRE_REGISTRATION_CONFIRMED, {
                pre_registration_id: pre.id,
                guest_id: guestId,
                ...guestData
            }, pre.event_id).catch(err => 
                console.error(`Error triggering webhook for pre-registration ${pre.id}:`, err.message)
            );
        }
    }
    
    db.prepare("UPDATE pre_registrations SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
});

// Obtener usuarios asignados a un evento
router.get('/:eventId/users', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    
    if (req.userRole === 'PRODUCTOR') {
        if (!hasEventAccess(req.userId, eventId, req.userRole)) {
            return res.status(403).json({ error: 'No tienes acceso a este evento' });
        }
    }
    
    const users = db.prepare(`
        SELECT u.id, u.username, u.display_name, u.role, u.status, ue.created_at as assigned_at
        FROM users u
        INNER JOIN user_events ue ON u.id = ue.user_id
        WHERE ue.event_id = ?
        ORDER BY u.display_name || u.username
    `).all(eventId);
    
    res.json(users);
});

// Asignar usuario a evento
router.post('/:eventId/users', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { userId } = req.body;
    const eventId = castId('events', req.params.eventId);
    
    if (!hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    const id = getValidId('user_events');
    db.prepare("INSERT OR IGNORE INTO user_events (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)")
      .run(id, userId, eventId, new Date().toISOString());
    
    res.json({ success: true });
});

// Eliminar usuario de evento
router.delete('/:eventId/users/:userId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const userId = castId('users', req.params.userId);
    
    if (!hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    db.prepare("DELETE FROM user_events WHERE event_id = ? AND user_id = ?").run(eventId, userId);
    res.json({ success: true });
});

// --- EMAIL CONFIG POR EVENTO (NUEVO V12.18.17) ---
router.get('/:id/email-config', authMiddleware(), async (req, res) => {
    const eventId = castId('events', req.params.id);
    
    // Verificar acceso
    if (req.userRole !== 'ADMIN' && !hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    const config = db.prepare("SELECT * FROM event_email_config WHERE event_id = ?").get(eventId);
    res.json(config || { event_id: eventId, subject_prefix: '', template_id: null });
});

router.put('/:id/email-config', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const eventId = castId('events', req.params.id);
    
    if (!hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    const { subject_prefix, template_id, send_confirmation, send_reminder } = req.body;
    
    // Upsert config
    const existing = db.prepare("SELECT id FROM event_email_config WHERE event_id = ?").get(eventId);
    
    if (existing) {
        db.prepare(`
            UPDATE event_email_config SET 
                subject_prefix = COALESCE(?, subject_prefix),
                template_id = COALESCE(?, template_id),
                send_confirmation = COALESCE(?, send_confirmation),
                send_reminder = COALESCE(?, send_reminder)
            WHERE event_id = ?
        `).run(subject_prefix, template_id, send_confirmation, send_reminder, eventId);
    } else {
        const id = getValidId('event_email_config');
        db.prepare(`
            INSERT INTO event_email_config (id, event_id, subject_prefix, template_id, send_confirmation, send_reminder)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, eventId, subject_prefix || '', template_id, send_confirmation ? 1 : 0, send_reminder ? 1 : 0);
    }
    
    res.json({ success: true });
});

// --- EMAIL TEST (NUEVO V12.18.17) ---
router.post('/:id/email-test', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const eventId = castId('events', req.params.id);
    
    if (!hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email requerido' });
    }
    
    // Simular envío de email de prueba (aquí integrate con tu sistema de email)
    console.log(`[EMAIL TEST] Sending test email to ${email} for event ${eventId}`);
    
    res.json({ success: true, message: `Email de prueba enviado a ${email}` });
});

// --- AGENDA DEL EVENTO (NUEVO V12.18.17) ---
router.get('/:id/agenda', authMiddleware(), async (req, res) => {
    const eventId = castId('events', req.params.id);
    const rows = db.prepare("SELECT * FROM event_agenda WHERE event_id = ? ORDER BY start_time ASC").all(eventId);
    res.json(rows);
});

router.post('/:id/agenda', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const eventId = castId('events', req.params.id);
    
    if (!hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    const { title, description, start_time, end_time, duration, speaker, location } = req.body;
    const id = getValidId('event_agenda');
    
    db.prepare(`
        INSERT INTO event_agenda (id, event_id, title, description, start_time, end_time, duration, speaker, location, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, eventId, title, description, start_time, end_time, duration, speaker, location, new Date().toISOString());
    
    res.json({ success: true, id });
});

router.put('/agenda/:agendaId', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const agendaId = castId('event_agenda', req.params.agendaId);
    const { title, description, time, duration, speaker, location } = req.body;
    
    // Verificar acceso a través del evento
    const agenda = db.prepare("SELECT event_id FROM event_agenda WHERE id = ?").get(agendaId);
    if (!agenda || !hasEventAccess(req.userId, agenda.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    db.prepare(`
        UPDATE event_agenda SET 
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            time = COALESCE(?, time),
            duration = COALESCE(?, duration),
            speaker = COALESCE(?, speaker),
            location = COALESCE(?, location)
        WHERE id = ?
    `).run(title, description, time, duration, speaker, location, agendaId);
    
    res.json({ success: true });
});

router.delete('/agenda/:agendaId', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const agendaId = castId('event_agenda', req.params.agendaId);
    
    // Verificar acceso
    const agenda = db.prepare("SELECT event_id FROM event_agenda WHERE id = ?").get(agendaId);
    if (!agenda || !hasEventAccess(req.userId, agenda.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    db.prepare("DELETE FROM event_agenda WHERE id = ?").run(agendaId);
    res.json({ success: true });
});

// --- EVENTOS DE USUARIO (NUEVO V12.18.17) ---
router.get('/user/:userId', authMiddleware(), async (req, res) => {
    const targetUserId = castId('users', req.params.userId);
    
    // Solo admins o el propio usuario pueden ver
    if (req.userRole !== 'ADMIN' && req.userId !== targetUserId) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    const events = db.prepare(`
        SELECT e.*, ue.created_at as assigned_at
        FROM events e
        INNER JOIN user_events ue ON e.id = ue.event_id
        WHERE ue.user_id = ?
        ORDER BY e.date DESC
    `).all(targetUserId);
    
    res.json(events);
});

// --- EMAIL TEMPLATES POR EVENTO (NUEVO V12.18.17) ---
router.get('/:id/email-templates', authMiddleware(), async (req, res) => {
    const eventId = castId('events', req.params.id);
    
    // Verificar acceso
    if (req.userRole !== 'ADMIN' && !hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    const templates = db.prepare("SELECT * FROM event_email_templates WHERE event_id = ?").all(eventId);
    res.json(templates);
});

router.post('/:id/email-templates/:templateType', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const eventId = castId('events', req.params.id);
    const templateType = req.params.templateType;
    
    if (!hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    const { subject, body, enabled } = req.body;
    const id = getValidId('event_email_templates');
    
    db.prepare(`
        INSERT INTO event_email_templates (id, event_id, template_type, subject, body, enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, eventId, templateType, subject, body, enabled ? 1 : 0, new Date().toISOString());
    
    res.json({ success: true, id });
});

router.put('/email-templates/:templateId', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const templateId = castId('event_email_templates', req.params.templateId);
    const { subject, body, enabled } = req.body;
    
    // Verificar acceso
    const template = db.prepare("SELECT event_id FROM event_email_templates WHERE id = ?").get(templateId);
    if (!template || !hasEventAccess(req.userId, template.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    db.prepare(`
        UPDATE event_email_templates SET 
            subject = COALESCE(?, subject),
            body = COALESCE(?, body),
            enabled = COALESCE(?, enabled)
        WHERE id = ?
    `).run(subject, body, enabled ? 1 : 0, templateId);
    
    res.json({ success: true });
});

router.delete('/email-templates/:templateId', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const templateId = castId('event_email_templates', req.params.templateId);
    
    // Verificar acceso
    const template = db.prepare("SELECT event_id FROM event_email_templates WHERE id = ?").get(templateId);
    if (!template || !hasEventAccess(req.userId, template.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    db.prepare("DELETE FROM event_email_templates WHERE id = ?").run(templateId);
    res.json({ success: true });
});

module.exports = router;
