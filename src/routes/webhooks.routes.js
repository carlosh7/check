/**
 * Rutas de webhooks para integraciones externas
 *
 * @openapi
 * tags:
 *   - name: Webhooks
 *     description: Webhooks para integraciones externas
 *
 * /api/webhooks:
 *   get:
 *     tags: [Webhooks]
 *     summary: Listar webhooks
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *     responses:
 *       200: { description: Lista de webhooks }
 *   post:
 *     tags: [Webhooks]
 *     summary: Crear webhook
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *     responses:
 *       201: { description: Webhook creado }
 *
 * /api/webhooks/{id}:
 *   get:
 *     tags: [Webhooks]
 *     summary: Obtener webhook
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *     responses:
 *       200: { description: Datos del webhook }
 *   put:
 *     tags: [Webhooks]
 *     summary: Actualizar webhook
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *     responses:
 *       200: { description: Webhook actualizado }
 *   delete:
 *     tags: [Webhooks]
 *     summary: Eliminar webhook
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *     responses:
 *       204: { description: Webhook eliminado }
 *
 * /api/webhooks/{id}/test:
 *   post:
 *     tags: [Webhooks]
 *     summary: Probar envío de webhook
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *     responses:
 *       200: { description: Resultado del envío }
 *
 * /api/webhooks/{id}/logs:
 *   get:
 *     tags: [Webhooks]
 *     summary: Obtener logs de entregas
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *     responses:
 *       200: { description: Lista de logs }
 *
 * /api/webhooks/events/available:
 *   get:
 *     tags: [Webhooks]
 *     summary: Tipos de eventos disponibles
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *     responses:
 *       200: { description: Eventos disponibles }
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
    sendWebhook,
    logWebhookDelivery,
    getWebhookLogs,
    findBlockedWebhookHeader // v12.44.846 (auditoría 2026-11-25, S7)
} = require('../utils/webhooks');

const logger = require("../utils/logger");
const router = express.Router();

// v12.44.844: import de nivel superior — los guards de acceso lo usan en sus condiciones
// (antes solo existían requires inline DENTRO de los bloques, después de la condición)
const { hasEventAccess } = require('../utils/helpers');

// v12.44.846 (auditoría 2026-11-25, S7): portero de destinos salientes (prevención de SSRF).
// Antes la única validación era `new URL(url)`, que acepta http://localhost,
// http://169.254.169.254/, http://10.0.0.5/ o cualquier otra dirección interna.
const { checkUrlAllowed } = require('../security/network-policy');

/**
 * v12.44.846 (auditoría 2026-11-25, S7): guard común a crear y editar.
 * Comprueba la URL de destino (si se envía o si se indica `checkUrl`) y las
 * cabeceras. Devuelve { error, code } para responder 400, o null si todo es seguro.
 * @param {Object} data
 * @param {{checkUrl: boolean}} [options]
 */
async function findUnsafeWebhookConfig(data, options) {
    const blockedHeader = findBlockedWebhookHeader(data.headers);
    if (blockedHeader) {
        return { error: `Cabecera no permitida en webhooks: ${blockedHeader}`, code: 'WEBHOOK_HEADER_BLOCKED' };
    }
    const checkUrl = options ? options.checkUrl !== false : true;
    if (checkUrl) {
        const destination = await checkUrlAllowed(data.url);
        if (!destination.allowed) return { error: destination.reason, code: destination.code };
    }
    return null;
}

