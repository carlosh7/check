/**
 * Rutas de eventos
 *
 * @openapi
 * tags:
 *   - name: Events
 *     description: CRUD de eventos y configuración
 *
 * /api/events:
 *   get:
 *     tags: [Events]
 *     summary: Listar eventos del usuario
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de eventos }
 *   post:
 *     tags: [Events]
 *     summary: Crear nuevo evento
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       201: { description: Evento creado }
 *
 * /api/events/{id}:
 *   get:
 *     tags: [Events]
 *     summary: Obtener evento por ID
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Datos del evento }
 *   put:
 *     tags: [Events]
 *     summary: Actualizar evento
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200: { description: Evento actualizado }
 *   delete:
 *     tags: [Events]
 *     summary: Eliminar evento
 *     security: [{ BearerAuth: ['ADMIN'] }]
 *     responses:
 *       200: { description: Evento eliminado }
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, createEventDatabase, deleteEventDatabase, getEventConnection, eventDatabaseExists } = require('../../database');
const { getValidId, castId, getProducerGroups, hasEventAccess } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { schemas, validate } = require('../security/validation');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');
const { CACHE_KEYS, cacheOrFetch, del } = require('../utils/cache');
const { triggerWebhooks, WEBHOOK_EVENTS } = require('../utils/webhooks');
const { logChange } = require('../utils/change-log');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Función helper para obtener la BD correcta según el evento (V12.44.345)
function getEventDbForAttendance(eventId) {
    logger.info('[GET-EVENT-DB] ========== INICIO ==========');
    logger.info('[GET-EVENT-DB] eventId:', eventId);
    
    if (!eventId) {
        logger.info('[GET-EVENT-DB] eventId es null, retorno DB sistema');
        return db;
    }
    
    // Consultar evento en DB sistema
    const event = db.prepare("SELECT id, has_own_db, name FROM events WHERE id = ?").get(eventId);
    logger.info('[GET-EVENT-DB] Evento encontrado:', event);
    
    if (!event) {
        logger.info('[GET-EVENT-DB] Evento no encontrado en DB sistema, retorno DB sistema');
        return db;
    }
    
    logger.info('[GET-EVENT-DB] has_own_db del evento:', event.has_own_db);
    logger.info('[GET-EVENT-DB] eventDatabaseExists(eventId):', eventDatabaseExists(eventId));
    
    if (event.has_own_db === 1 && eventDatabaseExists(eventId)) {
        const eventDb = getEventConnection(eventId);
        logger.info('[GET-EVENT-DB] Conexión a DB evento exitosa:', eventDb ? 'SI' : 'NO');
        if (eventDb) {
            logger.info('[GET-EVENT-DB] >>> RETORNANDO DB DEL EVENTO <<<');
            return eventDb;
        }
    } else {
        logger.info('[GET-EVENT-DB] Condiciones NO cumplidas: has_own_db=' + event.has_own_db + ', exists=' + eventDatabaseExists(eventId));
    }
    
    logger.info('[GET-EVENT-DB] >>> RETORNANDO DB SISTEMA <<<');
    return db;
}

const logger = require("../utils/logger");
const router = express.Router();

router.get('/', authMiddleware(), async (req, res) => {
    try {
        const cacheKey = req.userRole === 'ADMIN' 
            ? CACHE_KEYS.EVENT_LIST 
            : `events:list:user:${req.userId}`;
        
        const rows = await cacheOrFetch(cacheKey, () => {
            let events;
            if (req.userRole === 'ADMIN') {
                events = db.prepare("SELECT * FROM events ORDER BY created_at DESC").all();
            } else if (req.userRole === 'ORGANIZER') {
                events = db.prepare("SELECT e.* FROM events e INNER JOIN user_events ue ON e.id = ue.event_id WHERE ue.user_id = ? ORDER BY e.created_at DESC").all(req.userId);
            } else {
                events = db.prepare("SELECT * FROM events WHERE group_id IN (SELECT group_id FROM group_users WHERE user_id = ?) ORDER BY created_at DESC").all(req.userId);
            }
            
            for (const e of events) {
                if (e.has_own_db === 1 && eventDatabaseExists(e.id)) {
                    const eventDb = getEventConnection(e.id);
                    if (eventDb) {
                        const guestCount = eventDb.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ?").get(e.id);
                        e.total_guests = guestCount.c;
                        const checkedCount = eventDb.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND checked_in = 1").get(e.id);
                        e.attended_guests = checkedCount.c;
                    } else { e.total_guests = 0; e.attended_guests = 0; }
                } else {
                    const guestCount = db.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ?").get(e.id);
                    e.total_guests = guestCount.c;
                    const checkedCount = db.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND checked_in = 1").get(e.id);
                    e.attended_guests = checkedCount.c;
                }
            }
            return events;
        }, 60);
        res.json(rows);
    } catch(err) { logger.error('[EVENTS] Error listing:', err.message); res.status(500).json({ error: 'Error al listar eventos' }); }
});

router.get('/:id', authMiddleware(), async (req, res) => {
    try {
        const eventId = castId('events', req.params.id);
        const row = await cacheOrFetch(CACHE_KEYS.EVENT(eventId), () => {
            return db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
        }, 300);
        if (!row) return res.status(404).json({ error: 'Evento no encontrado' });
        res.json(row);
    } catch(err) { logger.error('[EVENTS] Error getting event:', err.message); res.status(500).json({ error: 'Error al obtener evento' }); }
});

router.post('/', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const v = validate(schemas.createEvent, req.body);
    if (!v.valid) {
        logger.error('[EVENT CREATE VALIDATION ERROR]', v.errors);
        logger.error('[EVENT CREATE REQUEST BODY]', req.body);
        return res.status(400).json({ errors: v.errors });
    }

    const {
        name, date, location, description, group_id, end_date,
        reg_title, reg_welcome_text, reg_success_message, reg_policy,
        reg_show_phone, reg_show_org, reg_show_position, reg_show_vegan,
        reg_show_dietary, reg_show_gender, reg_require_agreement,
        qr_color_dark, qr_color_light, qr_logo_url, ticket_bg_url, ticket_accent_color,
        reg_email_whitelist, reg_email_blacklist,
        has_own_db, venue_id
    } = v.data;
    
    // logo_url no viene del formulario, se maneja por separado
    const logo_url = '';
    
    const id = getValidId('events');
    const eventGroupId = group_id || (req.userRole === 'ADMIN' ? null : getProducerGroups(req.userId)[0]);
    // POLÍTICA V12.44.299: Base de datos propia por defecto para todos los eventos
    const hasOwnDb = (has_own_db !== undefined) ? (has_own_db ? 1 : 0) : 1;

    db.prepare(`
        INSERT INTO events (
            id, user_id, name, date, location, logo_url, description, status, created_at, group_id, end_date,
            reg_title, reg_welcome_text, reg_success_message, reg_policy,
            reg_show_phone, reg_show_org, reg_show_position, reg_show_vegan,
            reg_show_dietary, reg_show_gender, reg_require_agreement,
            qr_color_dark, qr_color_light, qr_logo_url, ticket_bg_url, ticket_accent_color,
            reg_email_whitelist, reg_email_blacklist, has_own_db, venue_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id, req.userId, name, date, location, logo_url || '', description || '', 'ACTIVE', new Date().toISOString(), eventGroupId, end_date || null,
        reg_title || '', reg_welcome_text || '', reg_success_message || '', reg_policy || '',
        reg_show_phone ? 1 : 0, reg_show_org ? 1 : 0, reg_show_position ? 1 : 0, reg_show_vegan ? 1 : 0,
        reg_show_dietary ? 1 : 0, reg_show_gender ? 1 : 0, reg_require_agreement ? 1 : 0,
        qr_color_dark || '#000000', qr_color_light || '#ffffff', qr_logo_url || '', ticket_bg_url || '', ticket_accent_color || '#7c3aed',
        reg_email_whitelist || '', reg_email_blacklist || '', hasOwnDb, venue_id || null
    );

    // Crear base de datos independiente si se solicita
    if (hasOwnDb) {
        try {
            const eventDb = createEventDatabase(id);
            if (eventDb) {
                logger.info('✓ Base de datos independiente creada para evento:', id);
            }
        } catch (error) {
            logger.error('✗ Error al crear base de datos del evento:', error.message);
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
    try { triggerWebhooks(WEBHOOK_EVENTS.EVENT_CREATED, { eventId: id, name, date }, id).catch(() => {}); } catch(e) {}

    logger.info('[EVENT CREATE SERVER] ID generado:', id, 'tipo:', typeof id);
    res.json({ success: true, eventId: id });
});

router.put('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const v = validate(schemas.updateEvent, req.body);
    if (!v.valid) return res.status(400).json({ errors: v.errors });

    const eventId = castId('events', req.params.id);
    const d = v.data;

    // Handle group_id separately since COALESCE doesn't work with null
    const groupIdSql = 'group_id' in d ? '?' : 'group_id';
    const groupIdVal = 'group_id' in d ? d.group_id : undefined;

    db.prepare(`
        UPDATE events SET 
            name = COALESCE(?, name),
            date = COALESCE(?, date),
            location = COALESCE(?, location),
            logo_url = COALESCE(?, logo_url),
            description = COALESCE(?, description),
            end_date = COALESCE(?, end_date),
            status = COALESCE(?, status),
            group_id = ${groupIdSql},
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
            reg_email_blacklist = COALESCE(?, reg_email_blacklist),
            venue_id = COALESCE(?, venue_id),
            payment_required = COALESCE(?, payment_required),
            currency = COALESCE(?, currency),
            stripe_account = COALESCE(?, stripe_account),
            paypal_email = COALESCE(?, paypal_email)
        WHERE id = ?
    `).run(
        d.name, d.date, d.location, d.logo_url, d.description, d.end_date, d.status, 
        ...(groupIdVal !== undefined ? [groupIdVal] : []),
        d.reg_title, d.reg_welcome_text, d.reg_policy, d.reg_success_message, d.reg_logo_url, 
        'reg_show_phone' in d ? (d.reg_show_phone ? 1 : 0) : undefined, 
        'reg_show_org' in d ? (d.reg_show_org ? 1 : 0) : undefined, 
        'reg_show_position' in d ? (d.reg_show_position ? 1 : 0) : undefined, 
        'reg_show_vegan' in d ? (d.reg_show_vegan ? 1 : 0) : undefined, 
        'reg_show_dietary' in d ? (d.reg_show_dietary ? 1 : 0) : undefined, 
        'reg_show_gender' in d ? (d.reg_show_gender ? 1 : 0) : undefined, 
        'reg_require_agreement' in d ? (d.reg_require_agreement ? 1 : 0) : undefined, 
        d.qr_color_dark, d.qr_color_light, d.qr_logo_url, d.ticket_bg_url, d.ticket_accent_color,
        d.reg_email_whitelist, d.reg_email_blacklist, d.venue_id || null,
        'payment_required' in d ? (d.payment_required ? 1 : 0) : undefined,
        d.currency || null, d.stripe_account || null, d.paypal_email || null, eventId
    );

    // Invalidate cache
    await del(CACHE_KEYS.EVENT_LIST);
    await del(CACHE_KEYS.EVENT(eventId));
    if (req.userRole !== 'ADMIN') {
        await del(`events:list:user:${req.userId}`);
    }

    logAction(req, AUDIT_ACTIONS.EVENT_UPDATED, { eventId });
    try { triggerWebhooks(WEBHOOK_EVENTS.EVENT_UPDATED, { eventId, changes: Object.keys(d) }, eventId).catch(() => {}); } catch(e) {}

    logChange(eventId, 'event', eventId, 'updated', null, JSON.stringify(d), null, req.userId);

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
        // Obtener IDs de ruletas primero
        const wheelRows = db.prepare("SELECT id FROM event_wheels WHERE event_id = ?").all(targetId);
        const wheelIds = wheelRows.map(w => w.id);
        
        // Eliminar participantes de ruletas primero
        if (wheelIds.length > 0) {
            for (const wheelId of wheelIds) {
                db.prepare("DELETE FROM wheel_participants WHERE wheel_id = ?").run(wheelId);
                db.prepare("DELETE FROM wheel_results WHERE wheel_id = ?").run(wheelId);
                db.prepare("DELETE FROM wheel_spins WHERE wheel_id = ?").run(wheelId);
                db.prepare("DELETE FROM wheel_leads WHERE wheel_id = ?").run(wheelId);
            }
        }
        
        // Eliminar registros relacionados en orden inverso a las dependencias
        db.prepare("DELETE FROM surveys WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM survey_responses WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM event_wheels WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM event_agenda WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM pre_registrations WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM guest_suggestions WHERE event_id = ?").run(targetId);
        db.prepare("DELETE FROM guests WHERE event_id = ?").run(targetId);
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
        logger.error('[DELETE EVENT] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Obtener invitados de evento (con paginación)
router.get('/:id/guests', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.id);
        if (!eId) return res.status(400).json({ error: 'ID inválido' });
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const offset = parseInt(req.query.offset) || 0;
        const { total } = db.prepare("SELECT COUNT(*) as total FROM guests WHERE event_id = ?").get(eId);
        const rows = db.prepare("SELECT id, name, email, phone, organization, position, gender, checked_in, checkin_time, qr_token, dietary_notes, created_at FROM guests WHERE event_id = ? ORDER BY name ASC LIMIT ? OFFSET ?").all(eId, limit, offset);
        res.json({ guests: rows, total, limit, offset });
    } catch(err) { logger.error('[EVENTS] Error listing guests:', err.message); res.status(500).json({ error: 'Error al listar invitados' }); }
});

// Obtener pre-registros de evento
router.get('/:id/pre-registrations', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.id);
        const rows = db.prepare("SELECT id, name, email, phone, organization, position, gender, status, registered_at FROM pre_registrations WHERE event_id = ? AND status = 'PENDING' ORDER BY registered_at DESC").all(eId);
        res.json(rows);
    } catch(err) { logger.error('[EVENTS] Error listing pre-regs:', err.message); res.status(500).json({ error: 'Error al listar pre-registros' }); }
});

// Aprobar o rechazar pre-registro
router.put('/pre-registrations/:id/status', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const preId = req.params.id;
        const { status } = req.body;
        if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
        const pre = db.prepare("SELECT * FROM pre_registrations WHERE id = ?").get(preId);
        if (!pre) return res.status(404).json({ error: 'Pre-registro no encontrado' });
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
                logger.error(`Error triggering webhook for guest ${guestId}:`, err.message)
            );
            
            // Trigger webhook for pre-registration confirmation
            triggerWebhooks(WEBHOOK_EVENTS.PRE_REGISTRATION_CONFIRMED, {
                pre_registration_id: pre.id,
                guest_id: guestId,
                ...guestData
            }, pre.event_id).catch(err => 
                logger.error(`Error triggering webhook for pre-registration ${pre.id}:`, err.message)
            );
        }
    }
    
    db.prepare("UPDATE pre_registrations SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
    } catch(err) { logger.error('[EVENTS] Error updating pre-reg:', err.message); res.status(500).json({ error: 'Error al actualizar pre-registro' }); }
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
    const { user_id } = req.body;
    const eventId = castId('events', req.params.eventId);
    
    logger.info('[DEBUG EVENT POST] user_id:', user_id, 'eventId:', eventId, 'castEventId:', eventId);
    
    if (!user_id) {
        return res.status(400).json({ error: 'user_id es requerido' });
    }
    
    if (!hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    const id = getValidId('user_events');
    logger.info('[DEBUG EVENT POST] Insert id:', id, 'user_id:', user_id, 'event_id:', eventId);
    const result = db.prepare("INSERT OR IGNORE INTO user_events (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)")
      .run(id, user_id, eventId, new Date().toISOString());
    logger.info('[DEBUG EVENT POST] Insert result:', result);
    
    // Verificar inserción
    const check = db.prepare("SELECT * FROM user_events WHERE event_id = ? AND user_id = ?").get(eventId, user_id);
    logger.info('[DEBUG EVENT POST] Check after insert:', check);
    
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
        logger.error('Error creando base de datos del evento:', error);
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
        logger.error('Error eliminando base de datos del evento:', error);
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

// ═════════════════════════════════════════════════════════════
// GESTIÓN DE ASISTENCIA (DASHBOARD UNIFICADO V12.44.299)
// ═════════════════════════════════════════════════════════════

// GET /api/events/:id/attendance - Obtener lista de asistencia (vía tabla guests)
router.get('/:id/attendance', authMiddleware(), async (req, res) => {
    const eventId = castId('events', req.params.id);
    if (!eventId) return res.status(400).json({ error: 'ID de evento no válido' });
    
    try {
        // V12.44.342: Usar getEventDbForAttendance para consistency con guests.routes
        const targetDb = getEventDbForAttendance(eventId);
        
        logger.info('[ATTENDANCE DEBUG] eventId:', eventId);
        logger.info('[ATTENDANCE DEBUG] targetDb es DB sistema?:', targetDb === db);
        
        const attendance = targetDb.prepare(`
            SELECT 
                g.id as client_id, 
                g.name as client_name, 
                g.email as client_email, 
                g.phone as client_phone, 
                g.organization, 
                g.qr_token,
                COALESCE(g.cargo, g.position) as cargo, 
                g.vegano, 
                g.status,
                g.category_id,
                c.name as category_name,
                c.color as category_color,
                COALESCE(g.restricciones, g.dietary_notes) as restricciones, 
                g.checked_in as validated, g.checkin_time as validated_at
            FROM guests g
            LEFT JOIN guest_categories c ON g.category_id = c.id
            WHERE g.event_id = ?
            ORDER BY g.name ASC
        `).all(eventId);
        
        logger.info('[ATTENDANCE DEBUG] Registros encontrados:', attendance.length);
        
        res.json(attendance);
    } catch (e) {
        logger.error('[ATTENDANCE] Error obteniendo asistencia:', e.message);
        res.status(500).json({ error: 'Error obteniendo asistencia desde guests' });
    }
});

// POST /api/events/:id/attendance - Agregar asistente manual
router.post('/:id/attendance', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), async (req, res) => {
    const eventId = castId('events', req.params.id);
    const { name, email, phone, organization, cargo, vegano, restricciones, category_id } = req.body;
    
    if (!eventId || !name) return res.status(400).json({ error: 'ID de evento y nombre requeridos' });
    
    try {
        const targetDb = getEventDbForAttendance(eventId);
        const { v4: uuidv4 } = require('uuid');
        const id = uuidv4();
        const now = new Date().toISOString();
        
        // Verificar cupo por categoria para waitlist
        let isWaitlisted = false;
        let waitlistPosition = null;
        if (category_id) {
            const cat = targetDb.prepare("SELECT capacity FROM guest_categories WHERE id = ? AND event_id = ?").get(category_id, eventId);
            if (cat && cat.capacity > 0) {
                const activeCount = targetDb.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND category_id = ? AND (status IS NULL OR status != 'waitlisted')").get(eventId, category_id);
                if (activeCount.c >= cat.capacity) {
                    isWaitlisted = true;
                    const maxPos = targetDb.prepare("SELECT MAX(waitlist_position) as m FROM guests WHERE event_id = ? AND category_id = ? AND status = 'waitlisted'").get(eventId, category_id);
                    waitlistPosition = (maxPos.m || 0) + 1;
                }
            }
        }
        
        targetDb.prepare(`
            INSERT INTO guests (
                id, event_id, name, email, phone, organization, position, cargo, 
                vegano, dietary_notes, restricciones, category_id, status, waitlist_position, waitlisted_at, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, eventId, name, email || null, phone || null, organization || null, 
            cargo || null, cargo || null, vegano || 'NO', 
            restricciones || null, restricciones || null, category_id || null,
            isWaitlisted ? 'waitlisted' : null,
            isWaitlisted ? waitlistPosition : null,
            isWaitlisted ? now : null,
            now
        );
        
        res.json({ success: true, id, waitlisted: isWaitlisted, waitlistPosition });
    } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'El email ya está registrado para este evento' });
        }
        logger.error('[ATTENDANCE] Error al agregar:', e.message);
        res.status(500).json({ error: 'Error agregando invitado' });
    }
});

// PUT /api/events/:id/attendance/:id - Actualizar asistente (Dashboard)
router.put('/:id/attendance/:attendanceId', authMiddleware(), async (req, res) => {
    const eventId = castId('events', req.params.id);
    const attendanceId = req.params.attendanceId;
    const { validated, organization, cargo, vegano, restricciones, category_id } = req.body;
    
    if (!eventId) return res.status(400).json({ error: 'ID de evento no válido' });
    
    try {
        const targetDb = getEventDbForAttendance(eventId);
        const now = new Date().toISOString();
        
        targetDb.prepare(`
            UPDATE guests 
            SET checked_in = ?, checkin_time = ?,
                status = CASE WHEN ? = 1 THEN 'attended' ELSE status END,
                organization = COALESCE(?, organization),
                cargo = COALESCE(?, cargo),
                position = COALESCE(?, position),
                vegano = COALESCE(?, vegano),
                restricciones = COALESCE(?, restricciones),
                dietary_notes = COALESCE(?, dietary_notes),
                category_id = ?
            WHERE event_id = ? AND id = ?
        `).run(
            validated || 0, validated === 1 ? now : null,
            validated,
            organization, cargo, cargo, vegano, restricciones, restricciones,
            category_id || null, eventId, attendanceId
        );
        
        // Si se valido, registrar en guest_status_log si no estaba ya en attended
        if (validated === 1) {
            const guest = targetDb.prepare("SELECT status FROM guests WHERE id = ? AND event_id = ?").get(attendanceId, eventId);
            if (guest && guest.status !== 'attended') {
                targetDb.prepare("INSERT INTO guest_status_log (guest_id, event_id, from_status, to_status, changed_by) VALUES (?, ?, ?, ?, ?)").run(
                    attendanceId, eventId, guest.status || 'lead', 'attended', req.userId || 'system'
                );
            }
        }
        
        res.json({ success: true });
    } catch (e) {
        logger.error('[ATTENDANCE] Error actualizando:', e.message);
        res.status(500).json({ error: 'Error actualizando datos de invitado' });
    }
});

// DELETE /api/events/:id/attendance/:attendanceId - Eliminar asistente
router.delete('/:id/attendance/:attendanceId', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), async (req, res) => {
    const eventId = castId('events', req.params.id);
    const attendanceId = req.params.attendanceId;
    
    if (!eventId || !attendanceId) return res.status(400).json({ error: 'IDs requeridos' });
    
    try {
        const targetDb = getEventDbForAttendance(eventId);
        
        // Obtener datos del invitado antes de eliminar
        const deleted = targetDb.prepare("SELECT id, name, email, category_id, status, waitlist_position FROM guests WHERE id = ? AND event_id = ?").get(attendanceId, eventId);
        
        targetDb.prepare('DELETE FROM guests WHERE event_id = ? AND id = ?').run(eventId, attendanceId);
        
        // Si se elimino un invitado activo (no waitlisted), promover al primero en waitlist de esa categoria
        if (deleted && deleted.status !== 'waitlisted') {
            const catId = deleted.category_id;
            const next = targetDb.prepare("SELECT id, name, email, category_id FROM guests WHERE event_id = ? AND category_id = ? AND status = 'waitlisted' ORDER BY waitlist_position ASC LIMIT 1").get(eventId, catId);
            if (next) {
                const now = new Date().toISOString();
                targetDb.prepare("UPDATE guests SET status = 'lead', waitlist_position = NULL, promoted_at = ? WHERE id = ?").run(now, next.id);
                // Re-numerar los waitlisted restantes
                const remaining = targetDb.prepare("SELECT id FROM guests WHERE event_id = ? AND category_id = ? AND status = 'waitlisted' ORDER BY waitlist_position ASC").all(eventId, catId);
                remaining.forEach(function(g, idx) {
                    targetDb.prepare("UPDATE guests SET waitlist_position = ? WHERE id = ?").run(idx + 1, g.id);
                });
                // Registrar en auditoria
                logAction(req, AUDIT_ACTIONS.WAITLIST_PROMOTED, { guestId: next.id, name: next.name, email: next.email, categoryId: catId, eventId });
            }
        }
        
        res.json({ success: true });
    } catch (e) {
        logger.error('[ATTENDANCE] Error eliminando:', e.message);
        res.status(500).json({ error: 'Error eliminando invitado' });
    }
});

// ══════════════════════════════════════════════════════════════
// CLONAR EVENTO
// ══════════════════════════════════════════════════════════════
router.post('/:id/clone', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        const eventId = castId('events', req.params.id);
        if (!eventId) return res.status(400).json({ error: 'ID de evento inválido' });

        const original = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
        if (!original) return res.status(404).json({ error: 'Evento no encontrado' });

        const newId = getValidId('events');
        const now = new Date().toISOString();
        const newName = `${original.name} (copia)`;

        db.prepare(`
            INSERT INTO events (
                id, user_id, name, date, location, logo_url, description, status, created_at, group_id, end_date,
                reg_title, reg_welcome_text, reg_success_message, reg_policy,
                reg_show_phone, reg_show_org, reg_show_position, reg_show_vegan,
                reg_show_dietary, reg_show_gender, reg_require_agreement,
                qr_color_dark, qr_color_light, qr_logo_url, ticket_bg_url, ticket_accent_color,
                reg_email_whitelist, reg_email_blacklist, has_own_db, has_wheel
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            newId, req.userId, newName, original.date, original.location, original.logo_url, original.description, now, original.group_id, original.end_date,
            original.reg_title, original.reg_welcome_text, original.reg_success_message, original.reg_policy,
            original.reg_show_phone, original.reg_show_org, original.reg_show_position, original.reg_show_vegan,
            original.reg_show_dietary, original.reg_show_gender, original.reg_require_agreement,
            original.qr_color_dark, original.qr_color_light, original.qr_logo_url, original.ticket_bg_url, original.ticket_accent_color,
            original.reg_email_whitelist, original.reg_email_blacklist, original.has_own_db || 1, 0
        );

        if (original.has_own_db) {
            createEventDatabase(newId);
        }

        // Copiar invitados si se solicita
        if (req.body.copyGuests && original.has_own_db) {
            try {
                const sourceDb = getEventConnection(eventId);
                if (sourceDb) {
                    const guests = sourceDb.prepare("SELECT * FROM guests WHERE event_id = ?").all(eventId);
                    const targetDb = getEventConnection(newId);
                    if (targetDb && guests.length > 0) {
                        let copied = 0;
                        for (const g of guests) {
                            const newGuestId = getValidId('guests');
                            const newQrToken = uuidv4();
                            targetDb.prepare(`
                                INSERT INTO guests (id, event_id, name, email, phone, organization, position, cargo,
                                    dietary_notes, restricciones, vegano, status, group_id, checked_in, validated,
                                    checkin_time, qr_token, created_at, client_id)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
                            `).run(
                                newGuestId, newId, g.name, g.email, g.phone, g.organization, g.position, g.cargo,
                                g.dietary_notes, g.restricciones, g.vegano, g.status || 'lead', g.group_id,
                                g.checkin_time || null, newQrToken, g.created_at || now, g.client_id || null
                            );
                            copied++;
                        }
                        logger.info(`[CLONE] ${copied} invitados copiados al evento ${newId}`);
                    }
                }
            } catch (guestErr) {
                logger.error('[CLONE] Error copiando invitados:', guestErr.message);
            }
        }

        const userEventId = getValidId('user_events');
        db.prepare("INSERT OR IGNORE INTO user_events (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)")
            .run(userEventId, req.userId, newId, now);

        await del(CACHE_KEYS.EVENT_LIST);
        logAction(req, AUDIT_ACTIONS.EVENT_CREATED, { eventId: newId, name: newName, clonedFrom: eventId });

        res.json({ success: true, eventId: newId, name: newName });
    } catch (e) {
        logger.error('[CLONE] Error clonando evento:', e);
        res.status(500).json({ error: 'Error al clonar el evento: ' + e.message });
    }
});

// ── Badge Config (diseno de gafetes) ──

const badgeStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads/logos');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `badge_${req.params.id}_${Date.now()}${ext}`);
    }
});
const uploadLogo = multer({ storage: badgeStorage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
} });

// GET /api/events/:id/badge-config
router.get('/:id/badge-config', authMiddleware(), (req, res) => {
    try {
        const event = db.prepare("SELECT badge_config FROM events WHERE id = ?").get(req.params.id);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        var badgeCfg = null;
        if (event.badge_config) { try { badgeCfg = JSON.parse(event.badge_config); } catch(e) { badgeCfg = {}; } }
        res.json({ badgeConfig: badgeCfg });
    } catch (err) {
        logger.error('[BADGE_CONFIG] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener config' });
    }
});

// PUT /api/events/:id/badge-config
router.put('/:id/badge-config', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const config = JSON.stringify(req.body.config || {});
        db.prepare("UPDATE events SET badge_config = ? WHERE id = ?").run(config, req.params.id);
        res.json({ success: true });
    } catch (err) {
        logger.error('[BADGE_CONFIG] Error:', err.message);
        res.status(500).json({ error: 'Error al guardar config' });
    }
});

// POST /api/events/:id/badge-logo
router.post('/:id/badge-logo', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    uploadLogo.single('logo')(req, res, (err) => {
        if (err) return res.status(400).json({ error: 'Error al subir: ' + (err.message || 'archivo invalido') });
        if (!req.file) return res.status(400).json({ error: 'No se envio archivo' });
        const url = `/uploads/logos/${req.file.filename}`;
        res.json({ success: true, url });
    });
});

// DELETE /api/events/:id/badge-logo
router.delete('/:id/badge-logo', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const event = db.prepare("SELECT badge_config FROM events WHERE id = ?").get(req.params.id);
        if (event && event.badge_config) {
            var config = {};
            try { config = JSON.parse(event.badge_config); } catch(e) { config = {}; }
            if (config.logo) {
                try {
                    var fs = require('fs'), path = require('path');
                    var logoPath = path.join(__dirname, '../../public', config.logo);
                    if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
                } catch(e) {}
            }
            delete config.logo;
            db.prepare("UPDATE events SET badge_config = ? WHERE id = ?").run(JSON.stringify(config), req.params.id);
        }
        res.json({ success: true });
    } catch (err) {
        logger.error('[BADGE_CONFIG] Error:', err.message);
        res.status(500).json({ error: 'Error al eliminar logo' });
    }
});

// ─── Branding (BL-16) ───

router.get('/:id/branding', authMiddleware(), (req, res) => {
    try {
        var event = db.prepare("SELECT custom_css, brand_header_html, brand_footer_html, brand_primary_color, brand_logo_url, logo_url, reg_logo_url, ticket_bg_url, ticket_accent_color, qr_color_dark, qr_color_light FROM events WHERE id = ?").get(req.params.id);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        res.json(event);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/branding', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var d = req.body;
        db.prepare("UPDATE events SET custom_css = COALESCE(?, custom_css), brand_header_html = COALESCE(?, brand_header_html), brand_footer_html = COALESCE(?, brand_footer_html), brand_primary_color = COALESCE(?, brand_primary_color), brand_logo_url = COALESCE(?, brand_logo_url) WHERE id = ?").run(
            d.custom_css || null, d.brand_header_html || null, d.brand_footer_html || null,
            d.brand_primary_color || null, d.brand_logo_url || null, req.params.id
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── Calendar view (C8-02) ───
router.get('/calendar/data', authMiddleware(), (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        const events = db.prepare(`
            SELECT e.id, e.name, e.date, e.end_date, e.location, e.status,
                (SELECT COUNT(*) FROM guests g WHERE g.event_id = e.id) as guest_count,
                (SELECT COUNT(*) FROM guests g WHERE g.event_id = e.id AND g.checked_in = 1) as checked_in_count
            FROM events e
            WHERE (e.date BETWEEN ? AND ?) OR (e.end_date BETWEEN ? AND ?)
            ORDER BY e.date ASC
        `).all(startDate, endDate, startDate, endDate);
        
        res.json({ year, month, events });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
