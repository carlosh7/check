/**
 * Rutas de Estadísticas
 */
const express = require('express');
const { db, getEventConnection } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/** Helper: obtiene la BD correcta según el evento */
function getDbForEvent(eventId) {
    const event = db.prepare("SELECT id, has_own_db FROM events WHERE id = ?").get(eventId);
    if (!event) return null;
    if (event.has_own_db) {
        const eventDb = getEventConnection(eventId);
        return eventDb || db;
    }
    return db;
}

/**
 * GET /api/stats/:eventId
 * Retorna métricas completas de un evento
 */
router.get('/stats/:eventId', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID inválido' });

        const targetDb = getDbForEvent(eId);
        if (!targetDb) return res.status(404).json({ error: 'Evento no encontrado' });

        const gen = targetDb.prepare(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checkedIn,
                   COUNT(DISTINCT organization) as orgs,
                   SUM(CASE WHEN is_new_registration = 1 THEN 1 ELSE 0 END) as onsite
            FROM guests WHERE event_id = ?
        `).get(eId);

        const health = targetDb.prepare(`
            SELECT COUNT(*) as count FROM guests WHERE event_id = ?
              AND (dietary_notes IS NOT NULL AND dietary_notes != ''
                   AND LOWER(dietary_notes) != 'ninguna' AND LOWER(dietary_notes) != 'sin restricciones')
        `).get(eId);

        const flowData = targetDb.prepare(`
            SELECT strftime('%H', checkin_time) as hour, COUNT(*) as count
            FROM guests WHERE event_id = ? AND checked_in = 1 AND checkin_time IS NOT NULL
            GROUP BY hour ORDER BY hour
        `).all(eId);

        const orgsRaw = targetDb.prepare(`
            SELECT organization, COUNT(*) as count FROM guests
            WHERE event_id = ? AND organization IS NOT NULL AND organization != ''
            GROUP BY organization ORDER BY count DESC
        `).all(eId);

        let orgDistribution = orgsRaw.slice(0, 5);
        if (orgsRaw.length > 5) {
            const othersCount = orgsRaw.slice(5).reduce((a, c) => a + c.count, 0);
            orgDistribution.push({ organization: 'Otros', count: othersCount });
        }

        const genderDistribution = targetDb.prepare(`
            SELECT gender, COUNT(*) as count FROM guests WHERE event_id = ? AND gender IS NOT NULL
            GROUP BY gender
        `).all(eId);

        const dietaryDistribution = targetDb.prepare(`
            SELECT CASE
                WHEN dietary_notes LIKE '%vegano%' OR dietary_notes LIKE '%vegetariano%' THEN 'Vegano/Vegetariano'
                WHEN dietary_notes IS NOT NULL AND dietary_notes != '' THEN 'Otras dietas'
                ELSE 'Sin restricciones'
            END as diet_type, COUNT(*) as count
            FROM guests WHERE event_id = ?
            GROUP BY diet_type
        `).all(eId);

        const total = gen.total || 0;
        const checkedIn = gen.checkedIn || 0;
        const pending = total - checkedIn;

        res.json({
            total, checkedIn, pending,
            conversionRate: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
            orgs: gen.orgs || 0,
            onsite: gen.onsite || 0,
            healthAlerts: health.count || 0,
            flowData, orgDistribution, genderDistribution, dietaryDistribution
        });
    } catch (err) {
        console.error('[STATS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

module.exports = router;