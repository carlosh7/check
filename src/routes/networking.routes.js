/**
 * Networking Routes (v12.44.778)
 * QR connect, enriched profiles, mutual connections, suggested connections
 */
const express = require('express');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');
// v12.44.846 (auditoría 2026-11-25, S12): identidad pública del portal sin exponer qr_token
const { portalTokenFor, verifyPortalToken } = require('../security/portal-token');

const router = express.Router();
// v12.44.848 (auditoría 2026-11-25, S11): control de acceso al evento en las rutas con :eventId
const { requireEventAccess } = require('../middleware/event-access');

// v12.44.846 (auditoría 2026-11-25, S12): las rutas del portal ya no usan qr_token (la credencial
// del check-in) como identidad. Exigen el token de portal del propio asistente.
function portalSelfOk(req, res) {
    if (!verifyPortalToken(req.query.t, req.params.guestId)) {
        res.status(403).json({ error: 'Token de portal inválido' });
        return false;
    }
    return true;
}

// Devuelve el invitado al que apunta un token de portal (el "to" al escanear un QR ajeno)
function guestByPortalToken(token, eventId) {
    const guestId = verifyPortalToken(token);
    if (!guestId) return null;
    return db.prepare("SELECT id, name FROM guests WHERE id = ? AND event_id = ?").get(guestId, eventId) || null;
}

// Las sugerencias llevan el token de portal del otro asistente, nunca su qr_token
function withPortalToken(rows) {
    return rows.map(function(r) {
        const row = Object.assign({}, r);
        row.portal_token = portalTokenFor(row.id);
        delete row.qr_token;
        return row;
    });
}

const connectSchema = z.object({
    event_id: z.string().min(1, 'event_id requerido'),
    from_guest_token: z.string().min(1, 'from_guest_token requerido'),
    to_guest_token: z.string().min(1, 'to_guest_token requerido'),
    notes: z.string().max(500).optional()
});

// ─── Registrar conexión (escaneo de QR) ───
router.post('/connect', (req, res) => {
    try {
        const parsed = connectSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ errors: parsed.error.issues.map(function(e) { return e.path.join('.') + ': ' + e.message; }) });
        }
        const { event_id, from_guest_token, to_guest_token, notes } = parsed.data;
        // v12.44.846 (S12): los dos tokens son de portal (firmados), nunca qr_token
        const fromGuest = guestByPortalToken(from_guest_token, event_id);
        const toGuest = guestByPortalToken(to_guest_token, event_id);
        if (!fromGuest || !toGuest) return res.status(404).json({ error: 'Invitado no encontrado' });
        if (fromGuest.id === toGuest.id) return res.status(400).json({ error: 'No puedes conectarte contigo mismo' });
        const existing = db.prepare("SELECT id FROM networking_connections WHERE event_id = ? AND from_guest_id = ? AND to_guest_id = ?").get(event_id, fromGuest.id, toGuest.id);
        if (existing) return res.json({ success: true, alreadyConnected: true, guest: { name: toGuest.name } });
        const id = uuidv4();
        db.prepare("INSERT INTO networking_connections (id, event_id, from_guest_id, to_guest_id, notes) VALUES (?, ?, ?, ?, ?)").run(id, event_id, fromGuest.id, toGuest.id, notes || null);
        const revExisting = db.prepare("SELECT id FROM networking_connections WHERE event_id = ? AND from_guest_id = ? AND to_guest_id = ?").get(event_id, toGuest.id, fromGuest.id);
        if (!revExisting) {
            db.prepare("INSERT INTO networking_connections (id, event_id, from_guest_id, to_guest_id) VALUES (?, ?, ?, ?)").run(uuidv4(), event_id, toGuest.id, fromGuest.id);
        }
        res.json({ success: true, alreadyConnected: false, guest: { name: toGuest.name } });
    } catch (err) { logger.error('[NETWORKING] Connect error:', err.message); res.status(500).json({ error: 'Error interno' }); }
});

