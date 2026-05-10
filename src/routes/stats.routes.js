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

// ─── AI Reports / Insights (C4-09) ───

router.get('/reports/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var eId = require('../utils/helpers').castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID inválido' });

        var event = db.prepare("SELECT name, date, location FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        var dbs = getDbsForEvent(eId);
        var total = querySum(dbs, "SELECT COUNT(*) as c FROM guests WHERE event_id = ?", [eId]);
        var checked = querySum(dbs, "SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND checked_in = 1", [eId]);
        var pending = total - checked;

        var byOrg = queryAll(dbs, "SELECT organization, COUNT(*) as c FROM guests WHERE event_id = ? AND organization IS NOT NULL AND organization != '' GROUP BY organization ORDER BY c DESC LIMIT 5", [eId]);
        var byHour = queryAll(dbs, "SELECT strftime('%H', checkin_time) as h, COUNT(*) as c FROM guests WHERE event_id = ? AND checked_in = 1 AND checkin_time IS NOT NULL GROUP BY h ORDER BY c DESC LIMIT 3", [eId]);
        var byDay = queryAll(dbs, "SELECT date(created_at) as d, COUNT(*) as c FROM guests WHERE event_id = ? GROUP BY d ORDER BY d ASC", [eId]);

        var peakHour = byHour.length > 0 ? byHour[0].h + ':00' : 'N/A';
        var topOrg = byOrg.length > 0 ? byOrg[0].organization : 'N/A';
        var conversionRate = total > 0 ? Math.round((checked / total) * 100) : 0;

        var insights = [];
        if (conversionRate > 80) insights.push('✅ Excelente tasa de asistencia: ' + conversionRate + '%');
        else if (conversionRate > 60) insights.push('📊 Buena tasa de asistencia: ' + conversionRate + '%');
        else insights.push('⚠️ Baja tasa de asistencia: ' + conversionRate + '%');

        if (total > 0) insights.push('👥 Total de invitados: ' + total + ' (' + checked + ' asistieron)');
        if (peakHour !== 'N/A') insights.push('⏰ Hora pico de check-in: ' + peakHour);
        if (topOrg !== 'N/A') insights.push('🏢 Organización con más invitados: ' + topOrg);

        if (checked > 0) {
            var attendeesPerOrg = byOrg.length;
            insights.push('📋 ' + attendeesPerOrg + ' organizaciones representadas');
            if (attendeesPerOrg > 10) insights.push('🌐 Alta diversidad de organizaciones: ' + attendeesPerOrg);
        }

        if (byDay.length > 0) {
            var daysActive = byDay.length;
            insights.push('📅 Registros durante ' + daysActive + ' días');
            if (daysActive <= 1) insights.push('⚡ La mayoría se registró el mismo día');
            else if (daysActive > 7) insights.push('📆 Registros distribuidos en más de una semana');
        }

        if (pending > 0 && pending > total * 0.5) {
            insights.push('📢 ' + pending + ' invitados pendientes — considera enviar recordatorio');
        }

        res.json({
            event: { name: event.name, date: event.date, location: event.location },
            stats: { total: total, checkedIn: checked, pending: pending, conversionRate: conversionRate },
            topOrganizations: byOrg,
            peakCheckinHour: peakHour,
            insights: insights,
            generatedAt: new Date().toISOString()
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── BI Dashboard (C5-01) ───

router.get('/bi/dashboard', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var period = parseInt(req.query.period) || 30;
        var since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

        // System-wide KPIs
        var totalEvents = db.prepare("SELECT COUNT(*) as c FROM events").get().c;
        var totalGuests = db.prepare("SELECT COUNT(*) as c FROM guests").get().c;
        var totalChecked = db.prepare("SELECT COUNT(*) as c FROM guests WHERE checked_in = 1").get().c;
        var totalUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'APPROVED'").get().c;
        var conversionRate = totalGuests > 0 ? Math.round((totalChecked / totalGuests) * 100) : 0;

        // Trends (daily registrations)
        var dailyRegs = db.prepare("SELECT date(created_at) as d, COUNT(*) as c FROM guests WHERE created_at >= ? GROUP BY d ORDER BY d ASC").all(since);
        var dailyCheckins = db.prepare("SELECT date(checkin_time) as d, COUNT(*) as c FROM guests WHERE checked_in = 1 AND checkin_time >= ? GROUP BY d ORDER BY d ASC").all(since);

        // Top events
        var topEvents = db.prepare("SELECT e.id, e.name, e.date, COUNT(g.id) as guests, SUM(CASE WHEN g.checked_in = 1 THEN 1 ELSE 0 END) as checked FROM events e LEFT JOIN guests g ON g.event_id = e.id GROUP BY e.id ORDER BY guests DESC LIMIT 10").all();

        // Monthly comparison
        var monthly = db.prepare("SELECT strftime('%Y-%m', created_at) as m, COUNT(*) as c FROM guests GROUP BY m ORDER BY m ASC LIMIT 12").all();

        // Category distribution
        var catDist = db.prepare("SELECT c.name, COUNT(g.id) as count FROM guest_categories c LEFT JOIN guests g ON g.category_id = c.id GROUP BY c.id ORDER BY count DESC LIMIT 10").all();

        // Revenue stats (completed transactions)
        var revenue = db.prepare("SELECT SUM(amount) as total, COUNT(*) as txns, AVG(amount) as avg FROM transactions WHERE status = 'completed'").get();
        var revenueByMonth = db.prepare("SELECT strftime('%Y-%m', completed_at) as m, SUM(amount) as total, COUNT(*) as txns FROM transactions WHERE status = 'completed' AND completed_at >= ? GROUP BY m ORDER BY m ASC").all(since);

        // Hourly check-in distribution
        var hourlyDist = db.prepare("SELECT strftime('%H', checkin_time) as h, COUNT(*) as c FROM guests WHERE checked_in = 1 AND checkin_time IS NOT NULL GROUP BY h ORDER BY h ASC").all();

        res.json({
            system: { totalEvents, totalGuests, totalChecked, totalUsers, conversionRate },
            trends: { dailyRegistrations: dailyRegs, dailyCheckins: dailyCheckins },
            topEvents,
            monthly,
            categoryDistribution: catDist,
            revenue: { total: revenue?.total || 0, count: revenue?.txns || 0, average: revenue?.avg || 0 },
            revenueByMonth,
            hourlyDistribution: hourlyDist,
            period,
            generatedAt: new Date().toISOString()
        });
    } catch(err) { console.error('[BI] Error:', err.message); res.status(500).json({ error: err.message }); }
});

// ─── Export BI (C5-02) ───
router.get('/bi/export/:format', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var format = req.params.format || 'json';
        var period = parseInt(req.query.period) || 30;
        var since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

        var data = {
            generatedAt: new Date().toISOString(),
            period: period + 'd',
            system: {
                events: db.prepare("SELECT COUNT(*) as c FROM events").get().c,
                guests: db.prepare("SELECT COUNT(*) as c FROM guests").get().c,
                checkedIn: db.prepare("SELECT COUNT(*) as c FROM guests WHERE checked_in = 1").get().c,
                users: db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'APPROVED'").get().c
            },
            trends: db.prepare("SELECT date(created_at) as date, COUNT(*) as count FROM guests WHERE created_at >= ? GROUP BY date ORDER BY date").all(since),
            topEvents: db.prepare("SELECT e.name, COUNT(g.id) as guests FROM events e LEFT JOIN guests g ON g.event_id = e.id GROUP BY e.id ORDER BY guests DESC LIMIT 10").all(),
            monthly: db.prepare("SELECT strftime('%Y-%m') as month, COUNT(*) as count FROM guests GROUP BY month ORDER BY month LIMIT 12").all()
        };

        if (format === 'csv') {
            var csv = 'Metrica,Valor\n';
            csv += 'Eventos,' + data.system.events + '\nInvitados,' + data.system.guests + '\nCheck-in,' + data.system.checkedIn + '\nUsuarios,' + data.system.users + '\n\nFecha,Registros\n';
            data.trends.forEach(function(t) { csv += t.date + ',' + t.count + '\n'; });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=bi_export.csv');
            res.send(csv);
        } else {
            res.json(data);
        }
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── Trends comparison (C5-03) ───
router.get('/bi/trends', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var compare = req.query.compare ? parseInt(req.query.compare) : 30;
        var current = req.query.period ? parseInt(req.query.period) : 30;
        var now = Date.now();

        var currentPeriod = new Date(now - current * 86400000).toISOString();
        var prevPeriod = new Date(now - (current + compare) * 86400000).toISOString();

        var currentGuests = db.prepare("SELECT COUNT(*) as c FROM guests WHERE created_at >= ?").get(currentPeriod).c;
        var prevGuests = db.prepare("SELECT COUNT(*) as c FROM guests WHERE created_at >= ? AND created_at < ?").get(prevPeriod, currentPeriod).c;
        var currentChecked = db.prepare("SELECT COUNT(*) as c FROM guests WHERE checked_in = 1 AND checkin_time >= ?").get(currentPeriod).c;
        var prevChecked = db.prepare("SELECT COUNT(*) as c FROM guests WHERE checked_in = 1 AND checkin_time >= ? AND checkin_time < ?").get(prevPeriod, currentPeriod).c;

        var calcGrowth = function(curr, prev) { return prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0; };

        res.json({
            current: { guests: currentGuests, checkedIn: currentChecked },
            previous: { guests: prevGuests, checkedIn: prevChecked },
            growth: { guests: calcGrowth(currentGuests, prevGuests), checkedIn: calcGrowth(currentChecked, prevChecked) },
            currentPeriod: current + 'd',
            comparePeriod: compare + 'd'
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── Health dashboard (C5-10) ───
router.get('/health/system', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var dbSize = 0;
        try { var size = db.prepare("PRAGMA page_count").get(); var page = db.prepare("PRAGMA page_size").get(); dbSize = (size?.page_count || 0) * (page?.page_size || 0); } catch(e) {}
        var uptime = process.uptime();
        var mem = process.memoryUsage();
        var eventCount = db.prepare("SELECT COUNT(*) as c FROM events").get().c;
        var guestCount = db.prepare("SELECT COUNT(*) as c FROM guests").get().c;
        var userCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;

        res.json({
            status: 'ok',
            uptime: Math.floor(uptime / 3600) + 'h ' + Math.floor((uptime % 3600) / 60) + 'm',
            uptimeSeconds: uptime,
            database: { sizeBytes: dbSize, sizeMB: Math.round(dbSize / (1024 * 1024) * 100) / 100, events: eventCount, guests: guestCount, users: userCount },
            memory: { rss: Math.round(mem.rss / 1024 / 1024) + 'MB', heap: Math.round(mem.heapUsed / 1024 / 1024) + 'MB' },
            node: process.version,
            platform: process.platform,
            timestamp: new Date().toISOString()
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── Backup (C5-11) ───
router.post('/system/backup', authMiddleware(['ADMIN']), async (req, res) => {
    try {
        var { createBackup } = require('../utils/webhooks');
        var result = await createBackup();
        if (result.success) res.json({ success: true, file: result.file, size: result.size });
        else res.status(500).json({ error: result.error });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;