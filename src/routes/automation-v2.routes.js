const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ─── BUSINESS RULES (C9-07) ───
router.get('/rules', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const rules = db.prepare("SELECT id, name, event_id, trigger_event, condition_expr, action_type, action_config, is_active, created_at FROM business_rules ORDER BY name ASC").all();
        res.json(rules);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/rules', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { name, event_id, trigger_event, condition_expr, action_type, action_config } = req.body;
        if (!name || !trigger_event || !action_type) return res.status(400).json({ error: 'name, trigger_event y action_type requeridos' });
        const id = uuidv4();
        db.prepare("INSERT INTO business_rules (id, name, event_id, trigger_event, condition_expr, action_type, action_config, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)")
            .run(id, name, event_id || null, trigger_event, condition_expr || null, action_type, action_config || null, new Date().toISOString());
        res.json({ success: true, id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/rules/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { name, is_active, condition_expr, action_config } = req.body;
        db.prepare("UPDATE business_rules SET name=COALESCE(?,name), is_active=COALESCE(?,is_active), condition_expr=COALESCE(?,condition_expr), action_config=COALESCE(?,action_config) WHERE id=?")
            .run(name, is_active != null ? (is_active ? 1 : 0) : null, condition_expr, action_config, req.params.id);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/rules/:id', authMiddleware(['ADMIN']), (req, res) => {
    try { db.prepare("DELETE FROM business_rules WHERE id=?").run(req.params.id); res.json({ success: true }); } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── WORKFLOWS (C9-06) ───
router.get('/workflows', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const workflows = db.prepare("SELECT id, name, description, is_active, created_at FROM workflows ORDER BY name ASC").all();
        res.json(workflows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/workflows', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { name, description, steps, trigger_event } = req.body;
        if (!name || !steps) return res.status(400).json({ error: 'name y steps requeridos' });
        const id = uuidv4();
        db.prepare("INSERT INTO workflows (id, name, description, steps, trigger_event, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
            .run(id, name, description || '', JSON.stringify(steps), trigger_event || 'manual', new Date().toISOString());
        res.json({ success: true, id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/workflows/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { name, description, steps, trigger_event, is_active } = req.body;
        db.prepare("UPDATE workflows SET name=COALESCE(?,name), description=COALESCE(?,description), steps=COALESCE(?,steps), trigger_event=COALESCE(?,trigger_event), is_active=COALESCE(?,is_active) WHERE id=?")
            .run(name, description, steps ? JSON.stringify(steps) : null, trigger_event, is_active != null ? (is_active ? 1 : 0) : null, req.params.id);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/workflows/:id', authMiddleware(['ADMIN']), (req, res) => {
    try { db.prepare("DELETE FROM workflows WHERE id=?").run(req.params.id); res.json({ success: true }); } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── OFFLINE-SYNC (C9-02) ───
router.post('/sync/pull', authMiddleware(), (req, res) => {
    try {
        const { last_sync_at, tables } = req.body;
        const since = last_sync_at || new Date(0).toISOString();
        const result = {};
        const allowed = ['guests', 'events', 'guest_categories', 'sessions'];
        for (const table of tables || allowed) {
            if (!allowed.includes(table)) continue;
            const rows = db.prepare(`SELECT * FROM ${table} WHERE created_at > ? OR updated_at > ?`).all(since, since);
            result[table] = rows;
        }
        res.json({ success: true, data: result, synced_at: new Date().toISOString() });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/sync/push', authMiddleware(), (req, res) => {
    try {
        const { changes } = req.body;
        let pushed = 0;
        for (const change of changes || []) {
            if (change.table === 'guests' && change.data) {
                const existing = db.prepare("SELECT id FROM guests WHERE id = ?").get(change.data.id);
                if (existing) {
                    db.prepare("UPDATE guests SET name=?, email=?, phone=?, organization=? WHERE id=?").run(change.data.name, change.data.email, change.data.phone, change.data.organization, change.data.id);
                } else if (change.data.id) {
                    db.prepare("INSERT OR IGNORE INTO guests (id, event_id, name, email, phone, organization, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(change.data.id, change.data.event_id, change.data.name, change.data.email, change.data.phone, change.data.organization, new Date().toISOString());
                }
                pushed++;
            }
        }
        res.json({ success: true, pushed });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