// ─── Conexiones de un guest (enriquecido) ───
router.get('/:eventId/guest/:guestId', (req, res) => {
    // v12.44.846 (auditoría 2026-11-25, S12): el portal exige el token de portal del propio asistente
    if (!portalSelfOk(req, res)) return;
    try {
        const connections = db.prepare(`
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
    // v12.44.846 (auditoría 2026-11-25, S12): el portal exige el token de portal del propio asistente
    if (!portalSelfOk(req, res)) return;
    try {
        const mutual = db.prepare(`
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
    // v12.44.846 (auditoría 2026-11-25, S12): el portal exige el token de portal del propio asistente
    if (!portalSelfOk(req, res)) return;
    try {
        // Get connected guest IDs
        const connected = db.prepare("SELECT to_guest_id FROM networking_connections WHERE event_id = ? AND from_guest_id = ?").all(req.params.eventId, req.params.guestId).map(r => r.to_guest_id);
        connected.push(req.params.guestId); // exclude self
        
        if (connected.length > 0) {
            const placeholders = connected.map(() => '?').join(',');
            const suggestions = db.prepare(`
                SELECT g.id, g.name, g.organization, g.position, g.qr_token,
                       COUNT(DISTINCT nc.from_guest_id) as shared_connections
                FROM guests g
                JOIN networking_connections nc ON nc.to_guest_id = g.id
                WHERE nc.event_id = ? AND nc.from_guest_id IN (${placeholders})
                AND g.id NOT IN (${placeholders})
                GROUP BY g.id
                ORDER BY shared_connections DESC
                LIMIT 10
            `).all(req.params.eventId, ...connected, ...connected);
            return res.json(withPortalToken(suggestions));
        }
        
        // If no connections yet, suggest random guests from same event
        const suggestions = db.prepare(`
            SELECT id, name, organization, position, qr_token FROM guests 
            WHERE event_id = ? AND id != ? AND name IS NOT NULL
            ORDER BY RANDOM() LIMIT 10
        `).all(req.params.eventId, req.params.guestId);
        res.json(withPortalToken(suggestions));
    } catch (err) { logger.error('[NETWORKING] Suggestions error:', err.message); res.status(500).json({ error: 'Error interno' }); }
});

// ─── Score de networking ───
router.get('/:eventId/guest/:guestId/score', (req, res) => {
    // v12.44.846 (auditoría 2026-11-25, S12): el portal exige el token de portal del propio asistente
    if (!portalSelfOk(req, res)) return;
    try {
        const total = db.prepare("SELECT COUNT(*) as c FROM networking_connections WHERE event_id = ? AND from_guest_id = ?").get(req.params.eventId, req.params.guestId).c;
        const uniqueTo = db.prepare("SELECT COUNT(DISTINCT to_guest_id) as c FROM networking_connections WHERE event_id = ? AND from_guest_id = ?").get(req.params.eventId, req.params.guestId).c;
        const mutualCount = db.prepare(`
            SELECT COUNT(DISTINCT nc2.from_guest_id) as c
            FROM networking_connections nc1
            JOIN networking_connections nc2 ON nc1.to_guest_id = nc2.from_guest_id AND nc2.to_guest_id = nc1.from_guest_id
            WHERE nc1.event_id = ? AND nc1.from_guest_id = ?
        `).get(req.params.eventId, req.params.guestId).c;
        const connections = db.prepare("SELECT g.id, g.name, g.email, g.organization, g.position FROM networking_connections nc JOIN guests g ON g.id = nc.to_guest_id WHERE nc.event_id = ? AND nc.from_guest_id = ? ORDER BY nc.connected_at DESC").all(req.params.eventId, req.params.guestId);
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
        // v12.44.846 (auditoría 2026-11-25, S12): hace falta un token de portal válido; y la respuesta
        // ya no entrega el email ni el qr_token (credencial de check-in) de otro asistente.
        if (!verifyPortalToken(req.query.t)) { return res.status(403).json({ error: 'Token de portal inválido' }); }
        const guest = db.prepare("SELECT id, name, organization, position FROM guests WHERE id = ?").get(req.params.guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });
        const eventId = req.query.event_id;
        if (eventId) {
            const connections = db.prepare("SELECT COUNT(*) as c FROM networking_connections WHERE event_id = ? AND (from_guest_id = ? OR to_guest_id = ?)").get(eventId, guest.id, guest.id);
            guest.connections = connections ? connections.c : 0;
            const sessions = db.prepare(`
                SELECT s.title, s.start_time, s.location FROM session_guests sg
                JOIN sessions s ON sg.session_id = s.id
                WHERE sg.guest_id = ? AND s.event_id = ?
                ORDER BY s.start_time ASC
            `).all(guest.id, eventId);
            guest.sessions = sessions;
        }
        guest.portal_token = portalTokenFor(guest.id);
        res.json(guest);
    } catch (err) { logger.error('[NETWORKING] Profile error:', err.message); res.status(500).json({ error: 'Error interno' }); }
});

// ─── Leaderboard de networking ───
router.get('/:eventId/leaderboard', authMiddleware(['ADMIN', 'PRODUCTOR']), requireEventAccess(), (req, res) => {
    try {
        const leaders = db.prepare(`
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
