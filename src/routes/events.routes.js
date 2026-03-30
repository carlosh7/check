/**
 * Rutas de eventos
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, createEventDatabase, deleteEventDatabase } = require('../../database');
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
        const sql = `
            SELECT e.*, 
                (SELECT COUNT(*) FROM guests g WHERE g.event_id = e.id) as total_guests,
                (SELECT COUNT(*) FROM guests g WHERE g.event_id = e.id AND g.checked_in = 1) as attended_guests,
                (SELECT COUNT(*) FROM pre_registrations pr WHERE pr.event_id = e.id AND pr.status = 'PENDING') as pending_pre_reg
            FROM events e
            ${req.userRole === 'ADMIN' ? '' : 'WHERE e.group_id IN (SELECT group_id FROM group_users WHERE user_id = ?)'}
            ORDER BY e.created_at DESC
        `;

        if (req.userRole === 'ADMIN') {
            return db.prepare(sql).all();
        } else {
            return db.prepare(sql).all(req.userId);
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
    if (!v.valid) {
        console.error('[EVENT CREATE VALIDATION ERROR]', v.errors);
        console.error('[EVENT CREATE REQUEST BODY]', req.body);
        return res.status(400).json({ errors: v.errors });
    }

    const { 
        name, date, location, description, group_id, end_date,
        reg_title, reg_welcome_text, reg_success_message, reg_policy,
        reg_show_phone, reg_show_org, reg_show_position, reg_show_vegan,
        reg_show_dietary, reg_show_gender, reg_require_agreement,
        qr_color_dark, qr_color_light, qr_logo_url, ticket_bg_url, ticket_accent_color,
        reg_email_whitelist, reg_email_blacklist,
        has_own_db
    } = v.data;
    
    // logo_url no viene del formulario, se maneja por separado
    const logo_url = '';
    
    const id = getValidId('events');
    const eventGroupId = group_id || (req.userRole === 'ADMIN' ? null : getProducerGroups(req.userId)[0]);
    const hasOwnDb = has_own_db ? 1 : 0;

    db.prepare(`
        INSERT INTO events (
            id, user_id, name, date, location, logo_url, description, status, created_at, group_id, end_date,
            reg_title, reg_welcome_text, reg_success_message, reg_policy,
            reg_show_phone, reg_show_org, reg_show_position, reg_show_vegan,
            reg_show_dietary, reg_show_gender, reg_require_agreement,
            qr_color_dark, qr_color_light, qr_logo_url, ticket_bg_url, ticket_accent_color,
            reg_email_whitelist, reg_email_blacklist, has_own_db
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id, req.userId, name, date, location, logo_url || '', description || '', 'ACTIVE', new Date().toISOString(), eventGroupId, end_date || null,
        reg_title || '', reg_welcome_text || '', reg_success_message || '', reg_policy || '',
        reg_show_phone ? 1 : 0, reg_show_org ? 1 : 0, reg_show_position ? 1 : 0, reg_show_vegan ? 1 : 0,
        reg_show_dietary ? 1 : 0, reg_show_gender ? 1 : 0, reg_require_agreement ? 1 : 0,
        qr_color_dark || '#000000', qr_color_light || '#ffffff', qr_logo_url || '', ticket_bg_url || '', ticket_accent_color || '#7c3aed',
        reg_email_whitelist || '', reg_email_blacklist || '', hasOwnDb
    );

    // Crear base de datos independiente si se solicita
    if (hasOwnDb) {
        try {
            const eventDb = createEventDatabase(id);
            if (eventDb) {
                console.log('✓ Base de datos independiente creada para evento:', id);
            }
        } catch (error) {
            console.error('✗ Error al crear base de datos del evento:', error.message);
        }
    }

    const userEventId = getValidId('user_events');
    db.prepare("INSERT OR IGNORE INTO user_events (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)")
      .run(userEventId, req.userId, id, new Date().toISOString());

    // Invalidate cache
    await del(CACHE_KEYS.EVENT_LIST);
    if (req.userRole !== 'ADMIN') {
        await del(`events:list:user:${req.userId}`);
    }

    logAction(req, AUDIT_ACTIONS.EVENT_CREATED, { eventId: id, name });

    console.log('[EVENT CREATE SERVER] ID generado:', id, 'tipo:', typeof id);
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
    `).run(
        d.name, d.date, d.location, d.logo_url, d.description, d.end_date, d.status, 
        d.reg_title, d.reg_welcome_text, d.reg_policy, d.reg_success_message, d.reg_logo_url, 
        (d.reg_show_phone === true || d.reg_show_phone === 1) ? 1 : 0, 
        (d.reg_show_org === true || d.reg_show_org === 1) ? 1 : 0, 
        (d.reg_show_position === true || d.reg_show_position === 1) ? 1 : 0, 
        (d.reg_show_vegan === true || d.reg_show_vegan === 1) ? 1 : 0, 
        (d.reg_show_dietary === true || d.reg_show_dietary === 1) ? 1 : 0, 
        (d.reg_show_gender === true || d.reg_show_gender === 1) ? 1 : 0, 
        (d.reg_require_agreement === true || d.reg_require_agreement === 1) ? 1 : 0, 
        d.qr_color_dark, d.qr_color_light, d.qr_logo_url, d.ticket_bg_url, d.ticket_accent_color, d.reg_email_whitelist, d.reg_email_blacklist, eventId
    );

    // Invalidate cache
    await del(CACHE_KEYS.EVENT_LIST);
    await del(CACHE_KEYS.EVENT(eventId));
    if (req.userRole !== 'ADMIN') {
        await del(`events:list:user:${req.userId}`);
    }

    logAction(req, AUDIT_ACTIONS.EVENT_UPDATED, { eventId });

    res.json({ success: true });
});

router.delete('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const targetId = castId('events', req.params.id);
    
    // Verificar permisos: PRODUCTOR solo puede borrar sus propios eventos
    if (req.userRole === 'PRODUCTOR') {
        const event = db.prepare("SELECT user_id FROM events WHERE id = ?").get(targetId);
        if (!event) {
            return res.status(404).json({ success: false, error: 'Evento no encontrado' });
        }
        if (event.user_id !== req.userId) {
            return res.status(403).json({ success: false, error: 'Acceso denegado' });
        }
    }

    // Eliminar en cascada todos los registros relacionados con el evento
    try {
        // Eliminar registros relacionados en orden inverso a las dependencias
        db.prepare("DELETE FROM surveys WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM event_wheels WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM event_email_templates WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM event_email_config WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM event_agenda WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM pre_registrations WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM guests WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM event_users WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM user_events WHERE event_id = ?").run(targetId);
        
        // Eliminar el evento
        db.prepare("DELETE FROM events WHERE id = ?").run(targetId);
        
        // INVALIDAR CACHÉ cuando se elimina un evento
        await del(CACHE_KEYS.EVENT_LIST);
        await del(`events:list:user:${req.userId}`);
        await del(CACHE_KEYS.EVENT(targetId));
        
        logAction(req, AUDIT_ACTIONS.EVENT_DELETED, { eventId: targetId });
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE EVENT] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
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

// ============================================
// RULETA DE SORTEOS (FASE 1 - MVP)
// ============================================

// GET /api/events/:id/wheels - Listar ruletas del evento
router.get('/:id/wheels', authMiddleware(), async (req, res) => {
    const eventId = castId('events', req.params.id);
    
    if (!hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    const wheels = db.prepare(`
        SELECT * FROM event_wheels 
        WHERE event_id = ? 
        ORDER BY created_at DESC
    `).all(eventId);
    
    res.json(wheels);
});

// POST /api/events/:id/wheels - Crear ruleta
router.post('/:id/wheels', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const eventId = castId('events', req.params.id);
    
    if (!hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    const { name, config } = req.body;
    const id = getValidId('event_wheels');
    
    db.prepare(`
        INSERT INTO event_wheels (id, event_id, name, config, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, eventId, name || 'Nueva Ruleta', JSON.stringify(config || {}));
    
    // Actualizar flag en evento
    db.prepare("UPDATE events SET has_wheel = 1 WHERE id = ?").run(eventId);
    
    const wheel = db.prepare("SELECT * FROM event_wheels WHERE id = ?").get(id);
    res.json(wheel);
});

// GET /api/wheels/:wheelId - Obtener ruleta específica
router.get('/wheels/:wheelId', authMiddleware(), async (req, res) => {
    const wheelId = req.params.wheelId;
    
    const wheel = db.prepare(`
        SELECT ew.*, e.name as event_name 
        FROM event_wheels ew
        JOIN events e ON ew.event_id = e.id
        WHERE ew.id = ?
    `).get(wheelId);
    
    if (!wheel) {
        return res.status(404).json({ error: 'Ruleta no encontrada' });
    }
    
    if (!hasEventAccess(req.userId, wheel.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    wheel.config = JSON.parse(wheel.config || '{}');
    res.json(wheel);
});

// PUT /api/wheels/:wheelId - Actualizar ruleta
router.put('/wheels/:wheelId', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const wheelId = req.params.wheelId;
    
    const wheel = db.prepare("SELECT event_id FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel || !hasEventAccess(req.userId, wheel.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    const { name, config, is_active } = req.body;
    
    db.prepare(`
        UPDATE event_wheels 
        SET name = COALESCE(?, name),
            config = COALESCE(?, config),
            is_active = COALESCE(?, is_active),
            updated_at = datetime('now')
        WHERE id = ?
    `).run(name, config ? JSON.stringify(config) : null, is_active, wheelId);
    
    const updated = db.prepare("SELECT * FROM event_wheels WHERE id = ?").get(wheelId);
    updated.config = JSON.parse(updated.config || '{}');
    res.json(updated);
});

// DELETE /api/wheels/:wheelId - Eliminar ruleta
router.delete('/wheels/:wheelId', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const wheelId = req.params.wheelId;
    
    const wheel = db.prepare("SELECT event_id FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel || !hasEventAccess(req.userId, wheel.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    // Eliminar relacionados primero
    db.prepare("DELETE FROM wheel_participants WHERE wheel_id = ?").run(wheelId);
    db.prepare("DELETE FROM wheel_spins WHERE wheel_id = ?").run(wheelId);
    db.prepare("DELETE FROM wheel_leads WHERE wheel_id = ?").run(wheelId);
    db.prepare("DELETE FROM event_wheels WHERE id = ?").run(wheelId);
    
    res.json({ success: true });
});

// GET /api/wheels/:wheelId/participants - Listar participantes
router.get('/wheels/:wheelId/participants', authMiddleware(), async (req, res) => {
    const wheelId = req.params.wheelId;
    
    const wheel = db.prepare("SELECT event_id FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel || !hasEventAccess(req.userId, wheel.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    const participants = db.prepare(`
        SELECT * FROM wheel_participants 
        WHERE wheel_id = ?
        ORDER BY created_at DESC
    `).all(wheelId);
    
    res.json(participants);
});

// POST /api/wheels/:wheelId/participants - Agregar participante(s)
router.post('/wheels/:wheelId/participants', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const wheelId = req.params.wheelId;
    
    const wheel = db.prepare("SELECT event_id FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel || !hasEventAccess(req.userId, wheel.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    const { participants } = req.body; // Array de {name, email, phone}
    
    if (!Array.isArray(participants)) {
        return res.status(400).json({ error: 'participants debe ser un array' });
    }
    
    const insert = db.prepare(`
        INSERT INTO wheel_participants (id, wheel_id, guest_id, name, email, phone, source)
        VALUES (?, ?, ?, ?, ?, ?, 'manual')
    `);
    
    const inserted = [];
    for (const p of participants) {
        const id = getValidId('wheel_participants');
        insert.run(id, wheelId, null, p.name, p.email || null, p.phone || null);
        inserted.push({ id, name: p.name, email: p.email });
    }
    
    res.json({ success: true, added: inserted });
});

// POST /api/wheels/:wheelId/participants/from-guests - Agregar desde guests
router.post('/wheels/:wheelId/participants/from-guests', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const wheelId = req.params.wheelId;
    
    const wheel = db.prepare("SELECT event_id FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel || !hasEventAccess(req.userId, wheel.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    const { filter } = req.body; // 'all', 'checked_in', 'pre_registered'
    
    let guests;
    if (filter === 'checked_in') {
        guests = db.prepare(`
            SELECT g.id, g.name, g.email, g.phone 
            FROM guests g 
            WHERE g.event_id = ? AND g.status = 'CONFIRMED'
        `).all(wheel.event_id);
    } else if (filter === 'pre_registered') {
        guests = db.prepare(`
            SELECT g.id, g.name, g.email, g.phone 
            FROM guests g 
            WHERE g.event_id = ? AND g.status = 'PENDING'
        `).all(wheel.event_id);
    } else {
        // all
        guests = db.prepare(`
            SELECT g.id, g.name, g.email, g.phone 
            FROM guests g 
            WHERE g.event_id = ?
        `).all(wheel.event_id);
    }
    
    const insert = db.prepare(`
        INSERT INTO wheel_participants (id, wheel_id, guest_id, name, email, phone, source)
        VALUES (?, ?, ?, ?, ?, ?, 'guests')
    `);
    
    let added = 0;
    for (const g of guests) {
        // Verificar que no exista
        const exists = db.prepare(`
            SELECT id FROM wheel_participants 
            WHERE wheel_id = ? AND (guest_id = ? OR (name = ? AND email = ?))
        `).get(wheelId, g.id, g.name, g.email);
        
        if (!exists) {
            insert.run(getValidId('wheel_participants'), wheelId, g.id, g.name, g.email, g.phone);
            added++;
        }
    }
    
    res.json({ success: true, added });
});

// DELETE /api/wheels/:wheelId/participants/:participantId - Eliminar participante
router.delete('/wheels/:wheelId/participants/:participantId', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const { wheelId, participantId } = req.params;
    
    const wheel = db.prepare("SELECT event_id FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel || !hasEventAccess(req.userId, wheel.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    db.prepare("DELETE FROM wheel_participants WHERE id = ?").run(participantId);
    res.json({ success: true });
});

// POST /api/wheels/:wheelId/spin - Girar ruleta (seleccionar ganador)
router.post('/wheels/:wheelId/spin', async (req, res) => {
    const wheelId = req.params.wheelId;
    
    // Obtener ruleta
    const wheel = db.prepare(`
        SELECT ew.*, e.name as event_name 
        FROM event_wheels ew
        JOIN events e ON ew.event_id = e.id
        WHERE ew.id = ?
    `).get(wheelId);
    
    if (!wheel) {
        return res.status(404).json({ error: 'Ruleta no encontrada' });
    }
    
    // Obtener participantes
    const participants = db.prepare(`
        SELECT * FROM wheel_participants WHERE wheel_id = ?
    `).all(wheelId);
    
    if (participants.length === 0) {
        return res.status(400).json({ error: 'No hay participantes en la ruleta' });
    }
    
    // Seleccionar ganador aleatorio
    const winner = participants[Math.floor(Math.random() * participants.length)];
    
    // Guardar en historial
    const spinId = getValidId('wheel_spins');
    db.prepare(`
        INSERT INTO wheel_spins (id, wheel_id, participant_id, winner_name, winner_email, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(spinId, wheelId, winner.id, winner.name, winner.email, req.ip);
    
    res.json({
        success: true,
        winner: {
            id: winner.id,
            name: winner.name,
            email: winner.email
        },
        total_participants: participants.length
    });
});

// GET /api/wheels/:wheelId/spins - Historial de giros
router.get('/wheels/:wheelId/spins', authMiddleware(), async (req, res) => {
    const wheelId = req.params.wheelId;
    
    const wheel = db.prepare("SELECT event_id FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel || !hasEventAccess(req.userId, wheel.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    const spins = db.prepare(`
        SELECT * FROM wheel_spins 
        WHERE wheel_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    `).all(wheelId);
    
    res.json(spins);
});

// POST /api/wheels/:wheelId/capture-lead - Capturar lead (público)
router.post('/wheels/:wheelId/capture-lead', async (req, res) => {
    const wheelId = req.params.wheelId;
    const { name, email, phone, company } = req.body;
    
    if (!name || !email) {
        return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }
    
    const wheel = db.prepare("SELECT is_active FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel || !wheel.is_active) {
        return res.status(400).json({ error: 'Ruleta no disponible' });
    }
    
    const id = getValidId('wheel_leads');
    db.prepare(`
        INSERT INTO wheel_leads (id, wheel_id, name, email, phone, company, source_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, wheelId, name, email, phone || null, company || null, req.get('referer') || null);
    
    res.json({ success: true, lead_id: id });
});

// GET /api/wheels/:wheelId/leads - Ver leads capturados
router.get('/wheels/:wheelId/leads', authMiddleware(), async (req, res) => {
    const wheelId = req.params.wheelId;
    
    const wheel = db.prepare("SELECT event_id FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel || !hasEventAccess(req.userId, wheel.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    const leads = db.prepare(`
        SELECT * FROM wheel_leads 
        WHERE wheel_id = ?
        ORDER BY created_at DESC
    `).all(wheelId);
    
    res.json(leads);
});

// GET /api/wheels/:wheelId/public - Obtener ruleta para modo público
router.get('/wheels/:wheelId/public', async (req, res) => {
    const wheelId = req.params.wheelId;
    
    const wheel = db.prepare(`
        SELECT ew.id, ew.name, ew.config, ew.is_active, e.name as event_name
        FROM event_wheels ew
        JOIN events e ON ew.event_id = e.id
        WHERE ew.id = ?
    `).get(wheelId);
    
    if (!wheel || !wheel.is_active) {
        return res.status(404).json({ error: 'Ruleta no encontrada o inactiva' });
    }
    
    wheel.config = JSON.parse(wheel.config || '{}');
    
    // Obtener participantes (solo nombre para la ruleta)
    const participants = db.prepare(`
        SELECT name FROM wheel_participants WHERE wheel_id = ?
    `).all(wheelId);
    
    res.json({
        ...wheel,
        participants: participants.map(p => p.name)
    });
});

// ============================================
// RESULTADOS DE RULETA (Fase 2 - V12.26.0)
// ============================================

// GET /api/wheels/:wheelId/results - Listar resultados guardados
router.get('/wheels/:wheelId/results', authMiddleware(), async (req, res) => {
    const wheelId = req.params.wheelId;
    
    const wheel = db.prepare("SELECT event_id FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel || !hasEventAccess(req.userId, wheel.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    const results = db.prepare(`
        SELECT * FROM wheel_results 
        WHERE wheel_id = ?
        ORDER BY created_at DESC
    `).all(wheelId);
    
    // Parse winners_json para cada resultado
    const parsed = results.map(r => ({
        ...r,
        winners: JSON.parse(r.winners_json || '[]')
    }));
    
    res.json(parsed);
});

// POST /api/wheels/:wheelId/results - Guardar resultado (sorteo)
// SIN authMiddleware porque wheelId es UUID secreto que solo el admin conoce
router.post('/wheels/:wheelId/results', async (req, res) => {
    const wheelId = req.params.wheelId;
    
    const wheel = db.prepare("SELECT id, event_id FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel) {
        return res.status(404).json({ error: 'Ruleta no encontrada' });
    }
    
    const { name, winners, total_participants, notes } = req.body;
    
    if (!name || !winners || !Array.isArray(winners)) {
        return res.status(400).json({ error: 'name y winners (array) son requeridos' });
    }
    
    const id = getValidId('wheel_results');
    db.prepare(`
        INSERT INTO wheel_results (id, wheel_id, name, winners_json, total_participants, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, wheelId, name, JSON.stringify(winners), total_participants || winners.length, notes || null);
    
    const result = db.prepare("SELECT * FROM wheel_results WHERE id = ?").get(id);
    result.winners = JSON.parse(result.winners_json || '[]');
    
    res.json(result);
});

// DELETE /api/wheels/:wheelId/results/:resultId - Eliminar un resultado
router.delete('/wheels/:wheelId/results/:resultId', authMiddleware(), async (req, res) => {
    const { wheelId, resultId } = req.params;
    
    const wheel = db.prepare("SELECT event_id FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel || !hasEventAccess(req.userId, wheel.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    db.prepare("DELETE FROM wheel_results WHERE id = ? AND wheel_id = ?").run(resultId, wheelId);
    res.json({ success: true });
});

// DELETE /api/wheels/:wheelId/results - Eliminar todos los resultados
router.delete('/wheels/:wheelId/results', authMiddleware(), async (req, res) => {
    const wheelId = req.params.wheelId;
    
    const wheel = db.prepare("SELECT event_id FROM event_wheels WHERE id = ?").get(wheelId);
    if (!wheel || !hasEventAccess(req.userId, wheel.event_id, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso' });
    }
    
    db.prepare("DELETE FROM wheel_results WHERE wheel_id = ?").run(wheelId);
    res.json({ success: true });
});

// ═══ GESTIÓN DE BASE DE DATOS POR EVENTO ═══

// POST /api/events/:id/database - Crear base de datos independiente para un evento
router.post('/:id/database', authMiddleware(['ADMIN']), async (req, res) => {
    const eventId = castId('events', req.params.id);
    if (!eventId) {
        return res.status(400).json({ success: false, error: 'ID de evento no válido' });
    }
    
    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    if (!event) {
        return res.status(404).json({ success: false, error: 'Evento no encontrado' });
    }
    
    if (event.has_own_db === 1) {
        return res.json({ success: true, message: 'El evento ya tiene base de datos independiente' });
    }
    
    try {
        const eventDb = createEventDatabase(eventId);
        if (eventDb) {
            // Actualizar campo en la tabla events
            db.prepare("UPDATE events SET has_own_db = 1 WHERE id = ?").run(eventId);
            
            // Invalidar cache
            await del(CACHE_KEYS.EVENT(eventId));
            
            return res.json({ success: true, message: 'Base de datos independiente creada' });
        } else {
            return res.status(500).json({ success: false, error: 'Error al crear base de datos' });
        }
    } catch (error) {
        console.error('Error creando base de datos del evento:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/events/:id/database - Eliminar base de datos independiente de un evento
router.delete('/:id/database', authMiddleware(['ADMIN']), async (req, res) => {
    const eventId = castId('events', req.params.id);
    if (!eventId) {
        return res.status(400).json({ success: false, error: 'ID de evento no válido' });
    }
    
    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    if (!event) {
        return res.status(404).json({ success: false, error: 'Evento no encontrado' });
    }
    
    if (event.has_own_db !== 1) {
        return res.json({ success: true, message: 'El evento no tiene base de datos independiente' });
    }
    
    try {
        const deleted = deleteEventDatabase(eventId);
        if (deleted) {
            // Actualizar campo en la tabla events
            db.prepare("UPDATE events SET has_own_db = 0 WHERE id = ?").run(eventId);
            
            // Invalidar cache
            await del(CACHE_KEYS.EVENT(eventId));
            
            return res.json({ success: true, message: 'Base de datos independiente eliminada' });
        } else {
            return res.status(500).json({ success: false, error: 'Error al eliminar base de datos' });
        }
    } catch (error) {
        console.error('Error eliminando base de datos del evento:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/events/:id/database - Verificar estado de base de datos del evento
router.get('/:id/database', authMiddleware(), async (req, res) => {
    const eventId = castId('events', req.params.id);
    if (!eventId) {
        return res.status(400).json({ error: 'ID de evento no válido' });
    }
    
    const event = db.prepare("SELECT id, name, has_own_db FROM events WHERE id = ?").get(eventId);
    if (!event) {
        return res.status(404).json({ error: 'Evento no encontrado' });
    }
    
    const hasDb = eventDatabaseExists(eventId);
    
    res.json({
        eventId: event.id,
        eventName: event.name,
        has_own_db: event.has_own_db,
        database_exists: hasDb,
        status: event.has_own_db === 1 && hasDb ? 'active' : 'inactive'
    });
});

module.exports = router;
