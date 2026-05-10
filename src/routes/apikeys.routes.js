const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// CRUD API Keys
router.get('/api/api-keys', authMiddleware(['ADMIN']), (req, res) => {
    try { res.json(db.prepare("SELECT id, name, permissions, last_used_at, expires_at, is_active, created_at FROM api_keys ORDER BY created_at DESC").all()); } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/api-keys', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var { name, permissions } = req.body;
        if (!name) return res.status(400).json({ error: 'Nombre requerido' });
        var key = 'ck_' + crypto.randomBytes(32).toString('hex');
        var id = uuidv4();
        db.prepare("INSERT INTO api_keys (id, name, key, user_id, permissions) VALUES (?, ?, ?, ?, ?)").run(id, name, key, req.userId, permissions || 'read');
        res.json({ success: true, id: id, key: key });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/api-keys/:id', authMiddleware(['ADMIN']), (req, res) => {
    try { db.prepare("DELETE FROM api_keys WHERE id = ?").run(req.params.id); res.json({ success: true }); } catch(err) { res.status(500).json({ error: err.message }); }
});

// Public API endpoints (C6-09) - authenticated via API key header
function apiKeyAuth(req, res, next) {
    var key = req.headers['x-api-key'];
    if (!key) return res.status(401).json({ error: 'API key requerida' });
    var apiKey = db.prepare("SELECT * FROM api_keys WHERE key = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))").get(key);
    if (!apiKey) return res.status(401).json({ error: 'API key inválida o expirada' });
    db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(apiKey.id);
    req.apiKey = apiKey;
    next();
}

router.get('/api/v1/events', apiKeyAuth, (req, res) => {
    try {
        var events = db.prepare("SELECT id, name, date, location, status FROM events ORDER BY created_at DESC").all();
        res.json({ data: events, total: events.length });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/v1/events/:id', apiKeyAuth, (req, res) => {
    try {
        var event = db.prepare("SELECT id, name, date, end_date, location, description, status FROM events WHERE id = ?").get(req.params.id);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        res.json({ data: event });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/v1/events/:id/guests', apiKeyAuth, (req, res) => {
    try {
        var guests = db.prepare("SELECT id, name, email, organization, checked_in, checkin_time, created_at FROM guests WHERE event_id = ? ORDER BY name ASC").all(req.params.id);
        res.json({ data: guests, total: guests.length });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
