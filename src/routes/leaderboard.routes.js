/**
 * Rutas de Gamificación — Leaderboard e Insignias
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ─── Leaderboard público ───

router.get('/:eventId', (req, res) => {
    try {
        var top = parseInt(req.query.top) || 50;
        var leaderboard = db.prepare(`
            SELECT lb.guest_id, g.name as guest_name, g.organization, lb.points,
                   (SELECT COUNT(*) FROM guest_badges gb WHERE gb.guest_id = lb.guest_id) as badges_count
            FROM leaderboard lb
            LEFT JOIN guests g ON g.id = lb.guest_id
            WHERE lb.event_id = ?
            ORDER BY lb.points DESC
            LIMIT ?
        `).all(req.params.eventId, top);
        res.json(leaderboard);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Posición de un asistente específico ───

router.get('/:eventId/guest/:guestId', (req, res) => {
    try {
        var entry = db.prepare("SELECT *, (SELECT COUNT(DISTINCT points) + 1 FROM leaderboard WHERE event_id = ? AND points > lb.points) as rank FROM leaderboard lb WHERE event_id = ? AND guest_id = ?").get(req.params.eventId, req.params.eventId, req.params.guestId);
        if (!entry) return res.json({ points: 0, rank: null, badgesCount: 0 });
        var badgesCount = db.prepare("SELECT COUNT(*) as c FROM guest_badges gb JOIN badges b ON b.id = gb.badge_id WHERE b.event_id = ? AND gb.guest_id = ?").get(req.params.eventId, req.params.guestId).c;
        entry.badgesCount = badgesCount;
        res.json(entry);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Historial de puntos de un asistente ───

router.get('/:eventId/guest/:guestId/history', (req, res) => {
    try {
        var history = db.prepare("SELECT * FROM point_history WHERE event_id = ? AND guest_id = ? ORDER BY created_at DESC LIMIT 100").all(req.params.eventId, req.params.guestId);
        res.json(history);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Insignias — CRUD Admin ───

router.get('/:eventId/badges', (req, res) => {
    try {
        var badges = db.prepare("SELECT *, (SELECT COUNT(*) FROM guest_badges gb WHERE gb.badge_id = b.id) as earned_count FROM badges b WHERE b.event_id = ? ORDER BY b.name ASC").all(req.params.eventId);
        res.json(badges);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.post('/:eventId/badges', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { name, description, icon, criteria, points_reward } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
        var id = uuidv4();
        db.prepare("INSERT INTO badges (id, event_id, name, description, icon, criteria, points_reward) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
            id, req.params.eventId, name.trim(), description || '', icon || '🏆',
            criteria ? JSON.stringify(criteria) : null, points_reward || 0
        );
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.delete('/:eventId/badges/:badgeId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM guest_badges WHERE badge_id = ?").run(req.params.badgeId);
        db.prepare("DELETE FROM badges WHERE id = ? AND event_id = ?").run(req.params.badgeId, req.params.eventId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Insignias de un asistente (público) ───

router.get('/:eventId/guest/:guestId/badges', (req, res) => {
    try {
        var badges = db.prepare("SELECT b.*, gb.earned_at FROM guest_badges gb JOIN badges b ON b.id = gb.badge_id WHERE b.event_id = ? AND gb.guest_id = ? ORDER BY gb.earned_at DESC").all(req.params.eventId, req.params.guestId);
        res.json(badges);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
