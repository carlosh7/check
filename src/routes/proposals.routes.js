const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/events/:eventId/proposals — public
router.get('/events/:eventId/proposals', (req, res) => {
    try {
        var proposals = db.prepare("SELECT id, guest_name, title, description, votes, status, created_at FROM proposals WHERE event_id = ? AND status = 'approved' ORDER BY votes DESC, created_at DESC").all(req.params.eventId);
        res.json(proposals);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /api/events/:eventId/proposals — public submit
router.post('/events/:eventId/proposals', (req, res) => {
    try {
        var { guest_name, guest_email, title, description } = req.body;
        if (!guest_name || !title) return res.status(400).json({ error: 'Nombre y título requeridos' });
        var id = uuidv4();
        db.prepare("INSERT INTO proposals (id, event_id, guest_name, guest_email, title, description) VALUES (?, ?, ?, ?, ?, ?)").run(
            id, req.params.eventId, guest_name, guest_email || '', title, description || ''
        );
        res.json({ success: true, id: id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /api/events/:eventId/proposals/:id/vote — public vote
router.post('/events/:eventId/proposals/:id/vote', (req, res) => {
    try {
        db.prepare("UPDATE proposals SET votes = votes + 1 WHERE id = ? AND event_id = ?").run(req.params.id, req.params.eventId);
        var p = db.prepare("SELECT votes FROM proposals WHERE id = ?").get(req.params.id);
        res.json({ success: true, votes: p ? p.votes : 0 });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/events/:eventId/proposals/admin — admin list all
router.get('/events/:eventId/proposals/admin', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var proposals = db.prepare("SELECT * FROM proposals WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId);
        res.json(proposals);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/events/:eventId/proposals/:id — admin update status
router.put('/events/:eventId/proposals/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { status } = req.body;
        if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
        db.prepare("UPDATE proposals SET status = ? WHERE id = ? AND event_id = ?").run(status, req.params.id, req.params.eventId);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/events/:eventId/proposals/:id
router.delete('/events/:eventId/proposals/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM proposals WHERE id = ? AND event_id = ?").run(req.params.id, req.params.eventId);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── AI Moderation (C4-10) ───

// Auto-moderate a proposal: suggest status based on content analysis
router.post('/events/:eventId/proposals/:id/moderate', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var proposal = db.prepare("SELECT * FROM proposals WHERE id = ? AND event_id = ?").get(req.params.id, req.params.eventId);
        if (!proposal) return res.status(404).json({ error: 'Propuesta no encontrada' });

        var title = (proposal.title || '').toLowerCase();
        var desc = (proposal.description || '').toLowerCase();
        var combined = title + ' ' + desc;

        // Simple content analysis keywords
        var positiveKeywords = ['taller', 'workshop', 'charla', 'conferencia', 'presentación', 'innovación', 'tecnología', 'experiencia', 'caso de éxito', 'demostración', 'práctica'];
        var negativeKeywords = ['publicidad', 'venta', 'spam', 'comercial', 'promoción', 'irrelevante'];
        var questionWords = ['¿', 'qué', 'cómo', 'cuándo', 'dónde', 'por qué', 'quién', 'cuál'];

        var score = 0;
        positiveKeywords.forEach(function(kw) { if (combined.includes(kw)) score += 15; });
        negativeKeywords.forEach(function(kw) { if (combined.includes(kw)) score -= 25; });
        questionWords.forEach(function(kw) { if (title.startsWith(kw)) score -= 10; });

        var suggestion, confidence;
        if (score >= 15) { suggestion = 'approved'; confidence = 'alta'; }
        else if (score <= -10) { suggestion = 'rejected'; confidence = 'alta'; }
        else { suggestion = 'pending'; confidence = 'baja'; }

        res.json({
            suggestion: suggestion,
            confidence: confidence,
            score: score,
            message: score >= 15 ? '✅ Parece una propuesta valiosa' : score <= -10 ? '❌ Podría no ser relevante' : '⚠️ No se pudo determinar automáticamente'
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
