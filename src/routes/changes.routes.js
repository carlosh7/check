const express = require('express');
const router = express.Router();
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { getChanges, undoChange, redoChange } = require('../utils/change-log');

router.get('/events/:eventId/changes', authMiddleware(), (req, res) => {
    try {
        const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 100), 500);
        const changes = getChanges(req.params.eventId, limit);
        res.json(changes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/events/:eventId/changes/:changeId/undo', authMiddleware(), (req, res) => {
    try {
        const result = undoChange(req.params.changeId);
        if (result.error) return res.status(400).json(result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/events/:eventId/changes/:changeId/redo', authMiddleware(), (req, res) => {
    try {
        const result = redoChange(req.params.changeId);
        if (result.error) return res.status(400).json(result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
