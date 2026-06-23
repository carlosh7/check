const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { getEventDb } = require('../utils/event-db');

const router = express.Router();

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
    var type = cfg.layoutType || 'auditorium';
    if (type === 'auditorium') return generateAuditorium(cfg);
    if (type === 'herringbone') return generateHerringbone(cfg);
    if (type === 'banquet') return generateBanquet(cfg);
    return [];
}

function generateAuditorium(cfg) {
    var roomW = cfg.roomWidth || 10, roomH = cfg.roomLength || 8;
    var rows = cfg.rows || 5, cols = cfg.cols || 8;
    var aislePos = cfg.aislePos != null ? cfg.aislePos : Math.floor(cols / 2);
    var seatSize = cfg.seatSize || 0.5, gap = cfg.seatGap || 0.1;
    var stagePos = cfg.stagePos || 'front';
    var marginX = 0.5, marginY = 0.8;
    var rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var result = [];
    var totalW = (cols - 1) * (seatSize + gap);
    var startX = marginX + (roomW - marginX * 2 - totalW) / 2;
    var usableH = roomH - marginY - 0.6;
    for (var r = 0; r < rows; r++) {
        var label = rowLabels[r] || ('R' + (r + 1));
        var colCount = 0;
        for (var c = 0; c < cols; c++) {
            if (c === aislePos) continue;
            var sx = startX + colCount * (seatSize + gap);
            var sy = (stagePos === 'front') ? (marginY + (rows - 1 - r) * (seatSize + gap)) : (marginY + r * (seatSize + gap));
            result.push({ id: label + (c + 1), row: label, col: c + 1, x: Math.round(sx * 100), y: Math.round(sy * 100), w: Math.round(seatSize * 100), h: Math.round(seatSize * 100), type: 'seat' });
            colCount++;
        }
    }
    return result;
}

function generateHerringbone(cfg) {
    var roomW = cfg.roomWidth || 10, roomH = cfg.roomLength || 8;
    var rows = cfg.rows || 5, cols = cfg.cols || 6;
    var seatSize = cfg.seatSize || 0.5;
    var gap = cfg.seatGap || 0.15;
    var marginX = 0.8, marginY = 0.8;
    var rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var angle = cfg.angle || 45;
    var rad = angle * Math.PI / 180;
    var result = [];
    var blockW = (seatSize + gap) * cols;
    var centerX = roomW / 2;
    for (var r = 0; r < rows; r++) {
        var label = rowLabels[r] || ('R' + (r + 1));
        var yPos = marginY + r * (seatSize + gap);
        var xOffset = (r % 2 === 0 ? 0 : (seatSize + gap) * 0.3);
        var dir = (r % 2 === 0 ? 1 : -1);
        var startX = centerX - blockW / 2;
        for (var c = 0; c < cols; c++) {
            var sx = startX + c * (seatSize + gap) + xOffset;
            var sy = yPos;
            if (Math.abs(sx - centerX) < 0.3 && Math.abs(sy - roomH / 2) < 0.5) continue;
            result.push({ id: label + (c + 1), row: label, col: c + 1, x: Math.round(sx * 100), y: Math.round(sy * 100), w: Math.round(seatSize * 100), h: Math.round(seatSize * 100), rotation: dir * angle, type: 'seat' });
        }
    }
    return result;
}

function generateBanquet(cfg) {
    var roomW = cfg.roomWidth || 12, roomH = cfg.roomLength || 10;
    var tableDiam = cfg.tableDiameter || 1.8;
    var chairsPerTable = cfg.chairsPerTable || 8;
    var tableGap = cfg.tableGap || 0.8;
    var marginX = 0.6, marginY = 0.6;
    var result = [];
    var totalW = roomW - marginX * 2;
    var cols = Math.floor((totalW + tableGap) / (tableDiam + tableGap));
    var tablesPerCol = Math.floor((roomH - marginY * 2 + tableGap) / (tableDiam + tableGap));
    var startX = marginX + (totalW - cols * (tableDiam + tableGap) + tableGap) / 2;
    var chairRadius = tableDiam / 2 + 0.2;
    for (var t = 0; t < Math.min(cols * tablesPerCol, 20); t++) {
        var tx = startX + (t % cols) * (tableDiam + tableGap) + tableDiam / 2;
        var ty = marginY + Math.floor(t / cols) * (tableDiam + tableGap) + tableDiam / 2;
        result.push({ id: 'T' + (t + 1), row: 'T' + (t + 1), col: 0, x: Math.round((tx - tableDiam / 2) * 100), y: Math.round((ty - tableDiam / 2) * 100), w: Math.round(tableDiam * 100), h: Math.round(tableDiam * 100), type: 'table' });
        var angleStep = 360 / chairsPerTable;
        for (var ch = 0; ch < chairsPerTable; ch++) {
            var a = ch * angleStep * Math.PI / 180;
            var cx = tx + chairRadius * Math.cos(a);
            var cy = ty + chairRadius * Math.sin(a);
            result.push({ id: 'T' + (t + 1) + '-' + (ch + 1), row: 'T' + (t + 1), col: ch + 1, x: Math.round((cx - 0.2) * 100), y: Math.round((cy - 0.2) * 100), w: 20, h: 20, type: 'seat', tableId: 'T' + (t + 1) });
        }
    }
    return result;
}

module.exports = router;
