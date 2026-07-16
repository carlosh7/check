/**
 * Networking Routes (v12.44.778)
 * QR connect, enriched profiles, mutual connections, suggested connections
 */
const express = require('express');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

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
        var revExisting = db.prepare("SELECT id FROM networking_connections WHERE event_id = ? AND from_guest_id = ? AND to_guest_id = ?").get(event_id, toGuest.id, fromGuest.id);
        if (!revExisting) {
            db.prepare("INSERT INTO networking_connections (id, event_id, from_guest_id, to_guest_id) VALUES (?, ?, ?, ?)").run(uuidv4(), event_id, toGuest.id, fromGuest.id);
        }
        res.json({ success: true, alreadyConnected: false, guest: { name: toGuest.name } });
    } catch (err) { logger.error('[NETWORKING] Connect error:', err.message); res.status(500).json({ error: 'Error interno' }); }
});

// ─── Conexiones de un guest (enriquecido) ───
router.get('/:eventId/guest/:guestId', (req, res) => {
    try {
        var connections = db.prepare(`
            SELECT nc.*, g.name as connected_name, g.email as connected_email, 
                   g.organization as connected_org, g.position as connected_position
            FROM networking_connections nc
            JOIN guests g ON g.id = nc.to_guest_id
            WHERE nc.event_id = ? AND nc.from_guest_id = ?
            ORDER BY nc.connected_at DESC
        `).all(req.params.eventId, req.params.guestId);
        res.json(connections);
    } catch (err) { logger.error('[NETWORKING] Error:', err.message); res.status(500).json({ error: 'Error interno' }); }
});

// ─── Conexiones mutuas ───
router.get('/:eventId/guest/:guestId/mutual', (req, res) => {
    try {
        var mutual = db.prepare(`
            SELECT g.id, g.name, g.email, g.organization, g.position,
                   COUNT(DISTINCT nc1.to_guest_id) as mutual_count
            FROM networking_connections nc1
            JOIN networking_connections nc2 ON nc1.to_guest_id = nc2.from_guest_id AND nc2.to_guest_id = nc1.from_guest_id
            JOIN guests g ON g.id = nc1.to_guest_id
            WHERE nc1.event_id = ? AND nc1.from_guest_id = ? AND nc1.to_guest_id = nc2.from_guest_id
            GROUP BY g.id
            ORDER BY mutual_count DESC
        `).all(req.params.eventId, req.params.guestId);
        res.json(mutual);
    } catch (err) { logger.error('[NETWORKING] Mutual error:', err.message); res.status(500).json({ error: 'Error interno' }); }
});

// ─── Sugerencias de conexión (gustos compartidos) ───
router.get('/:eventId/guest/:guestId/suggestions', (req, res) => {
    try {
        // Get connected guest IDs
        const connected = db.prepare("SELECT to_guest_id FROM networking_connections WHERE event_id = ? AND from_guest_id = ?").all(req.params.eventId, req.params.guestId).map(r => r.to_guest_id);
        connected.push(req.params.guestId); // exclude self
        
        if (connected.length > 0) {
            const placeholders = connected.map(() => '?').join(',');
            const suggestions = db.prepare(`
                SELECT g.id, g.name, g.organization, g.position,
                       COUNT(DISTINCT nc.from_guest_id) as shared_connections
                FROM guests g
                JOIN networking_connections nc ON nc.to_guest_id = g.id
                WHERE nc.event_id = ? AND nc.from_guest_id IN (${placeholders})
                AND g.id NOT IN (${placeholders})
                GROUP BY g.id
                ORDER BY shared_connections DESC
                LIMIT 10
            `).all(req.params.eventId, ...connected, ...connected);
            return res.json(suggestions);
        }
        
        // If no connections yet, suggest random guests from same event
        const suggestions = db.prepare(`
            SELECT id, name, organization, position FROM guests 
            WHERE event_id = ? AND id != ? AND name IS NOT NULL
            ORDER BY RANDOM() LIMIT 10
        `).all(req.params.eventId, req.params.guestId);
        res.json(suggestions);
    } catch (err) { logger.error('[NETWORKING] Suggestions error:', err.message); res.status(500).json({ error: 'Error interno' }); }
});

// ─── Score de networking ───
router.get('/:eventId/guest/:guestId/score', (req, res) => {
    try {
        var total = db.prepare("SELECT COUNT(*) as c FROM networking_connections WHERE event_id = ? AND from_guest_id = ?").get(req.params.eventId, req.params.guestId).c;
        var uniqueTo = db.prepare("SELECT COUNT(DISTINCT to_guest_id) as c FROM networking_connections WHERE event_id = ? AND from_guest_id = ?").get(req.params.eventId, req.params.guestId).c;
        var mutualCount = db.prepare(`
            SELECT COUNT(DISTINCT nc2.from_guest_id) as c
            FROM networking_connections nc1
            JOIN networking_connections nc2 ON nc1.to_guest_id = nc2.from_guest_id AND nc2.to_guest_id = nc1.from_guest_id
            WHERE nc1.event_id = ? AND nc1.from_guest_id = ?
        `).get(req.params.eventId, req.params.guestId).c;
        var connections = db.prepare("SELECT g.id, g.name, g.email, g.organization, g.position FROM networking_connections nc JOIN guests g ON g.id = nc.to_guest_id WHERE nc.event_id = ? AND nc.from_guest_id = ? ORDER BY nc.connected_at DESC").all(req.params.eventId, req.params.guestId);
        res.json({ 
            totalConnections: total, 
            uniqueConnections: uniqueTo, 
            mutualConnections: mutualCount,
            score: uniqueTo * 10 + mutualCount * 5, 
            connections: connections 
        });
    } catch (err) { logger.error('[NETWORKING] Score error:', err.message); res.status(500).json({ error: 'Error interno' }); }
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
            var sessions = db.prepare(`
                SELECT s.title, s.start_time, s.location FROM session_guests sg
                JOIN sessions s ON sg.session_id = s.id
                WHERE sg.guest_id = ? AND s.event_id = ?
                ORDER BY s.start_time ASC
            `).all(guest.id, eventId);
            guest.sessions = sessions;
        }
        res.json(guest);
    } catch (err) { logger.error('[NETWORKING] Profile error:', err.message); res.status(500).json({ error: 'Error interno' }); }
});

// ─── Leaderboard de networking ───
router.get('/:eventId/leaderboard', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var leaders = db.prepare(`
            SELECT g.id, g.name, g.organization, g.position,
                   COUNT(DISTINCT nc.to_guest_id) as connections
            FROM guests g
            JOIN networking_connections nc ON nc.from_guest_id = g.id
            WHERE nc.event_id = ?
            GROUP BY g.id
            ORDER BY connections DESC
            LIMIT 20
        `).all(req.params.eventId);
        res.json(leaders);
    } catch (err) { logger.error('[NETWORKING] Leaderboard error:', err.message); res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
