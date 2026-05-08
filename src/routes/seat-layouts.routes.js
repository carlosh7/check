const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getEventConnection, eventDatabaseExists } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function getEventDb(eventId) {
    const event = db.prepare("SELECT id, has_own_db FROM events WHERE id = ?").get(eventId);
    if (event && event.has_own_db === 1 && eventDatabaseExists(eventId)) {
        return getEventConnection(eventId) || db;
    }
    return db;
}

// GET /api/seat-layouts/:eventId
router.get('/:eventId', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const targetDb = getEventDb(eId);
        const layouts = targetDb.prepare("SELECT id, event_id, name, config, created_at FROM seat_layouts WHERE event_id = ? ORDER BY created_at DESC").all(eId);
        layouts.forEach(function(l) {
            try { l.config = JSON.parse(l.config); } catch(e) { l.config = {}; }
        });
        res.json(layouts);
    } catch (err) {
        console.error('[SEAT_LAYOUTS] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener planos' });
    }
});

// POST /api/seat-layouts/:eventId
router.post('/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID invalido' });
        const { name, config } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
        const id = uuidv4();
        const targetDb = getEventDb(eId);
        targetDb.prepare("INSERT INTO seat_layouts (id, event_id, name, config) VALUES (?, ?, ?, ?)").run(id, eId, name.trim(), JSON.stringify(config || {}));
        res.json({ success: true, id });
    } catch (err) {
        console.error('[SEAT_LAYOUTS] Error:', err.message);
        res.status(500).json({ error: 'Error al crear plano' });
    }
});

// PUT /api/seat-layouts/:eventId/:layoutId
router.put('/:eventId/:layoutId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const lId = req.params.layoutId;
        const { name, config } = req.body;
        const targetDb = getEventDb(eId);
        targetDb.prepare("UPDATE seat_layouts SET name = COALESCE(?, name), config = COALESCE(?, config) WHERE id = ? AND event_id = ?")
            .run(name || null, config ? JSON.stringify(config) : null, lId, eId);
        res.json({ success: true });
    } catch (err) {
        console.error('[SEAT_LAYOUTS] Error:', err.message);
        res.status(500).json({ error: 'Error al actualizar plano' });
    }
});

// DELETE /api/seat-layouts/:eventId/:layoutId
router.delete('/:eventId/:layoutId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const lId = req.params.layoutId;
        const targetDb = getEventDb(eId);
        targetDb.prepare("DELETE FROM seat_layouts WHERE id = ? AND event_id = ?").run(lId, eId);
        res.json({ success: true });
    } catch (err) {
        console.error('[SEAT_LAYOUTS] Error:', err.message);
        res.status(500).json({ error: 'Error al eliminar plano' });
    }
});

// GET /api/seat-layouts/:eventId/:layoutId/render — genera posiciones de asientos
router.get('/:eventId/:layoutId/render', authMiddleware(), (req, res) => {
    try {
        const eId = castId('events', req.params.eventId);
        const lId = req.params.layoutId;
        const targetDb = getEventDb(eId);
        const layout = targetDb.prepare("SELECT * FROM seat_layouts WHERE id = ? AND event_id = ?").get(lId, eId);
        if (!layout) return res.status(404).json({ error: 'Plano no encontrado' });
        const cfg = (typeof layout.config === 'string') ? JSON.parse(layout.config) : layout.config;
        const seats = generateSeats(cfg);
        res.json({ layout: { id: layout.id, name: layout.name, config: cfg }, seats });
    } catch (err) {
        console.error('[SEAT_LAYOUTS] Error:', err.message);
        res.status(500).json({ error: 'Error al renderizar plano' });
    }
});

function generateSeats(cfg) {
    var roomW = cfg.roomWidth || 10;
    var roomH = cfg.roomLength || 8;
    var rows = cfg.rows || 5;
    var cols = cfg.cols || 8;
    var aislePos = cfg.aislePos || Math.floor(cols / 2);
    var seatW = cfg.seatSize || 0.5;
    var seatH = cfg.seatSize || 0.5;
    var gap = cfg.seatGap || 0.1;
    var stagePos = cfg.stagePos || 'front';
    var result = [];
    var rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var marginX = 0.5;
    var marginY = 0.8;
    var usableW = roomW - marginX * 2;
    var availableCols = cols + 1;
    var totalW = availableCols * seatW + (availableCols - 1) * gap;
    var startX = marginX + (usableW - totalW) / 2;
    var startY = marginY;

    for (var r = 0; r < rows; r++) {
        var label = rowLabels[r] || ('R' + (r + 1));
        var colCount = 0;
        for (var c = 0; c < cols; c++) {
            if (c === aislePos) continue;
            var sx = startX + colCount * (seatW + gap);
            var sy = (stagePos === 'front') ? (roomH - marginY - (rows - r) * (seatH + gap)) : (startY + r * (seatH + gap));
            result.push({ id: label + (c + 1), row: label, col: c + 1, x: Math.round(sx * 100), y: Math.round(sy * 100), w: Math.round(seatW * 100), h: Math.round(seatH * 100), type: 'seat' });
            colCount++;
        }
    }
    return result;
}

module.exports = router;
