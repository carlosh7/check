/**
 * Rutas de Venues / Espacios Físicos
 */
const express = require('express');
const { db } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');

const logger = require("../utils/logger");
const router = express.Router();

// Listar todos los espacios
router.get('/', authMiddleware(), (req, res) => {
    try {
        const venues = db.prepare("SELECT * FROM venues ORDER BY name ASC").all();
        res.json(venues);
    } catch (e) {
        logger.error('[VENUES] Error listing:', e.message);
        res.status(500).json({ error: 'Error al listar espacios' });
    }
});

// Obtener un espacio
router.get('/:id', authMiddleware(), (req, res) => {
    try {
        const id = castId('venues', req.params.id);
        if (!id) return res.status(400).json({ error: 'ID inválido' });
        const venue = db.prepare("SELECT * FROM venues WHERE id = ?").get(id);
        if (!venue) return res.status(404).json({ error: 'Espacio no encontrado' });
        res.json(venue);
    } catch (e) {
        logger.error('[VENUES] Error getting:', e.message);
        res.status(500).json({ error: 'Error al obtener espacio' });
    }
});

// Crear espacio
router.post('/', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { name, address, capacity, resources, description } = req.body;
        if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

        const id = getValidId('venues');
        const now = new Date().toISOString();

        db.prepare(`INSERT INTO venues (id, name, address, capacity, resources, description, created_at, created_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
            id, name, address || '', capacity || 0,
            JSON.stringify(resources || []), description || '', now, req.userId
        );

        logAction(req, AUDIT_ACTIONS.EVENT_CREATED, { venueId: id, name });
        res.json({ success: true, venueId: id });
    } catch (e) {
        logger.error('[VENUES] Error creating:', e.message);
        res.status(500).json({ error: 'Error al crear espacio' });
    }
});

// Actualizar espacio
router.put('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const id = castId('venues', req.params.id);
        if (!id) return res.status(400).json({ error: 'ID inválido' });
        const { name, address, capacity, resources, description } = req.body;
        if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

        db.prepare(`UPDATE venues SET name = ?, address = ?, capacity = ?, resources = ?, description = ? WHERE id = ?`)
            .run(name, address || '', capacity || 0, JSON.stringify(resources || []), description || '', id);

        res.json({ success: true });
    } catch (e) {
        logger.error('[VENUES] Error updating:', e.message);
        res.status(500).json({ error: 'Error al actualizar espacio' });
    }
});

// Eliminar espacio
router.delete('/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const id = castId('venues', req.params.id);
        if (!id) return res.status(400).json({ error: 'ID inválido' });
        db.prepare("DELETE FROM venues WHERE id = ?").run(id);
        res.json({ success: true });
    } catch (e) {
        logger.error('[VENUES] Error deleting:', e.message);
        res.status(500).json({ error: 'Error al eliminar espacio' });
    }
});

// Asignar venue a evento
router.put('/:id/assign/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const venueId = castId('venues', req.params.id);
        const eventId = castId('events', req.params.eventId);
        if (!venueId || !eventId) return res.status(400).json({ error: 'IDs inválidos' });
        db.prepare("UPDATE events SET venue_id = ? WHERE id = ?").run(venueId, eventId);
        res.json({ success: true });
    } catch (e) {
        logger.error('[VENUES] Error assigning:', e.message);
        res.status(500).json({ error: 'Error al asignar espacio' });
    }
});

module.exports = router;