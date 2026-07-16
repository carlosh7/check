/**
 * API Keys Routes (v12.44.777)
 * Granular scopes, per-key rate limiting, usage analytics
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// Per-key rate limiting (in-memory)
const keyRateLimits = new Map();
const KEY_RATE_WINDOW = 60000; // 1 minute
const KEY_RATE_MAX = 60; // 60 requests per minute per key

function checkKeyRateLimit(keyId) {
    const now = Date.now();
    const entry = keyRateLimits.get(keyId) || { count: 0, resetAt: now + KEY_RATE_WINDOW };
    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + KEY_RATE_WINDOW;
    }
    entry.count++;
    keyRateLimits.set(keyId, entry);
    return { allowed: entry.count <= KEY_RATE_MAX, remaining: Math.max(0, KEY_RATE_MAX - entry.count) };
}

// Available scopes
const SCOPES = {
    'events:read': 'Read events',
    'events:write': 'Create/update events',
    'guests:read': 'Read guests',
    'guests:write': 'Create/update guests',
    'analytics:read': 'Read analytics',
    'settings:read': 'Read settings',
    'webhooks:manage': 'Manage webhooks'
};

// CRUD API Keys
router.get('/api/api-keys', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const keys = db.prepare("SELECT id, name, permissions, scopes, last_used_at, expires_at, is_active, created_at FROM api_keys ORDER BY created_at DESC").all();
        res.json(keys);
    } catch(err) {
        // Fallback if scopes column doesn't exist
        try {
            const keys = db.prepare("SELECT id, name, permissions, last_used_at, expires_at, is_active, created_at FROM api_keys ORDER BY created_at DESC").all();
            res.json(keys);
        } catch(e) { res.status(500).json({ error: e.message }); }
    }
});

// List available scopes
router.get('/api/api-keys/scopes', authMiddleware(['ADMIN']), (req, res) => {
    res.json(SCOPES);
});

router.post('/api/api-keys', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var { name, permissions, scopes, expires_in_days } = req.body;
        if (!name) return res.status(400).json({ error: 'Nombre requerido' });
        var key = 'ck_' + crypto.randomBytes(32).toString('hex');
        var id = uuidv4();
        var scopesStr = Array.isArray(scopes) ? scopes.join(',') : (permissions || 'read');
        var expiresAt = null;
        if (expires_in_days && typeof expires_in_days === 'number') {
            expiresAt = new Date(Date.now() + expires_in_days * 86400000).toISOString();
        }
        
        try {
            db.prepare("INSERT INTO api_keys (id, name, key, user_id, permissions, scopes, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .run(id, name, key, req.userId, permissions || 'read', scopesStr, expiresAt);
        } catch(e) {
            // Fallback without scopes column
            db.prepare("INSERT INTO api_keys (id, name, key, user_id, permissions) VALUES (?, ?, ?, ?, ?)")
                .run(id, name, key, req.userId, permissions || 'read');
        }
        
        res.json({ success: true, id: id, key: key, scopes: scopesStr, expires_at: expiresAt });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Toggle API key active status
router.patch('/api/api-keys/:id/toggle', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const key = db.prepare("SELECT id, is_active FROM api_keys WHERE id = ?").get(req.params.id);
        if (!key) return res.status(404).json({ error: 'API key no encontrada' });
        const newStatus = key.is_active ? 0 : 1;
        db.prepare("UPDATE api_keys SET is_active = ? WHERE id = ?").run(newStatus, req.params.id);
        res.json({ success: true, is_active: newStatus });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Usage stats for a key
router.get('/api/api-keys/:id/stats', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const key = db.prepare("SELECT id, name, last_used_at, created_at FROM api_keys WHERE id = ?").get(req.params.id);
        if (!key) return res.status(404).json({ error: 'API key no encontrada' });
        const rateEntry = keyRateLimits.get(key.id);
        res.json({
            key_id: key.id,
            name: key.name,
            last_used_at: key.last_used_at,
            created_at: key.created_at,
            requests_this_minute: rateEntry ? rateEntry.count : 0,
            rate_limit: KEY_RATE_MAX
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/api-keys/:id', authMiddleware(['ADMIN']), (req, res) => {
    try { db.prepare("DELETE FROM api_keys WHERE id = ?").run(req.params.id); res.json({ success: true }); } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── PUBLIC API (authenticated via API key) ───

function apiKeyAuth(req, res, next) {
    var key = req.headers['x-api-key'];
    if (!key) return res.status(401).json({ error: 'API key requerida' });
    var apiKey;
    try {
        apiKey = db.prepare("SELECT * FROM api_keys WHERE key = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))").get(key);
    } catch(e) {
        // Fallback if scopes column doesn't exist
        apiKey = db.prepare("SELECT * FROM api_keys WHERE key = ? AND is_active = 1").get(key);
    }
    if (!apiKey) return res.status(401).json({ error: 'API key inválida o expirada' });
    
    // Per-key rate limit
    const rateCheck = checkKeyRateLimit(apiKey.id);
    res.set('X-RateLimit-Remaining', String(rateCheck.remaining));
    if (!rateCheck.allowed) {
        return res.status(429).json({ error: 'Rate limit exceeded', retry_after: 60 });
    }
    
    // Check scopes
    const requiredScope = req.requiredScope;
    if (requiredScope && apiKey.scopes) {
        const keyScopes = apiKey.scopes.split(',');
        if (!keyScopes.includes(requiredScope) && !keyScopes.includes('admin')) {
            return res.status(403).json({ error: `Scope '${requiredScope}' requerido` });
        }
    }
    
    db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(apiKey.id);
    req.apiKey = apiKey;
    next();
}

// Scope-required middleware
function requireScope(scope) {
    return (req, res, next) => { req.requiredScope = scope; next(); };
}

router.get('/api/v1/events', apiKeyAuth, requireScope('events:read'), (req, res) => {
    try {
        var events = db.prepare("SELECT id, name, date, location, status FROM events ORDER BY created_at DESC").all();
        res.json({ data: events, total: events.length });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/v1/events/:id', apiKeyAuth, requireScope('events:read'), (req, res) => {
    try {
        var event = db.prepare("SELECT id, name, date, end_date, location, description, status FROM events WHERE id = ?").get(req.params.id);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        res.json({ data: event });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/v1/events/:id/guests', apiKeyAuth, requireScope('guests:read'), (req, res) => {
    try {
        var guests = db.prepare("SELECT id, name, email, organization, checked_in, checkin_time, created_at FROM guests WHERE event_id = ? ORDER BY name ASC").all(req.params.id);
        res.json({ data: guests, total: guests.length });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/v1/analytics', apiKeyAuth, requireScope('analytics:read'), (req, res) => {
    try {
        var totalEvents = db.prepare("SELECT COUNT(*) as c FROM events").get().c;
        var totalGuests = db.prepare("SELECT COUNT(*) as c FROM guests").get().c;
        var totalChecked = db.prepare("SELECT COUNT(*) as c FROM guests WHERE checked_in = 1").get().c;
        res.json({ data: { totalEvents, totalGuests, totalChecked, conversionRate: totalGuests > 0 ? Math.round((totalChecked / totalGuests) * 100) : 0 } });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
