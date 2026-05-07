/**
 * Rutas de Estadísticas (Compatibilidad V12.3)
 */
const express = require('express');
const { db } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/stats/analytics?period=30
 * Retorna metricas globales del dashboard admin
 */
router.get('/stats/analytics', authMiddleware(), (req, res) => {
    try {
        const period = parseInt(req.query.period) || 30;
        const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

        const totalEvents = db.prepare("SELECT COUNT(*) as c FROM events").get().c;
        const recentEvents = db.prepare("SELECT COUNT(*) as c FROM events WHERE created_at >= ?").get(since).c;
        const totalGuests = db.prepare("SELECT COUNT(*) as c FROM guests").get().c;
        const guestsInPeriod = db.prepare("SELECT COUNT(*) as c FROM guests WHERE created_at >= ?").get(since).c;

        res.json({
            totalEvents,
            recentEvents,
            totalGuests,
            guestsInPeriod,
            conversionRate: totalGuests > 0 ? Math.round((guestsInPeriod / totalGuests) * 100) : 0
        });
    } catch (err) {
        console.error('[ANALYTICS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener analytics' });
    }
});

/**
 * GET /api/stats/:eventId
 * Retorna métricas completas para el dashboard de analítica
 */
router.get('/stats/:eventId', authMiddleware(), (req, res) => {
    // ... existing code ...
});

module.exports = router;