const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Detect tenant by domain (middleware)
router.use(function(req, res, next) {
    var host = req.get('host') || '';
    var subdomain = host.split('.')[0];
    // Store tenant info in req for downstream routes
    if (subdomain && subdomain !== 'www' && subdomain !== 'app' && !subdomain.includes('localhost') && !subdomain.includes('192.168')) {
        var tenant = db.prepare("SELECT * FROM tenants WHERE (domain = ? OR (domain = '' AND slug = ?)) AND is_active = 1").get(host, subdomain);
        if (tenant) {
            req.tenant = tenant;
            res.locals.tenant = tenant;
        }
    }
    next();
});

// CRUD Tenants (admin only)
router.get('/api/tenants', authMiddleware(['ADMIN']), (req, res) => {
    try { res.json(db.prepare("SELECT * FROM tenants ORDER BY name ASC").all()); } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenants', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var { name, slug, domain, logo_url, primary_color, welcome_text } = req.body;
        if (!name || !slug) return res.status(400).json({ error: 'Nombre y slug requeridos' });
        var existing = db.prepare("SELECT id FROM tenants WHERE slug = ?").get(slug);
        if (existing) return res.status(400).json({ error: 'Slug ya existe' });
        var id = uuidv4();
        db.prepare("INSERT INTO tenants (id, name, slug, domain, logo_url, primary_color, welcome_text) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, name, slug, domain || '', logo_url || '', primary_color || '#7c3aed', welcome_text || '');
        res.json({ success: true, id: id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/api/tenants/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var d = req.body;
        db.prepare("UPDATE tenants SET name = COALESCE(?, name), slug = COALESCE(?, slug), domain = COALESCE(?, domain), logo_url = COALESCE(?, logo_url), primary_color = COALESCE(?, primary_color), welcome_text = COALESCE(?, welcome_text), is_active = COALESCE(?, is_active) WHERE id = ?").run(
            d.name || null, d.slug || null, d.domain || null, d.logo_url || null, d.primary_color || null, d.welcome_text || null, d.is_active !== undefined ? (d.is_active ? 1 : 0) : null, req.params.id
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/tenants/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        db.prepare("DELETE FROM tenants WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Public: get tenant info by slug (for branded landing pages)
router.get('/api/tenant/:slug', (req, res) => {
    try {
        var tenant = db.prepare("SELECT id, name, slug, logo_url, primary_color, welcome_text FROM tenants WHERE slug = ? AND is_active = 1").get(req.params.slug);
        if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });
        res.json(tenant);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Public: tenant-branded registration page data
router.get('/api/tenant/:slug/event/:eventId', (req, res) => {
    try {
        var tenant = db.prepare("SELECT id, name, slug, logo_url, primary_color, welcome_text FROM tenants WHERE slug = ? AND is_active = 1").get(req.params.slug);
        if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });
        var event = db.prepare("SELECT id, name, date, location, description, reg_title, reg_welcome_text, reg_success_message, reg_show_phone, reg_show_org, reg_show_position, reg_show_dietary, reg_show_gender, reg_require_agreement, reg_policy, reg_logo_url, payment_required, currency, latitude, longitude, music_url, video_conference_url FROM events WHERE id = ?").get(req.params.eventId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        // Merge tenant branding into event data
        event.tenant = tenant;
        res.json(event);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
