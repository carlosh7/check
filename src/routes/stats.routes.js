/**
 * Rutas de Estadísticas (Compatibilidad V12.3)
 */
const express = require('express');
const { db } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/stats/:eventId
 * Retorna métricas completas para el dashboard de analítica
 */
router.get('/stats/:eventId', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        
        // --- MÉTRICAS GENERALES ---
        const gen = db.prepare(`
            SELECT 
                COUNT(*) as total, 
                SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checkedIn, 
                COUNT(DISTINCT organization) as orgs, 
                SUM(CASE WHEN is_new_registration = 1 THEN 1 ELSE 0 END) as onsite 
            FROM guests WHERE event_id = ?
        `).get(eId);
        
        // --- ALERTAS DE SALUD ---
        const health = db.prepare(`
            SELECT COUNT(*) as count 
            FROM guests 
            WHERE event_id = ? 
              AND (dietary_notes IS NOT NULL AND dietary_notes != '' AND LOWER(dietary_notes) != 'ninguna' AND LOWER(dietary_notes) != 'sin restricciones')
        `).get(eId);
        
        // --- FLUJO POR HORA (Últimas 24h de actividad) ---
        const flowData = db.prepare(`
            SELECT strftime('%H', checkin_time) as hour, COUNT(*) as count 
            FROM guests 
            WHERE event_id = ? AND checked_in = 1 AND checkin_time IS NOT NULL
            GROUP BY hour ORDER BY hour
        `).all(eId);
        
        // --- DISTRIBUCIÓN POR EMPRESA (Top 5 + Otros) ---
        const orgsRaw = db.prepare(`
            SELECT organization, COUNT(*) as count 
            FROM guests 
            WHERE event_id = ? AND organization IS NOT NULL AND organization != ''
            GROUP BY organization ORDER BY count DESC
        `).all(eId);
        
        let orgDistribution = orgsRaw.slice(0, 5);
        if (orgsRaw.length > 5) {
            const othersCount = orgsRaw.slice(5).reduce((acc, curr) => acc + curr.count, 0);
            orgDistribution.push({ organization: 'Otros', count: othersCount });
        }
        
        // --- DISTRIBUCIÓN POR GÉNERO ---
        const genderDistribution = db.prepare(`
            SELECT gender, COUNT(*) as count 
            FROM guests WHERE event_id = ? AND gender IS NOT NULL
            GROUP BY gender
        `).all(eId);

        // --- DISTRIBUCIÓN DIETÉTICA ---
        const dietaryDistribution = db.prepare(`
            SELECT 
                CASE 
                    WHEN dietary_notes LIKE '%vegano%' OR dietary_notes LIKE '%vegetariano%' THEN 'Vegano/Vegetariano'
                    WHEN dietary_notes IS NOT NULL AND dietary_notes != '' THEN 'Otras dietas'
                    ELSE 'Sin restricciones'
                END as diet_type,
                COUNT(*) as count
            FROM guests 
            WHERE event_id = ?
            GROUP BY diet_type
        `).all(eId);
        
        res.json({ 
            healthAlerts: health.count || 0, 
            flowData,
            orgDistribution,
            genderDistribution,
            dietaryDistribution
        });
    } catch (err) {
        console.error('[STATS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

module.exports = router;
