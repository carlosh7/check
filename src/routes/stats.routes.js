/**
 * Rutas de Estadísticas
 */
const express = require('express');
const { db, getEventConnection } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/** Helper: obtiene todas las BD que pueden tener invitados de este evento */
function getDbsForEvent(eventId) {
    const dbs = [db];
    try {
        const event = db.prepare("SELECT id, has_own_db FROM events WHERE id = ?").get(eventId);
        if (event && event.has_own_db) {
            const eventDb = getEventConnection(eventId);
            if (eventDb && eventDb !== db) dbs.push(eventDb);
        }
    } catch (e) {}
    return dbs;
}

/** Helper: ejecuta una query en todas las BD y combina resultados (arrays) */
function queryAll(dbs, sql, params) {
    const all = [];
    for (const targetDb of dbs) {
        try {
            const rows = targetDb.prepare(sql).all(...params);
            all.push(...rows);
        } catch (e) {}
    }
    return all;
}

/** Helper: ejecuta una query escalar en todas las BD y suma resultados */
function querySum(dbs, sql, params) {
    let total = 0;
    for (const targetDb of dbs) {
        try {
            const row = targetDb.prepare(sql).get(...params);
            if (row) total += Number(Object.values(row)[0]) || 0;
        } catch (e) {}
    }
    return total;
}

/**
 * GET /api/stats/:eventId
 * Retorna métricas completas de un evento
 */
router.get('/stats/:eventId', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID inválido' });

        const dbs = getDbsForEvent(eId);

        const total = querySum(dbs, "SELECT COUNT(*) as c FROM guests WHERE event_id = ?", [eId]);
        const checkedIn = querySum(dbs, "SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND checked_in = 1", [eId]);
        const pending = total - checkedIn;
        const orgs = querySum(dbs, "SELECT COUNT(DISTINCT organization) as c FROM guests WHERE event_id = ? AND organization IS NOT NULL AND organization != ''", [eId]);
        const onsite = querySum(dbs, "SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND is_new_registration = 1", [eId]);

        const health = querySum(dbs, "SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND (dietary_notes IS NOT NULL AND dietary_notes != '' AND LOWER(dietary_notes) != 'ninguna' AND LOWER(dietary_notes) != 'sin restricciones')", [eId]);

        const flowData = queryAll(dbs, "SELECT strftime('%H', checkin_time) as hour, COUNT(*) as count FROM guests WHERE event_id = ? AND checked_in = 1 AND checkin_time IS NOT NULL GROUP BY hour ORDER BY hour", [eId]);

        // Merge flow data by hour
        const flowMap = {};
        flowData.forEach(f => { flowMap[f.hour] = (flowMap[f.hour] || 0) + f.count; });
        const mergedFlow = Object.entries(flowMap).sort().map(([hour, count]) => ({ hour, count }));

        const orgsRaw = queryAll(dbs, "SELECT organization, COUNT(*) as count FROM guests WHERE event_id = ? AND organization IS NOT NULL AND organization != '' GROUP BY organization ORDER BY count DESC", [eId]);
        const orgMap = {};
        orgsRaw.forEach(o => { orgMap[o.organization] = (orgMap[o.organization] || 0) + o.count; });
        let mergedOrgs = Object.entries(orgMap).sort((a, b) => b[1] - a[1]).map(([organization, count]) => ({ organization, count }));
        let orgDistribution = mergedOrgs.slice(0, 5);
        if (mergedOrgs.length > 5) {
            const othersCount = mergedOrgs.slice(5).reduce((a, c) => a + c.count, 0);
            orgDistribution.push({ organization: 'Otros', count: othersCount });
        }

        const genderRaw = queryAll(dbs, "SELECT gender, COUNT(*) as count FROM guests WHERE event_id = ? AND gender IS NOT NULL GROUP BY gender", [eId]);
        const genderMap = {};
        genderRaw.forEach(g => { genderMap[g.gender] = (genderMap[g.gender] || 0) + g.count; });
        const genderDistribution = Object.entries(genderMap).map(([gender, count]) => ({ gender, count }));

        const dietRaw = queryAll(dbs, `SELECT CASE WHEN dietary_notes LIKE '%vegano%' OR dietary_notes LIKE '%vegetariano%' THEN 'Vegano/Vegetariano' WHEN dietary_notes IS NOT NULL AND dietary_notes != '' THEN 'Otras dietas' ELSE 'Sin restricciones' END as diet_type, COUNT(*) as count FROM guests WHERE event_id = ? GROUP BY diet_type`, [eId]);
        const dietMap = {};
        dietRaw.forEach(d => { dietMap[d.diet_type] = (dietMap[d.diet_type] || 0) + d.count; });
        const dietaryDistribution = Object.entries(dietMap).map(([diet_type, count]) => ({ diet_type, count }));

        const headerNames = ['nombre', 'name', 'asistente', 'email', 'telefono', 'teléfono', 'phone', 'organizaci', 'organization', 'cargo', 'vegano', 'restricci', 'restricciones', 'dietary_notes', 'observaciones', 'comentarios'];
        const restrictedRaw = queryAll(dbs, `SELECT name, email, phone, organization, vegano, COALESCE(NULLIF(restricciones,''), dietary_notes) as restriccion FROM guests WHERE event_id = ? AND (COALESCE(NULLIF(restricciones,''), dietary_notes) IS NOT NULL AND COALESCE(NULLIF(restricciones,''), dietary_notes) != '' AND LOWER(COALESCE(NULLIF(restricciones,''), dietary_notes)) NOT IN ('ninguna','sin restricciones','no','n/a')) ORDER BY name ASC`, [eId]);
        const restrictedGuests = restrictedRaw.filter(g => {
            const n = (g.name || '').toLowerCase().trim();
            return n && !headerNames.some(h => n.startsWith(h));
        });

        res.json({
            total, checkedIn, pending,
            conversionRate: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
            orgs, onsite,
            healthAlerts: health,
            flowData: mergedFlow,
            orgDistribution, genderDistribution, dietaryDistribution,
            restrictedGuests
        });
    } catch (err) {
        console.error('[STATS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

module.exports = router;