const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ─── SMART TAGGING (C9-04) ───
router.get('/guests/:eventId/tags', authMiddleware(), (req, res) => {
    try {
        const tags = db.prepare("SELECT id, name, color, filter_criteria FROM guest_tags WHERE event_id = ? ORDER BY name ASC").all(req.params.eventId);
        res.json(tags);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/guests/:eventId/tags', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { name, color, filter_criteria } = req.body;
        if (!name) return res.status(400).json({ error: 'Nombre requerido' });
        const id = uuidv4();
        db.prepare("INSERT INTO guest_tags (id, event_id, name, color, filter_criteria, created_at) VALUES (?, ?, ?, ?, ?, ?)")
            .run(id, req.params.eventId, name, color || '#0ba5ec', filter_criteria || null, new Date().toISOString());
        
        // Auto-tag existing guests if filter_criteria provided
        if (filter_criteria) {
            try {
                const criteria = JSON.parse(filter_criteria);
                const where = [];
                const params = [req.params.eventId];
                if (criteria.checked_in !== undefined) { where.push("checked_in = ?"); params.push(criteria.checked_in ? 1 : 0); }
                if (criteria.status) { where.push("status = ?"); params.push(criteria.status); }
                if (criteria.organization) { where.push("organization = ?"); params.push(criteria.organization); }
                if (criteria.created_after) { where.push("created_at >= ?"); params.push(criteria.created_after); }
                if (where.length > 0) {
                    const guests = db.prepare("SELECT id FROM guests WHERE event_id = ? AND " + where.join(" AND ")).all(...params);
                    const insertTag = db.prepare("INSERT OR IGNORE INTO guest_tag_assignments (id, guest_id, tag_id) VALUES (?, ?, ?)");
                    for (const g of guests) insertTag.run(uuidv4(), g.id, id);
                }
            } catch(e) {}
        }
        res.json({ success: true, id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/guests/:eventId/tags/:tagId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM guest_tags WHERE id=?").run(req.params.tagId);
        db.prepare("DELETE FROM guest_tag_assignments WHERE tag_id=?").run(req.params.tagId);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/guests/:eventId/guests/:guestId/tags', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { tag_id } = req.body;
        if (!tag_id) return res.status(400).json({ error: 'tag_id requerido' });
        db.prepare("INSERT OR IGNORE INTO guest_tag_assignments (id, guest_id, tag_id) VALUES (?, ?, ?)").run(uuidv4(), req.params.guestId, tag_id);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/guests/:eventId/guests/:guestId/tags/:tagId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM guest_tag_assignments WHERE guest_id=? AND tag_id=?").run(req.params.guestId, req.params.tagId);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── ATTENDANCE PREDICTION (C9-03) ───
router.get('/predict/:eventId', authMiddleware(), (req, res) => {
    try {
        const eventId = req.params.eventId;
        const event = db.prepare("SELECT date, end_date FROM events WHERE id = ?").get(eventId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        
        const totalGuests = db.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ?").get(eventId);
        const checkedIn = db.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND checked_in = 1").get(eventId);
        const confirmed = db.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND status = 'confirmed'").get(eventId);
        const pastCheckins = db.prepare("SELECT COUNT(*) as c FROM guests WHERE event_id = ? AND checked_in = 1 AND checkin_time IS NOT NULL").get(eventId);
        
        const historicalRate = totalGuests.c > 0 ? checkedIn.c / totalGuests.c : 0.65;
        const confirmationRate = totalGuests.c > 0 ? (confirmed.c + checkedIn.c) / totalGuests.c : 0.7;
        const predictedAttendance = Math.round(totalGuests.c * (historicalRate * 0.6 + confirmationRate * 0.4));
        
        const daysUntilEvent = event.date ? Math.max(1, Math.ceil((new Date(event.date) - Date.now()) / 86400000)) : 1;
        const dailyRate = pastCheckins.c / Math.max(1, daysUntilEvent);
        
        res.json({
            eventId,
            total: totalGuests.c,
            checkedIn: checkedIn.c,
            predictedAttendance,
            confidence: Math.round((historicalRate * 0.5 + confirmationRate * 0.3 + Math.min(totalGuests.c / 100, 1) * 0.2) * 100),
            historicalRate: Math.round(historicalRate * 100),
            confirmationRate: Math.round(confirmationRate * 100),
            estimatedDailyCheckins: Math.round(dailyRate * 10) / 10
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── RECOMMENDATIONS (C9-05) ───
router.get('/recommendations/:eventId', authMiddleware(), (req, res) => {
    try {
        const eventId = req.params.eventId;
        const tickets = db.prepare("SELECT id, name, price FROM guest_categories WHERE event_id = ? ORDER BY price ASC").all(eventId);
        const topOrgs = db.prepare("SELECT organization, COUNT(*) as count FROM guests WHERE event_id = ? AND organization IS NOT NULL AND organization != '' GROUP BY organization ORDER BY count DESC LIMIT 5").all(eventId);
        
        res.json({
            tickets: tickets.map(t => ({
                ...t,
                recommendation: t.price === 0 ? 'Gratuito - Recomendado para maximizar asistencia' : 'Premium - Mayor ingreso por evento'
            })),
            topOrganizations: topOrgs,
            suggestedPrice: tickets.length > 0 ? Math.round(tickets.reduce((s, t) => s + t.price, 0) / tickets.length) : 0
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// ─── WEBHOOK ACTIONS (C9-08) ───
router.post('/webhooks/:id/execute', authMiddleware(['ADMIN']), async (req, res) => {
    try {
        const webhook = db.prepare("SELECT * FROM webhooks WHERE id = ?").get(req.params.id);
        if (!webhook) return res.status(404).json({ error: 'Webhook no encontrado' });
        
        const actions = req.body.actions || [req.body.action || 'trigger'];
        const results = [];
        
        for (const action of actions) {
            try {
                if (action === 'trigger') {
                    const { triggerWebhooks, WEBHOOK_EVENTS } = require('../utils/webhooks');
                    await triggerWebhooks(webhook.events, { triggered_by: 'manual', webhook_id: webhook.id, timestamp: new Date().toISOString() });
                    results.push({ action, status: 'completed' });
                } else if (action === 'test') {
                    const response = await fetch(webhook.url, { method: 'POST', body: JSON.stringify({ test: true, webhook_id: webhook.id }), headers: { 'Content-Type': 'application/json' } });
                    results.push({ action, status: response.ok ? 'completed' : 'failed', statusCode: response.status });
                } else {
                    results.push({ action, status: 'unknown_action' });
                }
            } catch(e) {
                results.push({ action, status: 'error', error: e.message });
            }
        }
        
        res.json({ success: true, results });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
