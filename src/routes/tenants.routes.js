/**
 * Tenants Routes (v12.44.777)
 * Multi-tenant with data isolation, usage tracking, and branding
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Ensure tenant_data table exists
try {
    db.exec(`CREATE TABLE IF NOT EXISTS tenant_usage (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        event_count INTEGER DEFAULT 0,
        guest_count INTEGER DEFAULT 0,
        storage_bytes INTEGER DEFAULT 0,
        api_calls INTEGER DEFAULT 0,
        period_start TEXT,
        period_end TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS tenant_members (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'viewer',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(tenant_id, user_id)
    )`);
} catch(e) {}

// Detect tenant by domain (middleware)
router.use(function(req, res, next) {
    var host = req.get('host') || '';
    var subdomain = host.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'app' && !subdomain.includes('localhost') && !subdomain.includes('192.168')) {
        var tenant = db.prepare("SELECT * FROM tenants WHERE (domain = ? OR (domain = '' AND slug = ?)) AND is_active = 1").get(host, subdomain);
        if (tenant) {
            req.tenant = tenant;
            res.locals.tenant = tenant;
        }
    }
    next();
});

// Tenant data isolation middleware
function tenantIsolation(req, res, next) {
    if (req.tenant) {
        // Attach tenant_id to queries that need isolation
        req.tenantFilter = { tenant_id: req.tenant.id };
    }
    next();
}

// CRUD Tenants (admin only)
router.get('/api/tenants', authMiddleware(['ADMIN']), (req, res) => {
    try { res.json(db.prepare("SELECT * FROM tenants ORDER BY name ASC").all()); } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenants', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var { name, slug, domain, logo_url, primary_color, welcome_text, max_events, max_guests } = req.body;
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

// ─── TENANT MEMBERS ───
router.get('/api/tenants/:id/members', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const members = db.prepare(`
            SELECT tm.*, u.username, u.email, u.role as user_role
            FROM tenant_members tm
            LEFT JOIN users u ON u.id = tm.user_id
            WHERE tm.tenant_id = ?
        `).all(req.params.id);
        res.json(members);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/tenants/:id/members', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { user_id, role } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id requerido' });
        const id = uuidv4();
        db.prepare("INSERT OR REPLACE INTO tenant_members (id, tenant_id, user_id, role) VALUES (?, ?, ?, ?)")
            .run(id, req.params.id, user_id, role || 'viewer');
        res.json({ success: true, id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/api/tenants/:id/members/:userId', authMiddleware(['ADMIN']), (req, res) => {
    try {
        db.prepare("DELETE FROM tenant_members WHERE tenant_id = ? AND user_id = ?").run(req.params.id, req.params.userId);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── TENANT USAGE ───
router.get('/api/tenants/:id/usage', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });
        
        // Calculate real-time usage
        const eventCount = db.prepare("SELECT COUNT(*) as c FROM events WHERE user_id IN (SELECT user_id FROM tenant_members WHERE tenant_id = ?)").get(req.params.id).c;
        const guestCount = db.prepare(`
            SELECT COUNT(*) as c FROM guests WHERE event_id IN (
                SELECT id FROM events WHERE user_id IN (SELECT user_id FROM tenant_members WHERE tenant_id = ?)
            )
        `).get(req.params.id).c;
        
        res.json({
            tenant_id: req.params.id,
            name: tenant.name,
            event_count: eventCount,
            guest_count: guestCount,
            max_events: tenant.max_events || null,
            max_guests: tenant.max_guests || null
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Public: get tenant info by slug
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
        event.tenant = tenant;
        res.json(event);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
