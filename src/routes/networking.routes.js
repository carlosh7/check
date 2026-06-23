/**
 * Rutas de Networking entre Asistentes (C11-04)
 */
const express = require('express');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { castId } = require('../utils/helpers');

const router = express.Router();

var connectSchema = z.object({
    event_id: z.string().min(1, 'event_id requerido'),
    from_guest_token: z.string().min(1, 'from_guest_token requerido'),
    to_guest_token: z.string().min(1, 'to_guest_token requerido'),
    notes: z.string().max(500).optional()
});

// ─── Registrar conexión (escaneo de QR) ───

router.post('/connect', (req, res) => {
    try {
        var parsed = connectSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ errors: parsed.error.issues.map(function(e) { return e.path.join('.') + ': ' + e.message; }) });
        }
        var { event_id, from_guest_token, to_guest_token, notes } = parsed.data;
        var fromGuest = db.prepare("SELECT id, name FROM guests WHERE qr_token = ? AND event_id = ?").get(from_guest_token, event_id);
        var toGuest = db.prepare("SELECT id, name FROM guests WHERE qr_token = ? AND event_id = ?").get(to_guest_token, event_id);
        if (!fromGuest || !toGuest) return res.status(404).json({ error: 'Invitado no encontrado' });
        if (fromGuest.id === toGuest.id) return res.status(400).json({ error: 'No puedes conectarte contigo mismo' });
        var existing = db.prepare("SELECT id FROM networking_connections WHERE event_id = ? AND from_guest_id = ? AND to_guest_id = ?").get(event_id, fromGuest.id, toGuest.id);
        if (existing) return res.json({ success: true, alreadyConnected: true, guest: { name: toGuest.name } });
        var id = uuidv4();
        db.prepare("INSERT INTO networking_connections (id, event_id, from_guest_id, to_guest_id, notes) VALUES (?, ?, ?, ?, ?)").run(id, event_id, fromGuest.id, toGuest.id, notes || null);
        // Reciprocal: also create reverse connection (they connected to each other)
        var revExisting = db.prepare("SELECT id FROM networking_connections WHERE event_id = ? AND from_guest_id = ? AND to_guest_id = ?").get(event_id, toGuest.id, fromGuest.id);
        if (!revExisting) {
            db.prepare("INSERT INTO networking_connections (id, event_id, from_guest_id, to_guest_id) VALUES (?, ?, ?, ?)").run(uuidv4(), event_id, toGuest.id, fromGuest.id);
        }
        res.json({ success: true, alreadyConnected: false, guest: { name: toGuest.name } });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Conexiones de un guest ───

router.get('/:eventId/guest/:guestId', (req, res) => {
    try {
        var connections = db.prepare(`
            SELECT nc.*, g.name as connected_name, g.email as connected_email, g.organization as connected_org
            FROM networking_connections nc
            JOIN guests g ON g.id = nc.to_guest_id
            WHERE nc.event_id = ? AND nc.from_guest_id = ?
            ORDER BY nc.connected_at DESC
        `).all(req.params.eventId, req.params.guestId);
        res.json(connections);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Score de networking ───

router.get('/:eventId/guest/:guestId/score', (req, res) => {
    try {
        var total = db.prepare("SELECT COUNT(*) as c FROM networking_connections WHERE event_id = ? AND from_guest_id = ?").get(req.params.eventId, req.params.guestId).c;
        var uniqueTo = db.prepare("SELECT COUNT(DISTINCT to_guest_id) as c FROM networking_connections WHERE event_id = ? AND from_guest_id = ?").get(req.params.eventId, req.params.guestId).c;
        var connections = db.prepare("SELECT g.id, g.name, g.email, g.organization FROM networking_connections nc JOIN guests g ON g.id = nc.to_guest_id WHERE nc.event_id = ? AND nc.from_guest_id = ? ORDER BY nc.connected_at DESC").all(req.params.eventId, req.params.guestId);
        res.json({ totalConnections: total, uniqueConnections: uniqueTo, score: uniqueTo * 10, connections: connections });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Perfil público de guest (para escanear QR) ───

router.get('/profile/:guestId', (req, res) => {
    try {
        var guest = db.prepare("SELECT id, name, email, organization, position, qr_token FROM guests WHERE id = ?").get(req.params.guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        var eventId = req.query.event_id;
        if (eventId) {
            var connections = db.prepare("SELECT COUNT(*) as c FROM networking_connections WHERE event_id = ? AND (from_guest_id = ? OR to_guest_id = ?)").get(eventId, guest.id, guest.id);
            guest.connections = connections ? connections.c : 0;
        }
        res.json(guest);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
