const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ─── PLUGIN SYSTEM (C8-09) ───
router.get('/plugins', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const plugins = db.prepare("SELECT id, name, version, author, description, is_active, installed_at FROM plugins ORDER BY name ASC").all();
        res.json(plugins);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/plugins/install', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { name, version, author, description, source_url, permissions } = req.body;
        if (!name || !source_url) return res.status(400).json({ error: 'name y source_url requeridos' });
        const existing = db.prepare("SELECT id FROM plugins WHERE name = ?").get(name);
        if (existing) return res.status(400).json({ error: 'Plugin ya instalado' });
        const id = uuidv4();
        db.prepare("INSERT INTO plugins (id, name, version, author, description, source_url, permissions, is_active, installed_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)")
            .run(id, name, version || '1.0.0', author || 'Desconocido', description || '', source_url, permissions || 'read', new Date().toISOString());
        res.json({ success: true, id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/plugins/:id/toggle', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const p = db.prepare("SELECT is_active FROM plugins WHERE id=?").get(req.params.id);
        if (!p) return res.status(404).json({ error: 'Plugin no encontrado' });
        db.prepare("UPDATE plugins SET is_active = ? WHERE id = ?").run(p.is_active ? 0 : 1, req.params.id);
        res.json({ success: true, active: !p.is_active });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/plugins/:id', authMiddleware(['ADMIN']), (req, res) => {
    try { db.prepare("DELETE FROM plugins WHERE id=?").run(req.params.id); res.json({ success: true }); } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── MARKETPLACE (C8-10) ───
router.get('/marketplace/available', authMiddleware(), (req, res) => {
    try {
        const available = db.prepare("SELECT * FROM marketplace_listings WHERE is_active = 1 ORDER BY installs DESC, name ASC").all();
        res.json(available);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/marketplace/list', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { name, version, author, description, source_url, category, price } = req.body;
        if (!name || !source_url) return res.status(400).json({ error: 'name y source_url requeridos' });
        const id = uuidv4();
        db.prepare("INSERT INTO marketplace_listings (id, name, version, author, description, source_url, category, price, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)")
            .run(id, name, version || '1.0.0', author || req.body.author || 'Usuario', description || '', source_url, category || 'tools', price || 'free', new Date().toISOString());
        res.json({ success: true, id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── PRICING TIERS (C8-11) ───
router.get('/pricing/tiers', authMiddleware(), (req, res) => {
    try {
        const tiers = db.prepare("SELECT * FROM pricing_tiers ORDER BY price ASC, sort_order ASC").all();
        res.json(tiers);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/pricing/tiers', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { name, price, currency, features, max_events, max_guests_per_event, sort_order } = req.body;
        if (!name || price == null) return res.status(400).json({ error: 'name y price requeridos' });
        const id = uuidv4();
        db.prepare("INSERT INTO pricing_tiers (id, name, price, currency, features, max_events, max_guests_per_event, is_active, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
            .run(id, name, price, currency || 'USD', features || '[]', max_events || 0, max_guests_per_event || 0, sort_order || 0, new Date().toISOString());
        res.json({ success: true, id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/pricing/tiers/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { name, price, currency, features, max_events, max_guests_per_event, is_active, sort_order } = req.body;
        db.prepare("UPDATE pricing_tiers SET name=COALESCE(?,name), price=COALESCE(?,price), features=COALESCE(?,features), max_events=COALESCE(?,max_events), max_guests_per_event=COALESCE(?,max_guests_per_event), is_active=COALESCE(?,is_active), sort_order=COALESCE(?,sort_order) WHERE id=?")
            .run(name, price, features, max_events, max_guests_per_event, is_active != null ? (is_active ? 1 : 0) : null, sort_order, req.params.id);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/pricing/tiers/:id', authMiddleware(['ADMIN']), (req, res) => {
    try { db.prepare("DELETE FROM pricing_tiers WHERE id=?").run(req.params.id); res.json({ success: true }); } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
