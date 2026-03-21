/**
 * Rutas de eventos
 */

const express = require('express');
const { db } = require('../../database');
const { getValidId, castId, getProducerGroups } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Obtener eventos
router.get('/', authMiddleware(), (req, res) => {
    let rows;
    if (req.userRole === 'ADMIN') {
        rows = db.prepare("SELECT * FROM events ORDER BY created_at DESC").all();
    } else {
        const groupIds = getProducerGroups(req.userId);
        if (groupIds.length === 0) {
            rows = [];
        } else {
            const placeholders = groupIds.map(() => '?').join(',');
            rows = db.prepare(`SELECT * FROM events WHERE group_id IN (${placeholders}) ORDER BY created_at DESC`).all(...groupIds);
        }
    }
    res.json(rows);
});

// Obtener evento por ID
router.get('/:id', authMiddleware(), (req, res) => {
    const eventId = castId('events', req.params.id);
    const row = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    if (!row) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(row);
});

// Crear evento
router.post('/', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { name, date, location, logo_url, description, group_id, end_date } = req.body;
    const id = getValidId('events');
    const eventGroupId = group_id || (req.userRole === 'ADMIN' ? null : getProducerGroups(req.userId)[0]);
    
    db.prepare("INSERT INTO events (id, user_id, name, date, location, logo_url, description, status, created_at, group_id, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)")
      .run(id, req.userId, name, date, location, logo_url || '', description || '', new Date().toISOString(), eventGroupId, end_date || null);
    
    const userEventId = getValidId('user_events');
    db.prepare("INSERT OR IGNORE INTO user_events (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)")
      .run(userEventId, req.userId, id, new Date().toISOString());
    
    res.json({ success: true, eventId: id });
});

// Actualizar evento
router.put('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.id);
    const { name, date, location, logo_url, description, end_date, status, reg_title, reg_welcome_text, reg_policy, reg_success_message, reg_logo_url, reg_show_phone, reg_show_org, reg_show_position, reg_show_vegan, reg_show_dietary, reg_show_gender, reg_require_agreement, qr_color_dark, qr_color_light, qr_logo_url, ticket_bg_url, ticket_accent_color, reg_email_whitelist, reg_email_blacklist } = req.body;
    
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
    `).run(name, date, location, logo_url, description, end_date, status, reg_title, reg_welcome_text, reg_policy, reg_success_message, reg_logo_url, reg_show_phone, reg_show_org, reg_show_position, reg_show_vegan, reg_show_dietary, reg_show_gender, reg_require_agreement, qr_color_dark, qr_color_light, qr_logo_url, ticket_bg_url, ticket_accent_color, reg_email_whitelist, reg_email_blacklist, eventId);
    
    res.json({ success: true });
});

// Eliminar evento
router.delete('/:id', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('events', req.params.id);
    db.prepare("DELETE FROM events WHERE id = ?").run(targetId);
    res.json({ success: true });
});

// Obtener invitados de evento
router.get('/:id/guests', authMiddleware(), (req, res) => {
    const eId = castId('events', req.params.id);
    const rows = db.prepare("SELECT * FROM guests WHERE event_id = ? ORDER BY name ASC").all(eId);
    res.json(rows);
});

module.exports = router;
