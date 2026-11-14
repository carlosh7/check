const express = require('express');
const router = express.Router();
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { getChanges, undoChange, redoChange } = require('../utils/change-log');
const { hasEventAccess } = require('../utils/helpers');

router.get('/events/:eventId/changes', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        // v12.44.844 (seguridad): el historial de cambios exige acceso al evento
        if (req.userRole !== 'ADMIN' && !hasEventAccess(req.userId, req.params.eventId, req.userRole)) {
            return res.status(403).json({ error: 'No tienes acceso a este evento' });
        }
        const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 100), 500);
        const changes = getChanges(req.params.eventId, limit);
        res.json(changes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/events/:eventId/changes/:changeId/undo', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        // v12.44.844 (auditoría Pagos #6): antes CUALQUIER rol aprobado deshacía cambios
        // de invitados de CUALQUIER evento — ahora exige acceso al evento del cambio.
        const _cambio = db.prepare("SELECT event_id FROM change_log WHERE id = ?").get(req.params.changeId);
        if (!_cambio) return res.status(404).json({ error: 'Cambio no encontrado' });
        if (req.userRole !== 'ADMIN' && !hasEventAccess(req.userId, _cambio.event_id, req.userRole)) {
            return res.status(403).json({ error: 'No tienes acceso a este evento' });
        }
        const result = undoChange(req.params.changeId);
        if (result.error) return res.status(400).json(result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/events/:eventId/changes/:changeId/redo', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        // v12.44.844 (auditoría Pagos #6): roles y acceso al evento del cambio
        const _cambio = db.prepare("SELECT event_id FROM change_log WHERE id = ?").get(req.params.changeId);
        if (!_cambio) return res.status(404).json({ error: 'Cambio no encontrado' });
        if (req.userRole !== 'ADMIN' && !hasEventAccess(req.userId, _cambio.event_id, req.userRole)) {
            return res.status(403).json({ error: 'No tienes acceso a este evento' });
        }
        const result = redoChange(req.params.changeId);
        if (result.error) return res.status(400).json(result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
