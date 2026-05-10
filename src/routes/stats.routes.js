/**
 * Rutas de Estadísticas
 */
const express = require('express');
const { db, getEventConnection } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

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

// ─── Dashboard global (C2-08) ───

router.get('/analytics', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var period = parseInt(req.query.period) || 30;
        var since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

        var totalEvents = db.prepare("SELECT COUNT(*) as c FROM events").get().c;
        var totalGuests = db.prepare("SELECT COUNT(*) as c FROM guests").get().c;
        var totalChecked = db.prepare("SELECT COUNT(*) as c FROM guests WHERE checked_in = 1").get().c;
        var totalUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'APPROVED'").get().c;

        var trend = db.prepare("SELECT date(created_at) as day, COUNT(*) as c FROM guests WHERE created_at >= ? GROUP BY day ORDER BY day ASC").all(since);
        var topEvents = db.prepare("SELECT e.id, e.name, COUNT(g.id) as c FROM events e LEFT JOIN guests g ON g.event_id = e.id GROUP BY e.id ORDER BY c DESC LIMIT 10").all();
        var monthly = db.prepare("SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as c FROM guests GROUP BY month ORDER BY month ASC LIMIT 12").all();

        res.json({
            totalEvents, totalGuests, totalChecked, totalUsers,
            conversionRate: totalGuests > 0 ? Math.round((totalChecked / totalGuests) * 100) : 0,
            trend, topEvents, monthly
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/:eventId', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID inválido' });

        const org = (req.query.org || '').trim();
        const cargo = (req.query.cargo || '').trim();
        const vegano = (req.query.vegano || '').trim();
        const status = (req.query.status || '').trim();
        const q = (req.query.q || '').trim();

        const wheres = ['event_id = ?'];
        const params = [eId];
        if (org) { wheres.push('organization = ?'); params.push(org); }
        if (cargo) { wheres.push('cargo = ?'); params.push(cargo); }
        if (vegano) { wheres.push('vegano = ?'); params.push(vegano); }
        if (status) { wheres.push('status = ?'); params.push(status); }
        if (q) {
            wheres.push("(name LIKE ? OR email LIKE ? OR phone LIKE ? OR organization LIKE ? OR cargo LIKE ?)");
            const like = '%' + q + '%';
            params.push(like, like, like, like, like);
        }
        const where = wheres.join(' AND ');

        const dbs = getDbsForEvent(eId);

        const total = querySum(dbs, "SELECT COUNT(*) as c FROM guests WHERE " + where, params);
        const checkedIn = querySum(dbs, "SELECT COUNT(*) as c FROM guests WHERE " + where + " AND checked_in = 1", params);
        const pending = total - checkedIn;
        const orgsCount = querySum(dbs, "SELECT COUNT(DISTINCT organization) as c FROM guests WHERE " + where + " AND organization IS NOT NULL AND organization != ''", params);
        const onsite = querySum(dbs, "SELECT COUNT(*) as c FROM guests WHERE " + where + " AND is_new_registration = 1", params);

        const health = querySum(dbs, "SELECT COUNT(*) as c FROM guests WHERE " + where + " AND (dietary_notes IS NOT NULL AND dietary_notes != '' AND LOWER(dietary_notes) != 'ninguna' AND LOWER(dietary_notes) != 'sin restricciones')", params);

        const flowData = queryAll(dbs, "SELECT strftime('%H', checkin_time) as hour, COUNT(*) as count FROM guests WHERE " + where + " AND checked_in = 1 AND checkin_time IS NOT NULL GROUP BY hour ORDER BY hour", params);
        const flowMap = {};
        flowData.forEach(f => { flowMap[f.hour] = (flowMap[f.hour] || 0) + f.count; });
        const mergedFlow = Object.entries(flowMap).sort().map(([hour, count]) => ({ hour, count }));

        const orgsRaw = queryAll(dbs, "SELECT organization, COUNT(*) as count FROM guests WHERE " + where + " AND organization IS NOT NULL AND organization != '' GROUP BY organization ORDER BY count DESC", params);
        const orgMap = {};
        orgsRaw.forEach(o => { orgMap[o.organization] = (orgMap[o.organization] || 0) + o.count; });
        let mergedOrgs = Object.entries(orgMap).sort((a, b) => b[1] - a[1]).map(([organization, count]) => ({ organization, count }));
        let orgDistribution = mergedOrgs.slice(0, 5);
        if (mergedOrgs.length > 5) {
            const othersCount = mergedOrgs.slice(5).reduce((a, c) => a + c.count, 0);
            orgDistribution.push({ organization: 'Otros', count: othersCount });
        }

        const genderRaw = queryAll(dbs, "SELECT gender, COUNT(*) as count FROM guests WHERE " + where + " AND gender IS NOT NULL GROUP BY gender", params);
        const genderMap = {};
        genderRaw.forEach(g => { genderMap[g.gender] = (genderMap[g.gender] || 0) + g.count; });
        const genderDistribution = Object.entries(genderMap).map(([gender, count]) => ({ gender, count }));

        const dietRaw = queryAll(dbs, `SELECT CASE WHEN dietary_notes LIKE '%vegano%' OR dietary_notes LIKE '%vegetariano%' THEN 'Vegano/Vegetariano' WHEN dietary_notes IS NOT NULL AND dietary_notes != '' THEN 'Otras dietas' ELSE 'Sin restricciones' END as diet_type, COUNT(*) as count FROM guests WHERE ` + where + ` GROUP BY diet_type`, params);
        const dietMap = {};
        dietRaw.forEach(d => { dietMap[d.diet_type] = (dietMap[d.diet_type] || 0) + d.count; });
        const dietaryDistribution = Object.entries(dietMap).map(([diet_type, count]) => ({ diet_type, count }));

        const headerNames = ['nombre', 'name', 'asistente', 'email', 'telefono', 'teléfono', 'phone', 'organizaci', 'organization', 'cargo', 'vegano', 'restricci', 'restricciones', 'dietary_notes', 'observaciones', 'comentarios'];
        const restrictedRaw = queryAll(dbs, `SELECT name, email, phone, organization, vegano, COALESCE(NULLIF(restricciones,''), dietary_notes) as restriccion FROM guests WHERE ` + where + ` AND (COALESCE(NULLIF(restricciones,''), dietary_notes) IS NOT NULL AND COALESCE(NULLIF(restricciones,''), dietary_notes) != '' AND LOWER(COALESCE(NULLIF(restricciones,''), dietary_notes)) NOT IN ('ninguna','sin restricciones','no','n/a')) ORDER BY name ASC`, params);
        const restrictedGuests = restrictedRaw.filter(g => {
            const n = (g.name || '').toLowerCase().trim();
            return n && !headerNames.some(h => n.startsWith(h));
        });

        res.json({
            total, checkedIn, pending,
            conversionRate: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
            orgs: orgsCount, onsite,
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

// ─── DB Maintenance (C2-09) ───

router.post('/db/maintenance', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var action = req.body.action || 'analyze';
        var result = {};
        if (action === 'analyze' || action === 'all') {
            db.exec("ANALYZE");
            result.analyze = 'OK';
        }
        if (action === 'integrity_check' || action === 'all') {
            var check = db.prepare("PRAGMA integrity_check").get();
            result.integrity = check ? check['integrity_check'] : 'unknown';
        }
        if (action === 'quick_optimize' || action === 'all') {
            db.exec("PRAGMA optimize");
            result.optimize = 'OK';
        }
        if (action === 'stats') {
            var pageCount = db.prepare("PRAGMA page_count").get();
            var pageSize = db.prepare("PRAGMA page_size").get();
            var tableCount = db.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'").get();
            var indexCount = db.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='index'").get();
            result.stats = {
                page_count: pageCount?.page_count || 0,
                page_size: pageSize?.page_size || 0,
                db_size_kb: Math.round((pageCount?.page_count || 0) * (pageSize?.page_size || 0) / 1024),
                tables: tableCount?.c || 0,
                indexes: indexCount?.c || 0
            };
        }
        if (action === 'quick_optimize' || action === 'all') {
            // Limpiar webhook logs viejos (>30 días)
            var old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            var deleted = db.prepare("DELETE FROM webhook_logs WHERE created_at < ?").run(old);
            result.clean_logs = deleted.changes + ' logs eliminados';
        }
        res.json({ success: true, action: action, result: result });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;