// Get all webhooks (admin only or filtered by event access)
router.get('/', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        {}
        
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
            
            // v12.44.844: SIN webhooks globales para PRODUCTOR (antes filtraban su secreto HMAC)
            const placeholders = eventIds.map(() => '?').join(',');
            const rows = db.prepare(`
                SELECT * FROM webhooks 
                WHERE status = 'ACTIVE' AND event_id IN (${placeholders})
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
        logger.error('Error fetching webhooks:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Get specific webhook
router.get('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const webhook = getWebhook(req.params.id);
        if (!webhook) {
            return res.status(404).json({ error: 'Webhook no encontrado' });
        }
        
        // Check access
        if (req.userRole !== 'ADMIN' && (!webhook.event_id || !hasEventAccess(req.userId, webhook.event_id, req.userRole))) { // v12.44.844: los globales (sin evento) son solo ADMIN
            const { hasEventAccess } = require('../utils/helpers');
            if (!hasEventAccess(req.userId, webhook.event_id, req.userRole)) {
                return res.status(403).json({ error: 'No tienes acceso a este webhook' });
            }
        }
        
        res.json(webhook);
    } catch (error) {
        logger.error('Error fetching webhook:', error);
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
        
        // v12.44.846 (auditoría 2026-11-25, S7): la URL debe apuntar a un destino público (se
        // resuelve el nombre y se rechaza si alguna dirección es privada/reservada) y las
        // cabeceras no pueden ser Host / Content-Length / Connection.
        const unsafe = await findUnsafeWebhookConfig(data);
        if (unsafe) {
            return res.status(400).json(unsafe);
        }
        
        // Check event access for non-admins
        if (req.userRole !== 'ADMIN' && (!data.event_id || !hasEventAccess(req.userId, data.event_id, req.userRole))) { // v12.44.844: exigir evento propio; sin evento = solo ADMIN
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
        logger.error('Error creating webhook:', error);
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
        if (req.userRole !== 'ADMIN' && (!webhook.event_id || !hasEventAccess(req.userId, webhook.event_id, req.userRole))) { // v12.44.844: los globales (sin evento) son solo ADMIN
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
        
        // v12.44.846 (auditoría 2026-11-25, S7): mismo guard que al crear, sobre la URL nueva y
        // las cabeceras. Se valida la URL solo si el PUT la trae (`if (data.url)` dejaba pasar
        // una URL vacía o nula): así un webhook antiguo con destino interno todavía se puede
        // desactivar o reeditarse, y su destino se vuelve a comprobar en cada envío.
        const unsafe = await findUnsafeWebhookConfig(data, { checkUrl: data.url !== undefined });
        if (unsafe) {
            return res.status(400).json(unsafe);
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
        logger.error('Error updating webhook:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Delete webhook
router.delete('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const webhook = getWebhook(req.params.id);
        if (!webhook) {
            return res.status(404).json({ error: 'Webhook no encontrado' });
        }
        
        // Check access
        if (req.userRole !== 'ADMIN' && (!webhook.event_id || !hasEventAccess(req.userId, webhook.event_id, req.userRole))) { // v12.44.844: los globales (sin evento) son solo ADMIN
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
        logger.error('Error deleting webhook:', error);
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
        if (req.userRole !== 'ADMIN' && (!webhook.event_id || !hasEventAccess(req.userId, webhook.event_id, req.userRole))) { // v12.44.844: los globales (sin evento) son solo ADMIN
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
        // v12.44.846 (auditoría 2026-11-25, S7): destino bloqueado por la política de red → 400 claro
        // con el motivo, en vez de un 500 genérico. El envío no llegó a hacerse.
        if (error && error.code === 'SSRF_BLOCKED') {
            logger.warn(`[WEBHOOKS] Prueba de ${req.params.id} no enviada: ${error.message}`);
            return res.status(400).json({
                success: false,
                error: error.message,
                message: 'El destino del webhook no está permitido por la política de red'
            });
        }
        logger.error('Error testing webhook:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            message: 'Error al enviar webhook' 
        });
    }
});

// Get webhook delivery logs
router.get('/:id/logs', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const webhook = getWebhook(req.params.id);
        if (!webhook) return res.status(404).json({ error: 'Webhook no encontrado' });
        if (req.userRole !== 'ADMIN' && (!webhook.event_id || !hasEventAccess(req.userId, webhook.event_id, req.userRole))) { // v12.44.844: los globales (sin evento) son solo ADMIN
            const { hasEventAccess } = require('../utils/helpers');
            if (!hasEventAccess(req.userId, webhook.event_id, req.userRole)) return res.status(403).json({ error: 'No tienes acceso' });
        }
        const logs = getWebhookLogs(req.params.id, parseInt(req.query.limit) || 50);
        res.json(logs);
    } catch (error) {
        logger.error('Error fetching webhook logs:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Delete webhook logs
router.delete('/:id/logs', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const webhook = getWebhook(req.params.id);
        if (!webhook) return res.status(404).json({ error: 'Webhook no encontrado' });
        // v12.44.846 (auditoría 2026-11-25, S7-ACCESS): control de acceso que faltaba. Era la única
        // ruta de webhooks sin hasEventAccess: cualquier PRODUCTOR borraba el historial de
        // entregas de UN WEBHOOK AJENO sabiendo su id (y así borraba las pruebas de un abuso).
        // Mismo criterio que GET /:id/logs: los globales (sin evento) son solo ADMIN.
        if (req.userRole !== 'ADMIN' && (!webhook.event_id || !hasEventAccess(req.userId, webhook.event_id, req.userRole))) {
            return res.status(403).json({ error: 'No tienes acceso' });
        }
        db.prepare("DELETE FROM webhook_logs WHERE webhook_id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
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