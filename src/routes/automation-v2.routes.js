const express = require('express');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const createBusinessRuleSchema = z.object({
    name: z.string().min(1, 'Nombre requerido').max(200),
    event_id: z.string().optional(),
    trigger_event: z.string().min(1, 'Evento trigger requerido'),
    condition_expr: z.string().optional(),
    action_type: z.string().min(1, 'Tipo de acción requerido'),
    action_config: z.record(z.any()).optional()
});

const updateBusinessRuleSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    is_active: z.boolean().optional(),
    condition_expr: z.string().optional(),
    action_config: z.record(z.any()).optional()
});

const createWorkflowSchema = z.object({
    name: z.string().min(1, 'Nombre requerido').max(200),
    description: z.string().max(1000).optional(),
    steps: z.array(z.any()).min(1, 'Steps requeridos'),
    trigger_event: z.string().optional()
});

// ─── BUSINESS RULES (C9-07) ───
router.get('/rules', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const rules = db.prepare("SELECT id, name, event_id, trigger_event, condition_expr, action_type, action_config, is_active, created_at FROM business_rules ORDER BY name ASC").all();
        res.json(rules);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/rules', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var parsed = createBusinessRuleSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ errors: parsed.error.issues.map(function(e) { return e.path.join('.') + ': ' + e.message; }) });
        }
        var { name, event_id, trigger_event, condition_expr, action_type, action_config } = parsed.data;
        const id = uuidv4();
        db.prepare("INSERT INTO business_rules (id, name, event_id, trigger_event, condition_expr, action_type, action_config, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)")
            .run(id, name, event_id || null, trigger_event, condition_expr || null, action_type, action_config || null, new Date().toISOString());
        res.json({ success: true, id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/rules/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var parsed = updateBusinessRuleSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ errors: parsed.error.issues.map(function(e) { return e.path.join('.') + ': ' + e.message; }) });
        }
        var { name, is_active, condition_expr, action_config } = parsed.data;
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
        var parsed = createWorkflowSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ errors: parsed.error.issues.map(function(e) { return e.path.join('.') + ': ' + e.message; }) });
        }
        var { name, description, steps, trigger_event } = parsed.data;
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
