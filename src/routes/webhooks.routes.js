/**
 * Rutas de webhooks para integraciones externas
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { schemas, validate } = require('../security/validation');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');
const {
    WEBHOOK_EVENTS,
    createWebhook,
    updateWebhook,
    getWebhook,
    listWebhooks,
    deleteWebhook,
    generateSecret,
    triggerWebhooks,
    sendWebhook
} = require('../utils/webhooks');

const router = express.Router();

// Get all webhooks (admin only or filtered by event access)
router.get('/', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        let filters = {};
        
        // Non-admins can only see webhooks for events they have access to
        if (req.userRole !== 'ADMIN') {
            // Get event IDs the user has access to
            const groupIds = require('../utils/helpers').getProducerGroups(req.userId);
            let eventIds = [];
            if (groupIds.length > 0) {
                const placeholders = groupIds.map(() => '?').join(',');
                const events = db.prepare(`SELECT id FROM events WHERE group_id IN (${placeholders})`).all(...groupIds);
                eventIds = events.map(e => e.id);
            }
            
            // If user has no event access, return empty
            if (eventIds.length === 0) {
                return res.json([]);
            }
            
            // Get webhooks for those events or global webhooks (event_id IS NULL)
            const placeholders = eventIds.map(() => '?').join(',');
            const rows = db.prepare(`
                SELECT * FROM webhooks 
                WHERE status = 'ACTIVE' AND (event_id IS NULL OR event_id IN (${placeholders}))
                ORDER BY created_at DESC
            `).all(...eventIds);
            
            return res.json(rows.map(row => ({
                ...row,
                events: JSON.parse(row.events || '[]'),
                headers: row.headers ? JSON.parse(row.headers) : null
            })));
        }
        
        // Admin: return all webhooks
        const webhooks = listWebhooks();
        res.json(webhooks);
    } catch (error) {
        console.error('Error fetching webhooks:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Get specific webhook
router.get('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        const webhook = getWebhook(req.params.id);
        if (!webhook) {
            return res.status(404).json({ error: 'Webhook no encontrado' });
        }
        
        // Check access
        if (req.userRole !== 'ADMIN' && webhook.event_id) {
            const { hasEventAccess } = require('../utils/helpers');
            if (!hasEventAccess(req.userId, webhook.event_id, req.userRole)) {
                return res.status(403).json({ error: 'No tienes acceso a este webhook' });
            }
        }
        
        res.json(webhook);
    } catch (error) {
        console.error('Error fetching webhook:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Create new webhook
router.post('/', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        const v = validate(schemas.createWebhook || {}, req.body);
        if (!v.valid) {
            return res.status(400).json({ errors: v.errors });
        }
        
        const data = req.body;
        
        // Validate events array
        if (!Array.isArray(data.events) || data.events.length === 0) {
            return res.status(400).json({ error: 'Debe especificar al menos un evento' });
        }
        
        // Validate URL
        try {
            new URL(data.url);
        } catch (_) {
            return res.status(400).json({ error: 'URL inválida' });
        }
        
        // Check event access for non-admins
        if (req.userRole !== 'ADMIN' && data.event_id) {
            const { hasEventAccess } = require('../utils/helpers');
            if (!hasEventAccess(req.userId, data.event_id, req.userRole)) {
                return res.status(403).json({ error: 'No tienes acceso a este evento' });
            }
        }
        
        // Generate secret if not provided
        if (!data.secret) {
            data.secret = generateSecret();
        }
        
        const webhook = createWebhook(data);
        
        logAction(req, AUDIT_ACTIONS.WEBHOOK_CREATED, {
            webhook_id: webhook.id,
            event_id: webhook.event_id,
            name: webhook.name
        });
        
        res.status(201).json(webhook);
    } catch (error) {
        console.error('Error creating webhook:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Update webhook
router.put('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        const webhook = getWebhook(req.params.id);
        if (!webhook) {
            return res.status(404).json({ error: 'Webhook no encontrado' });
        }
        
        // Check access
        if (req.userRole !== 'ADMIN' && webhook.event_id) {
            const { hasEventAccess } = require('../utils/helpers');
            if (!hasEventAccess(req.userId, webhook.event_id, req.userRole)) {
                return res.status(403).json({ error: 'No tienes acceso a este webhook' });
            }
        }
        
        const data = req.body;
        
        // Validate URL if provided
        if (data.url) {
            try {
                new URL(data.url);
            } catch (_) {
                return res.status(400).json({ error: 'URL inválida' });
            }
        }
        
        // Validate events array if provided
        if (data.events !== undefined) {
            if (!Array.isArray(data.events) || data.events.length === 0) {
                return res.status(400).json({ error: 'Debe especificar al menos un evento' });
            }
        }
        
        // Check event access if changing event_id
        if (data.event_id !== undefined && req.userRole !== 'ADMIN') {
            const { hasEventAccess } = require('../utils/helpers');
            if (!hasEventAccess(req.userId, data.event_id, req.userRole)) {
                return res.status(403).json({ error: 'No tienes acceso al nuevo evento' });
            }
        }
        
        const updated = updateWebhook(req.params.id, data);
        
        logAction(req, AUDIT_ACTIONS.WEBHOOK_UPDATED, {
            webhook_id: updated.id,
            changes: Object.keys(data)
        });
        
        res.json(updated);
    } catch (error) {
        console.error('Error updating webhook:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Delete webhook
router.delete('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        const webhook = getWebhook(req.params.id);
        if (!webhook) {
            return res.status(404).json({ error: 'Webhook no encontrado' });
        }
        
        // Check access
        if (req.userRole !== 'ADMIN' && webhook.event_id) {
            const { hasEventAccess } = require('../utils/helpers');
            if (!hasEventAccess(req.userId, webhook.event_id, req.userRole)) {
                return res.status(403).json({ error: 'No tienes acceso a este webhook' });
            }
        }
        
        deleteWebhook(req.params.id);
        
        logAction(req, AUDIT_ACTIONS.WEBHOOK_DELETED, {
            webhook_id: webhook.id,
            name: webhook.name
        });
        
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting webhook:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Test webhook delivery (manual trigger)
router.post('/:id/test', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        const webhook = getWebhook(req.params.id);
        if (!webhook) {
            return res.status(404).json({ error: 'Webhook no encontrado' });
        }
        
        // Check access
        if (req.userRole !== 'ADMIN' && webhook.event_id) {
            const { hasEventAccess } = require('../utils/helpers');
            if (!hasEventAccess(req.userId, webhook.event_id, req.userRole)) {
                return res.status(403).json({ error: 'No tienes acceso a este webhook' });
            }
        }
        
        const testData = {
            test: true,
            message: 'Test webhook from Check Pro',
            timestamp: new Date().toISOString()
        };
        
        const response = await sendWebhook(webhook, 'test', testData);
        
        res.json({
            success: true,
            status: response.status,
            statusText: response.statusText,
            message: 'Webhook enviado exitosamente'
        });
    } catch (error) {
        console.error('Error testing webhook:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            message: 'Error al enviar webhook' 
        });
    }
});

// Get available webhook event types
router.get('/events/available', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    res.json({
        events: WEBHOOK_EVENTS,
        description: 'Tipos de eventos disponibles para webhooks'
    });
});

module.exports = router;