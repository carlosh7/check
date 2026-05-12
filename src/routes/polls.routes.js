/**
 * Rutas de Gamificación — Encuestas en vivo (Live Polling + Trivias)
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ─── CRUD Polls (Admin) ───

router.get('/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var polls = db.prepare("SELECT * FROM polls WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId);
        polls.forEach(function(p) {
            if (p.correct_answer) { try { p.correct_answer = JSON.parse(p.correct_answer); } catch(e) { p.correct_answer = null; } }
        });
        res.json(polls);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.post('/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { title, description, type, session_id, points, time_limit_seconds, correct_answer, options } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ error: 'Título requerido' });
        var id = uuidv4();
        var now = new Date().toISOString();
        db.prepare("INSERT INTO polls (id, event_id, session_id, title, description, type, status, points, time_limit_seconds, correct_answer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)").run(
            id, req.params.eventId, session_id || null, title.trim(), description || '',
            type || 'single', points || 10, time_limit_seconds || 0,
            correct_answer ? JSON.stringify(correct_answer) : null, now, now
        );
        if (options && Array.isArray(options)) {
            var insertOpt = db.prepare("INSERT INTO poll_options (id, poll_id, label, order_index, is_correct) VALUES (?, ?, ?, ?, ?)");
            options.forEach(function(opt, idx) {
                insertOpt.run(uuidv4(), id, opt.label || '', idx, opt.is_correct ? 1 : 0);
            });
        }
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.get('/:eventId/:pollId', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var poll = db.prepare("SELECT * FROM polls WHERE id = ? AND event_id = ?").get(req.params.pollId, req.params.eventId);
        if (!poll) return res.status(404).json({ error: 'Encuesta no encontrada' });
        if (poll.correct_answer) { try { poll.correct_answer = JSON.parse(poll.correct_answer); } catch(e) { poll.correct_answer = null; } }
        var options = db.prepare("SELECT * FROM poll_options WHERE poll_id = ? ORDER BY order_index ASC").all(req.params.pollId);
        poll.options = options;
        res.json(poll);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.put('/:eventId/:pollId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { title, description, type, session_id, points, time_limit_seconds, correct_answer, status } = req.body;
        db.prepare("UPDATE polls SET title = COALESCE(?, title), description = COALESCE(?, description), type = COALESCE(?, type), session_id = COALESCE(?, session_id), points = COALESCE(?, points), time_limit_seconds = COALESCE(?, time_limit_seconds), correct_answer = COALESCE(?, correct_answer), status = COALESCE(?, status), updated_at = ? WHERE id = ? AND event_id = ?").run(
            title || null, description || null, type || null, session_id || null,
            points != null ? points : null, time_limit_seconds != null ? time_limit_seconds : null,
            correct_answer ? JSON.stringify(correct_answer) : null, status || null,
            new Date().toISOString(), req.params.pollId, req.params.eventId
        );
        // Reemplazar opciones si se envían
        var options = req.body.options;
        if (options && Array.isArray(options)) {
            db.prepare("DELETE FROM poll_options WHERE poll_id = ?").run(req.params.pollId);
            var insertOpt = db.prepare("INSERT INTO poll_options (id, poll_id, label, order_index, is_correct) VALUES (?, ?, ?, ?, ?)");
            options.forEach(function(opt, idx) {
                insertOpt.run(uuidv4(), req.params.pollId, opt.label || '', idx, opt.is_correct ? 1 : 0);
            });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.delete('/:eventId/:pollId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM poll_votes WHERE poll_id = ?").run(req.params.pollId);
        db.prepare("DELETE FROM poll_options WHERE poll_id = ?").run(req.params.pollId);
        db.prepare("DELETE FROM polls WHERE id = ? AND event_id = ?").run(req.params.pollId, req.params.eventId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Cambiar estado (draft → active → closed) ───

router.patch('/:eventId/:pollId/status', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { status } = req.body;
        if (!['draft', 'active', 'closed'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
        db.prepare("UPDATE polls SET status = ?, updated_at = ? WHERE id = ? AND event_id = ?").run(status, new Date().toISOString(), req.params.pollId, req.params.eventId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Resultados (Admin) ───

router.get('/:eventId/:pollId/results', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var poll = db.prepare("SELECT * FROM polls WHERE id = ? AND event_id = ?").get(req.params.pollId, req.params.eventId);
        if (!poll) return res.status(404).json({ error: 'Encuesta no encontrada' });
        var options = db.prepare("SELECT * FROM poll_options WHERE poll_id = ? ORDER BY order_index ASC").all(req.params.pollId);
        var votes = db.prepare("SELECT pv.*, g.name as guest_name FROM poll_votes pv LEFT JOIN guests g ON g.id = pv.guest_id WHERE pv.poll_id = ? ORDER BY pv.voted_at DESC").all(req.params.pollId);
        var totalVotes = votes.length;
        // Conteo por opción
        var optionCounts = {};
        votes.forEach(function(v) {
            if (v.option_id) optionCounts[v.option_id] = (optionCounts[v.option_id] || 0) + 1;
        });
        var results = options.map(function(opt) {
            return {
                optionId: opt.id,
                label: opt.label,
                isCorrect: opt.is_correct === 1,
                count: optionCounts[opt.id] || 0,
                percentage: totalVotes > 0 ? Math.round(((optionCounts[opt.id] || 0) / totalVotes) * 100) : 0
            };
        });
        // Correct answer stats for trivia
        var correctCount = 0;
        if (poll.type === 'trivia' && poll.correct_answer) {
            var correctAnswers = typeof poll.correct_answer === 'string' ? JSON.parse(poll.correct_answer) : poll.correct_answer;
            votes.forEach(function(v) {
                if (v.option_id && correctAnswers.includes(v.option_id)) correctCount++;
            });
        }
        res.json({
            pollId: poll.id,
            title: poll.title,
            status: poll.status,
            type: poll.type,
            totalVotes: totalVotes,
            correctCount: correctCount,
            results: results,
            recentVotes: votes.slice(0, 20)
        });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Público: encuestas activas ───

router.get('/public/:eventId/active', (req, res) => {
    try {
        var polls = db.prepare("SELECT id, event_id, session_id, title, description, type, points, time_limit_seconds FROM polls WHERE event_id = ? AND status = 'active' ORDER BY created_at DESC").all(req.params.eventId);
        polls.forEach(function(p) {
            p.options = db.prepare("SELECT id, label, order_index FROM poll_options WHERE poll_id = ? ORDER BY order_index ASC").all(p.id);
        });
        res.json(polls);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Público: votar ───

router.post('/public/:pollId/vote', (req, res) => {
    try {
        var { guest_token, option_id, answer_text } = req.body;
        if (!guest_token) return res.status(400).json({ error: 'Token de invitado requerido' });
        var guest = db.prepare("SELECT id, event_id FROM guests WHERE qr_token = ?").get(guest_token);
        if (!guest) return res.status(401).json({ error: 'Invitado no encontrado' });
        var poll = db.prepare("SELECT * FROM polls WHERE id = ? AND status = 'active'").get(req.params.pollId);
        if (!poll) return res.status(404).json({ error: 'Encuesta no activa o no encontrada' });
        // Verificar si ya votó
        var existingVote = db.prepare("SELECT id FROM poll_votes WHERE poll_id = ? AND guest_id = ?").get(req.params.pollId, guest.id);
        if (existingVote) return res.status(400).json({ error: 'Ya has votado en esta encuesta' });
        var id = uuidv4();
        db.prepare("INSERT INTO poll_votes (id, poll_id, guest_id, option_id, answer_text) VALUES (?, ?, ?, ?, ?)").run(id, req.params.pollId, guest.id, option_id || null, answer_text || null);
        // Emitir evento en tiempo real
        try { var io = require('../../src/socket').getIO(); if (io) { io.to(poll.event_id).emit('poll_updated', { pollId: poll.id, pollTitle: poll.title }); } } catch(e) {}
        // Sumar puntos al leaderboard
        if (poll.points > 0) {
            var existing = db.prepare("SELECT id FROM leaderboard WHERE event_id = ? AND guest_id = ?").get(guest.event_id, guest.id);
            if (existing) {
                db.prepare("UPDATE leaderboard SET points = points + ?, updated_at = datetime('now') WHERE event_id = ? AND guest_id = ?").run(poll.points, guest.event_id, guest.id);
            } else {
                db.prepare("INSERT INTO leaderboard (id, event_id, guest_id, points) VALUES (?, ?, ?, ?)").run(uuidv4(), guest.event_id, guest.id, poll.points);
            }
            db.prepare("INSERT INTO point_history (id, event_id, guest_id, points, reason, reference_id) VALUES (?, ?, ?, ?, 'poll', ?)").run(uuidv4(), guest.event_id, guest.id, poll.points, poll.id);
        }
        // Verificar insignias
        checkBadges(guest.event_id, guest.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Público: resultados de una encuesta cerrada ───

router.get('/public/:pollId/results', (req, res) => {
    try {
        var poll = db.prepare("SELECT id, title, type, correct_answer FROM polls WHERE id = ? AND status = 'closed'").get(req.params.pollId);
        if (!poll) return res.status(404).json({ error: 'Resultados no disponibles' });
        if (poll.correct_answer) { try { poll.correct_answer = JSON.parse(poll.correct_answer); } catch(e) { poll.correct_answer = null; } }
        var options = db.prepare("SELECT id, label, is_correct FROM poll_options WHERE poll_id = ? ORDER BY order_index ASC").all(req.params.pollId);
        var totalVotes = db.prepare("SELECT COUNT(*) as count FROM poll_votes WHERE poll_id = ?").get(req.params.pollId).count;
        var votes = db.prepare("SELECT option_id FROM poll_votes WHERE poll_id = ?").all(req.params.pollId);
        var counts = {};
        votes.forEach(function(v) { if (v.option_id) counts[v.option_id] = (counts[v.option_id] || 0) + 1; });
        var results = options.map(function(opt) {
            return { optionId: opt.id, label: opt.label, isCorrect: opt.is_correct === 1, count: counts[opt.id] || 0, percentage: totalVotes > 0 ? Math.round(((counts[opt.id] || 0) / totalVotes) * 100) : 0 };
        });
        res.json({ title: poll.title, type: poll.type, correctAnswer: poll.correct_answer, totalVotes: totalVotes, results: results });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Helper: verificar y otorgar insignias ───

function checkBadges(eventId, guestId) {
    try {
        var badges = db.prepare("SELECT * FROM badges WHERE event_id = ?").all(eventId);
        var guestPoints = db.prepare("SELECT points FROM leaderboard WHERE event_id = ? AND guest_id = ?").get(eventId, guestId);
        var pollCount = db.prepare("SELECT COUNT(*) as c FROM poll_votes pv JOIN polls p ON p.id = pv.poll_id WHERE p.event_id = ? AND pv.guest_id = ?").get(eventId, guestId).c;
        badges.forEach(function(b) {
            var earned = db.prepare("SELECT id FROM guest_badges WHERE badge_id = ? AND guest_id = ?").get(b.id, guestId);
            if (earned) return;
            var criteria = {};
            try { criteria = JSON.parse(b.criteria); } catch(e) {}
            var award = false;
            if (criteria.type === 'poll_count' && pollCount >= (criteria.value || 1)) award = true;
            if (criteria.type === 'points' && guestPoints && guestPoints.points >= (criteria.value || 10)) award = true;
            if (award) {
                db.prepare("INSERT INTO guest_badges (id, badge_id, guest_id) VALUES (?, ?, ?)").run(uuidv4(), b.id, guestId);
                if (b.points_reward > 0) {
                    var lb = db.prepare("SELECT id FROM leaderboard WHERE event_id = ? AND guest_id = ?").get(eventId, guestId);
                    if (lb) {
                        db.prepare("UPDATE leaderboard SET points = points + ?, updated_at = datetime('now') WHERE event_id = ? AND guest_id = ?").run(b.points_reward, eventId, guestId);
                    }
                    db.prepare("INSERT INTO point_history (id, event_id, guest_id, points, reason, reference_id) VALUES (?, ?, ?, ?, 'badge', ?)").run(uuidv4(), eventId, guestId, b.points_reward, b.id);
                }
            }
        });
    } catch(e) {}
}

module.exports = router;
