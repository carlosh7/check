/**
 * Sessions Routes (v12.44.777)
 * CRUD + Conflict detection + Speaker assignment + Capacity management
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { getEventDb } = require('../utils/event-db');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/sessions/:eventId — Listar sesiones
router.get('/:eventId', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const targetDb = getEventDb(eId);
        const sessions = targetDb.prepare("SELECT * FROM sessions WHERE event_id = ? ORDER BY sort_order ASC, date ASC, start_time ASC").all(eId);
        const counts = targetDb.prepare("SELECT session_id, COUNT(*) as count FROM session_guests WHERE event_id = ? GROUP BY session_id").all(eId);
        const countMap = {};
        counts.forEach(r => countMap[r.session_id] = r.count);
        sessions.forEach(s => s.guestCount = countMap[s.id] || 0);
        res.json(sessions);
    } catch (err) {
        logger.error('[SESSIONS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener sesiones' });
    }
});

// POST /api/sessions/:eventId/conflicts — Check time conflicts
router.post('/:eventId/conflicts', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const { date, start_time, end_time, location, exclude_session_id } = req.body;
        if (!date || !start_time || !end_time) {
            return res.status(400).json({ error: 'date, start_time, end_time requeridos' });
        }
        const targetDb = getEventDb(eId);
        
        let sql = `SELECT id, title, date, start_time, end_time, location FROM sessions 
            WHERE event_id = ? AND date = ? 
            AND start_time < ? AND end_time > ?`;
        let params = [eId, date, end_time, start_time];
        
        if (exclude_session_id) {
            sql += ` AND id != ?`;
            params.push(exclude_session_id);
        }
        
        const conflicts = targetDb.prepare(sql).all(...params);
        
        // Also check location conflicts
        let locationConflicts = [];
        if (location) {
            locationConflicts = targetDb.prepare(
                `SELECT id, title, date, start_time, end_time, location FROM sessions 
                WHERE event_id = ? AND date = ? AND location = ? AND location IS NOT NULL AND location != ''
                AND start_time < ? AND end_time > ? AND id != ?`
            ).all(eId, date, location, end_time, start_time, exclude_session_id || 'none');
        }
        
        res.json({
            has_conflicts: conflicts.length > 0 || locationConflicts.length > 0,
            time_conflicts: conflicts,
            location_conflicts: locationConflicts
        });
    } catch (err) {
        logger.error('[SESSIONS] Conflict check error:', err.message);
        res.status(500).json({ error: 'Error al verificar conflictos' });
    }
});

// POST /api/sessions/:eventId — Crear sesion (with conflict check)
router.post('/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const { title, description, date, start_time, end_time, capacity, location, sort_order, layout_id, speaker_ids } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ error: 'Titulo requerido' });
        
        // Auto-check conflicts
        if (date && start_time && end_time) {
            const targetDb = getEventDb(eId);
            const conflicts = targetDb.prepare(
                `SELECT id, title FROM sessions WHERE event_id = ? AND date = ? AND start_time < ? AND end_time > ?`
            ).all(eId, date, end_time, start_time);
            if (conflicts.length > 0) {
                return res.status(409).json({ 
                    error: 'Conflicto de horario detectado',
                    conflicts: conflicts.map(c => ({ id: c.id, title: c.title }))
                });
            }
        }
        
        const id = uuidv4();
        const targetDb = getEventDb(eId);
        targetDb.prepare(`INSERT INTO sessions (id, event_id, title, description, date, start_time, end_time, capacity, location, layout_id, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            id, eId, title.trim(), description || null, date || null, start_time || null,
            end_time || null, capacity || 0, location || null, layout_id || null, sort_order || 0
        );
        
        // Assign speakers
        if (Array.isArray(speaker_ids) && speaker_ids.length > 0) {
            const insertSpeaker = targetDb.prepare("INSERT OR IGNORE INTO session_speakers (session_id, speaker_id) VALUES (?, ?)");
            speaker_ids.forEach(sid => insertSpeaker.run(id, sid));
        }
        
        res.json({ success: true, id });
    } catch (err) {
        logger.error('[SESSIONS] Error:', err.message);
        res.status(500).json({ error: 'Error al crear sesion' });
    }
});

// PUT /api/sessions/:eventId/:sessionId — Editar sesion (with conflict check)
router.put('/:eventId/:sessionId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const sId = req.params.sessionId;
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const { title, description, date, start_time, end_time, capacity, location, sort_order, layout_id, speaker_ids } = req.body;
        
        // Auto-check conflicts if time is being changed
        if (date && start_time && end_time) {
            const targetDb = getEventDb(eId);
            const conflicts = targetDb.prepare(
                `SELECT id, title FROM sessions WHERE event_id = ? AND date = ? AND start_time < ? AND end_time > ? AND id != ?`
            ).all(eId, date, end_time, start_time, sId);
            if (conflicts.length > 0) {
                return res.status(409).json({ 
                    error: 'Conflicto de horario detectado',
                    conflicts: conflicts.map(c => ({ id: c.id, title: c.title }))
                });
            }
        }
        
        const targetDb = getEventDb(eId);
        targetDb.prepare(`UPDATE sessions SET
            title = COALESCE(?, title), description = COALESCE(?, description),
            date = COALESCE(?, date), start_time = COALESCE(?, start_time),
            end_time = COALESCE(?, end_time), capacity = COALESCE(?, capacity),
            location = COALESCE(?, location), layout_id = COALESCE(?, layout_id), sort_order = COALESCE(?, sort_order)
            WHERE id = ? AND event_id = ?`).run(
            title || null, description || null, date || null, start_time || null,
            end_time || null, capacity != null ? capacity : null, location || null,
            layout_id || null, sort_order != null ? sort_order : null, sId, eId
        );
        
        // Update speakers
        if (Array.isArray(speaker_ids)) {
            targetDb.prepare("DELETE FROM session_speakers WHERE session_id = ?").run(sId);
            const insertSpeaker = targetDb.prepare("INSERT OR IGNORE INTO session_speakers (session_id, speaker_id) VALUES (?, ?)");
            speaker_ids.forEach(sid => insertSpeaker.run(sId, sid));
        }
        
        res.json({ success: true });
    } catch (err) {
        logger.error('[SESSIONS] Error:', err.message);
        res.status(500).json({ error: 'Error al actualizar sesion' });
    }
});

// DELETE /api/sessions/:eventId/:sessionId — Eliminar sesion
router.delete('/:eventId/:sessionId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const sId = req.params.sessionId;
        const targetDb = getEventDb(eId);
        targetDb.prepare("DELETE FROM session_guests WHERE session_id = ?").run(sId);
        targetDb.prepare("DELETE FROM session_speakers WHERE session_id = ?").run(sId);
        targetDb.prepare("DELETE FROM sessions WHERE id = ? AND event_id = ?").run(sId, eId);
        res.json({ success: true });
    } catch (err) {
        logger.error('[SESSIONS] Error:', err.message);
        res.status(500).json({ error: 'Error al eliminar sesion' });
    }
});

// POST /api/sessions/:eventId/:sessionId/register — Registrar invitado a sesion
router.post('/:eventId/:sessionId/register', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const sId = req.params.sessionId;
        const { guest_id, seat_id } = req.body;
        if (!guest_id) return res.status(400).json({ error: 'guest_id requerido' });
        const targetDb = getEventDb(eId);
        const session = targetDb.prepare("SELECT capacity, date, start_time, end_time FROM sessions WHERE id = ? AND event_id = ?").get(sId, eId);
        if (!session) return res.status(404).json({ error: 'Sesion no encontrada' });
        if (session.capacity > 0) {
            const count = targetDb.prepare("SELECT COUNT(*) as c FROM session_guests WHERE session_id = ?").get(sId);
            if (count.c >= session.capacity) return res.status(400).json({ error: 'Capacidad completa' });
        }
        // Check guest doesn't have overlapping session
        if (session.date && session.start_time && session.end_time) {
            const overlap = targetDb.prepare(`
                SELECT s.title FROM session_guests sg
                JOIN sessions s ON sg.session_id = s.id
                WHERE sg.guest_id = ? AND s.event_id = ? AND s.date = ? 
                AND s.start_time < ? AND s.end_time > ? AND s.id != ?
            `).get(guest_id, eId, session.date, session.end_time, session.start_time, sId);
            if (overlap) {
                return res.status(409).json({ error: `El invitado ya tiene una sesion en ese horario: "${overlap.title}"` });
            }
        }
        if (seat_id) {
            const taken = targetDb.prepare("SELECT id FROM session_guests WHERE session_id = ? AND seat_id = ?").get(sId, seat_id);
            if (taken) return res.status(400).json({ error: 'Asiento ocupado' });
        }
        const id = uuidv4();
        targetDb.prepare("INSERT INTO session_guests (id, session_id, guest_id, event_id, seat_id) VALUES (?, ?, ?, ?, ?)").run(id, sId, guest_id, eId, seat_id || null);
        res.json({ success: true, id, seat_id: seat_id || null });
    } catch (err) {
        logger.error('[SESSIONS] Error:', err.message);
        res.status(500).json({ error: 'Error al registrar invitado' });
    }
});

// DELETE /api/sessions/:eventId/:sessionId/register/:guestId — Desregistrar invitado
router.delete('/:eventId/:sessionId/register/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const sId = req.params.sessionId;
        const gId = req.params.guestId;
        const targetDb = getEventDb(eId);
        targetDb.prepare("DELETE FROM session_guests WHERE session_id = ? AND guest_id = ?").run(sId, gId);
        res.json({ success: true });
    } catch (err) {
        logger.error('[SESSIONS] Error:', err.message);
        res.status(500).json({ error: 'Error al desregistrar invitado' });
    }
});

// GET /api/sessions/:eventId/:sessionId/guests — Invitados de una sesion
router.get('/:eventId/:sessionId/guests', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const sId = req.params.sessionId;
        const targetDb = getEventDb(eId);
        const guests = targetDb.prepare(`
            SELECT sg.*, g.name, g.email, g.organization, g.phone
            FROM session_guests sg
            LEFT JOIN guests g ON sg.guest_id = g.id
            WHERE sg.session_id = ? ORDER BY g.name ASC
        `).all(sId);
        res.json(guests);
    } catch (err) {
        logger.error('[SESSIONS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener invitados' });
    }
});

// GET /api/sessions/:eventId/my-sessions/:guestId — Sesiones de un invitado
router.get('/:eventId/my-sessions/:guestId', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const gId = req.params.guestId;
        const targetDb = getEventDb(eId);
        const sessions = targetDb.prepare(`
            SELECT s.*, sg.checked_in, sg.checkin_time, sg.seat_id
            FROM session_guests sg
            INNER JOIN sessions s ON sg.session_id = s.id
            WHERE sg.guest_id = ? AND s.event_id = ?
            ORDER BY s.date ASC, s.start_time ASC
        `).all(gId, eId);
        res.json(sessions);
    } catch (err) {
        logger.error('[SESSIONS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener sesiones del invitado' });
    }
});

module.exports = router;
