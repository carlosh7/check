/**
 * Budget Routes (v12.44.777)
 * CRUD + Charts data + Export CSV + Category summaries
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/events/:eventId/budget — List items with summary
router.get('/events/:eventId/budget', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var items = db.prepare("SELECT * FROM budgets WHERE event_id = ? ORDER BY category ASC, created_at DESC").all(req.params.eventId);
        var total = items.reduce(function(sum, i) { return sum + (parseFloat(i.amount) || 0); }, 0);
        
        // Category breakdown
        var categories = {};
        items.forEach(function(i) {
            var cat = i.category || 'general';
            if (!categories[cat]) categories[cat] = { total: 0, count: 0, items: [] };
            categories[cat].total += parseFloat(i.amount) || 0;
            categories[cat].count++;
        });
        
        res.json({ 
            items: items, 
            total: total, 
            count: items.length,
            categories: categories,
            currency: req.query.currency || 'USD'
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/events/:eventId/budget/stats — Chart data
router.get('/events/:eventId/budget/stats', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var items = db.prepare("SELECT * FROM budgets WHERE event_id = ?").all(req.params.eventId);
        var total = items.reduce(function(sum, i) { return sum + (parseFloat(i.amount) || 0); }, 0);
        
        // Category breakdown for pie chart
        var categoryMap = {};
        items.forEach(function(i) {
            var cat = i.category || 'general';
            categoryMap[cat] = (categoryMap[cat] || 0) + (parseFloat(i.amount) || 0);
        });
        var categoryData = Object.entries(categoryMap).map(function(e) { 
            return { category: e[0], amount: e[1], percentage: total > 0 ? Math.round((e[1] / total) * 100) : 0 }; 
        }).sort(function(a, b) { return b.amount - a.amount; });
        
        // Monthly trend
        var monthlyMap = {};
        items.forEach(function(i) {
            var month = (i.created_at || '').substring(0, 7);
            if (month) {
                monthlyMap[month] = (monthlyMap[month] || 0) + (parseFloat(i.amount) || 0);
            }
        });
        var monthlyTrend = Object.entries(monthlyMap).map(function(e) { return { month: e[0], amount: e[1] }; });
        
        // Top 5 items
        var topItems = items.slice().sort(function(a, b) { return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0); }).slice(0, 5);
        
        res.json({
            total: total,
            count: items.length,
            average: items.length > 0 ? Math.round(total / items.length) : 0,
            categoryBreakdown: categoryData,
            monthlyTrend: monthlyTrend,
            topItems: topItems
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/events/:eventId/budget/export — Export as CSV
router.get('/events/:eventId/budget/export', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var items = db.prepare("SELECT * FROM budgets WHERE event_id = ? ORDER BY category ASC, created_at DESC").all(req.params.eventId);
        var total = items.reduce(function(sum, i) { return sum + (parseFloat(i.amount) || 0); }, 0);
        
        // CSV format
        var csv = 'Concept,Amount,Category,Notes,Created\n';
        items.forEach(function(i) {
            csv += '"' + (i.concept || '').replace(/"/g, '""') + '",' +
                   (parseFloat(i.amount) || 0) + ',' +
                   '"' + (i.category || 'general') + '",' +
                   '"' + (i.notes || '').replace(/"/g, '""') + '",' +
                   '"' + (i.created_at || '') + '"\n';
        });
        csv += '\nTOTAL,' + total + ',,,""\n';
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=budget-' + req.params.eventId + '.csv');
        res.send(csv);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST /api/events/:eventId/budget — Create item
router.post('/events/:eventId/budget', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { concept, amount, category, notes } = req.body;
        if (!concept || amount === undefined) return res.status(400).json({ error: 'Concepto y monto requeridos' });
        var id = uuidv4();
        db.prepare("INSERT INTO budgets (id, event_id, concept, amount, category, notes) VALUES (?, ?, ?, ?, ?, ?)").run(id, req.params.eventId, concept, parseFloat(amount) || 0, category || 'general', notes || '');
        res.json({ success: true, id: id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/events/:eventId/budget/:itemId — Update item
router.put('/events/:eventId/budget/:itemId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { concept, amount, category, notes } = req.body;
        db.prepare("UPDATE budgets SET concept = COALESCE(?, concept), amount = COALESCE(?, amount), category = COALESCE(?, category), notes = COALESCE(?, notes) WHERE id = ? AND event_id = ?").run(
            concept || null, amount !== undefined ? parseFloat(amount) : null, category || null, notes !== undefined ? notes : null, req.params.itemId, req.params.eventId
        );
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/events/:eventId/budget/:itemId — Delete item
router.delete('/events/:eventId/budget/:itemId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM budgets WHERE id = ? AND event_id = ?").run(req.params.itemId, req.params.eventId);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
