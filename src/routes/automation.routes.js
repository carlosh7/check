const express = require('express');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const createAutomationRuleSchema = z.object({
    name: z.string().min(1, 'Nombre requerido').max(200),
    trigger_event: z.string().min(1, 'Evento trigger requerido'),
    conditions: z.record(z.any()).optional(),
    actions: z.array(z.any()).min(1, 'Acciones requeridas')
});

const updateAutomationRuleSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    trigger_event: z.string().optional(),
    conditions: z.record(z.any()).optional(),
    actions: z.array(z.any()).optional(),
    enabled: z.boolean().optional()
});

// List rules
router.get('/events/:eventId/automation', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var rules = db.prepare("SELECT * FROM automation_rules WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId);
        res.json(rules);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Create rule
router.post('/events/:eventId/automation', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var parsed = createAutomationRuleSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ errors: parsed.error.issues.map(function(e) { return e.path.join('.') + ': ' + e.message; }) });
        }
        var { name, trigger_event, conditions, actions } = parsed.data;
        var id = uuidv4();
        db.prepare("INSERT INTO automation_rules (id, event_id, name, trigger_event, conditions_json, actions_json) VALUES (?, ?, ?, ?, ?, ?)").run(
            id, req.params.eventId, name, trigger_event, JSON.stringify(conditions || {}), JSON.stringify(actions)
        );
        res.json({ success: true, id: id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Update rule
router.put('/events/:eventId/automation/:ruleId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var parsed = updateAutomationRuleSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ errors: parsed.error.issues.map(function(e) { return e.path.join('.') + ': ' + e.message; }) });
        }
        var { name, trigger_event, conditions, actions, enabled } = parsed.data;
        db.prepare("UPDATE automation_rules SET name = COALESCE(?, name), trigger_event = COALESCE(?, trigger_event), conditions_json = COALESCE(?, conditions_json), actions_json = COALESCE(?, actions_json), enabled = COALESCE(?, enabled) WHERE id = ? AND event_id = ?").run(
            name || null, trigger_event || null, conditions ? JSON.stringify(conditions) : null, actions ? JSON.stringify(actions) : null, enabled !== undefined ? (enabled ? 1 : 0) : null, req.params.ruleId, req.params.eventId
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Delete rule
router.delete('/events/:eventId/automation/:ruleId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM automation_rules WHERE id = ? AND event_id = ?").run(req.params.ruleId, req.params.eventId);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Available triggers and actions (for the UI)
router.get('/automation/options', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    res.json({
        triggers: [
            { id: 'guest.created', label: 'Invitado creado' },
            { id: 'guest.checked_in', label: 'Check-in realizado' },
            { id: 'guest.confirmed', label: 'Invitado confirmado' },
            { id: 'pre_registration.created', label: 'Pre-registro creado' },
            { id: 'event.date_approaching', label: 'Fecha del evento próxima' }
        ],
        actions: [
            { id: 'send_email', label: 'Enviar email', params: { template_id: 'string', to: 'string' } },
            { id: 'send_sms', label: 'Enviar SMS', params: { message: 'string' } },
            { id: 'send_whatsapp', label: 'Enviar WhatsApp', params: { message: 'string' } },
            { id: 'webhook', label: 'Disparar webhook', params: { url: 'string', payload: 'object' } },
            { id: 'update_guest', label: 'Actualizar invitado', params: { field: 'string', value: 'string' } }
        ]
    });
});

module.exports = router;
