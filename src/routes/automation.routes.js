const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { triggerWebhooks, WEBHOOK_EVENTS } = require('../utils/webhooks');

const router = express.Router();

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
        var { name, trigger_event, conditions, actions } = req.body;
        if (!name || !trigger_event || !actions) return res.status(400).json({ error: 'Nombre, evento y acciones requeridos' });
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
        var { name, trigger_event, conditions, actions, enabled } = req.body;
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
