const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { getEventDb } = require('../utils/event-db');

const router = express.Router();

// GET /api/sessions/:eventId — Listar sesiones
router.get('/:eventId', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const targetDb = getEventDb(eId);
        const sessions = targetDb.prepare("SELECT * FROM sessions WHERE event_id = ? ORDER BY sort_order ASC, date ASC, start_time ASC").all(eId);
        // Agregar conteo de invitados por sesion
        const counts = targetDb.prepare("SELECT session_id, COUNT(*) as count FROM session_guests WHERE event_id = ? GROUP BY session_id").all(eId);
        const countMap = {};
        counts.forEach(r => countMap[r.session_id] = r.count);
        sessions.forEach(s => s.guestCount = countMap[s.id] || 0);
        res.json(sessions);
    } catch (err) {
        console.error('[SESSIONS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener sesiones' });
    }
});

// POST /api/sessions/:eventId — Crear sesion
router.post('/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const { title, description, date, start_time, end_time, capacity, location, sort_order, layout_id } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ error: 'Titulo requerido' });
        const id = uuidv4();
        const targetDb = getEventDb(eId);
        targetDb.prepare(`INSERT INTO sessions (id, event_id, title, description, date, start_time, end_time, capacity, location, layout_id, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            id, eId, title.trim(), description || null, date || null, start_time || null,
            end_time || null, capacity || 0, location || null, layout_id || null, sort_order || 0
        );
        res.json({ success: true, id });
    } catch (err) {
        console.error('[SESSIONS] Error:', err.message);
        res.status(500).json({ error: 'Error al crear sesion' });
    }
});

// PUT /api/sessions/:eventId/:sessionId — Editar sesion
router.put('/:eventId/:sessionId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const sId = req.params.sessionId;
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const { title, description, date, start_time, end_time, capacity, location, sort_order, layout_id } = req.body;
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
        res.json({ success: true });
    } catch (err) {
        console.error('[SESSIONS] Error:', err.message);
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
        targetDb.prepare("DELETE FROM sessions WHERE id = ? AND event_id = ?").run(sId, eId);
        res.json({ success: true });
    } catch (err) {
        console.error('[SESSIONS] Error:', err.message);
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
        const session = targetDb.prepare("SELECT capacity FROM sessions WHERE id = ? AND event_id = ?").get(sId, eId);
        if (!session) return res.status(404).json({ error: 'Sesion no encontrada' });
        if (session.capacity > 0) {
            const count = targetDb.prepare("SELECT COUNT(*) as c FROM session_guests WHERE session_id = ?").get(sId);
            if (count.c >= session.capacity) return res.status(400).json({ error: 'Capacidad completa' });
        }
        // Verificar que el asiento no este ocupado
        if (seat_id) {
            const taken = targetDb.prepare("SELECT id FROM session_guests WHERE session_id = ? AND seat_id = ?").get(sId, seat_id);
            if (taken) return res.status(400).json({ error: 'Asiento ocupado' });
        }
        const id = uuidv4();
        targetDb.prepare("INSERT INTO session_guests (id, session_id, guest_id, event_id, seat_id) VALUES (?, ?, ?, ?, ?)").run(id, sId, guest_id, eId, seat_id || null);
        res.json({ success: true, id, seat_id: seat_id || null });
    } catch (err) {
        console.error('[SESSIONS] Error:', err.message);
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
        console.error('[SESSIONS] Error:', err.message);
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
        console.error('[SESSIONS] Error:', err.message);
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
        console.error('[SESSIONS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener sesiones del invitado' });
    }
});

module.exports = router;
