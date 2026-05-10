const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/events/:eventId/speakers
router.get('/events/:eventId/speakers', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var speakers = db.prepare("SELECT * FROM speakers WHERE event_id = ? ORDER BY sort_order ASC, name ASC").all(req.params.eventId);
        res.json(speakers);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /api/events/:eventId/speakers
router.post('/events/:eventId/speakers', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { name, bio, photo_url, social_twitter, social_linkedin, social_web, topic, sort_order } = req.body;
        if (!name) return res.status(400).json({ error: 'Nombre requerido' });
        var id = uuidv4();
        db.prepare("INSERT INTO speakers (id, event_id, name, bio, photo_url, social_twitter, social_linkedin, social_web, topic, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
            id, req.params.eventId, name, bio || '', photo_url || '', social_twitter || '', social_linkedin || '', social_web || '', topic || '', sort_order || 0
        );
        res.json({ success: true, id: id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/events/:eventId/speakers/:speakerId
router.put('/events/:eventId/speakers/:speakerId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var d = req.body;
        db.prepare("UPDATE speakers SET name = COALESCE(?, name), bio = COALESCE(?, bio), photo_url = COALESCE(?, photo_url), social_twitter = COALESCE(?, social_twitter), social_linkedin = COALESCE(?, social_linkedin), social_web = COALESCE(?, social_web), topic = COALESCE(?, topic), sort_order = COALESCE(?, sort_order) WHERE id = ? AND event_id = ?").run(
            d.name || null, d.bio || null, d.photo_url || null, d.social_twitter || null, d.social_linkedin || null, d.social_web || null, d.topic || null, d.sort_order != null ? d.sort_order : null, req.params.speakerId, req.params.eventId
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/events/:eventId/speakers/:speakerId
router.delete('/events/:eventId/speakers/:speakerId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM speakers WHERE id = ? AND event_id = ?").run(req.params.speakerId, req.params.eventId);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
