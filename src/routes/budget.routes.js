const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/events/:eventId/budget
router.get('/events/:eventId/budget', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var items = db.prepare("SELECT * FROM budgets WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId);
        var total = items.reduce(function(sum, i) { return sum + i.amount; }, 0);
        res.json({ items: items, total: total, count: items.length });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /api/events/:eventId/budget
router.post('/events/:eventId/budget', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { concept, amount, category, notes } = req.body;
        if (!concept || amount === undefined) return res.status(400).json({ error: 'Concepto y monto requeridos' });
        var id = uuidv4();
        db.prepare("INSERT INTO budgets (id, event_id, concept, amount, category, notes) VALUES (?, ?, ?, ?, ?, ?)").run(id, req.params.eventId, concept, parseFloat(amount) || 0, category || 'general', notes || '');
        res.json({ success: true, id: id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/events/:eventId/budget/:itemId
router.put('/events/:eventId/budget/:itemId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { concept, amount, category, notes } = req.body;
        db.prepare("UPDATE budgets SET concept = COALESCE(?, concept), amount = COALESCE(?, amount), category = COALESCE(?, category), notes = COALESCE(?, notes) WHERE id = ? AND event_id = ?").run(
            concept || null, amount !== undefined ? parseFloat(amount) : null, category || null, notes !== undefined ? notes : null, req.params.itemId, req.params.eventId
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/events/:eventId/budget/:itemId
router.delete('/events/:eventId/budget/:itemId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM budgets WHERE id = ? AND event_id = ?").run(req.params.itemId, req.params.eventId);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
