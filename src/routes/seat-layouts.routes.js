const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { getEventDb } = require('../utils/event-db');

const logger = require("../utils/logger");
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
        logger.error('[SEAT_LAYOUTS] Error:', err.message);
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
        logger.error('[SEAT_LAYOUTS] Error:', err.message);
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
        logger.error('[SEAT_LAYOUTS] Error:', err.message);
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
        logger.error('[SEAT_LAYOUTS] Error:', err.message);
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
        logger.error('[SEAT_LAYOUTS] Error:', err.message);
        res.status(500).json({ error: 'Error al renderizar plano' });
    }
});

function generateSeats(cfg) {
    const type = cfg.layoutType || 'auditorium';
    if (type === 'auditorium') return generateAuditorium(cfg);
    if (type === 'herringbone') return generateHerringbone(cfg);
    if (type === 'banquet') return generateBanquet(cfg);
    return [];
}

function generateAuditorium(cfg) {
    const roomW = cfg.roomWidth || 10, roomH = cfg.roomLength || 8;
    const rows = cfg.rows || 5, cols = cfg.cols || 8;
    const aislePos = cfg.aislePos != null ? cfg.aislePos : Math.floor(cols / 2);
    const seatSize = cfg.seatSize || 0.5, gap = cfg.seatGap || 0.1;
    const stagePos = cfg.stagePos || 'front';
    const marginX = 0.5, marginY = 0.8;
    const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const result = [];
    const totalW = (cols - 1) * (seatSize + gap);
    const startX = marginX + (roomW - marginX * 2 - totalW) / 2;
    const usableH = roomH - marginY - 0.6;
    for (let r = 0; r < rows; r++) {
        const label = rowLabels[r] || ('R' + (r + 1));
        let colCount = 0;
        for (let c = 0; c < cols; c++) {
            if (c === aislePos) continue;
            const sx = startX + colCount * (seatSize + gap);
            const sy = (stagePos === 'front') ? (marginY + (rows - 1 - r) * (seatSize + gap)) : (marginY + r * (seatSize + gap));
            result.push({ id: label + (c + 1), row: label, col: c + 1, x: Math.round(sx * 100), y: Math.round(sy * 100), w: Math.round(seatSize * 100), h: Math.round(seatSize * 100), type: 'seat' });
            colCount++;
        }
    }
    return result;
}

function generateHerringbone(cfg) {
    const roomW = cfg.roomWidth || 10, roomH = cfg.roomLength || 8;
    const rows = cfg.rows || 5, cols = cfg.cols || 6;
    const seatSize = cfg.seatSize || 0.5;
    const gap = cfg.seatGap || 0.15;
    const marginX = 0.8, marginY = 0.8;
    const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const angle = cfg.angle || 45;
    const rad = angle * Math.PI / 180;
    const result = [];
    const blockW = (seatSize + gap) * cols;
    const centerX = roomW / 2;
    for (let r = 0; r < rows; r++) {
        const label = rowLabels[r] || ('R' + (r + 1));
        const yPos = marginY + r * (seatSize + gap);
        const xOffset = (r % 2 === 0 ? 0 : (seatSize + gap) * 0.3);
        const dir = (r % 2 === 0 ? 1 : -1);
        const startX = centerX - blockW / 2;
        for (let c = 0; c < cols; c++) {
            const sx = startX + c * (seatSize + gap) + xOffset;
            const sy = yPos;
            if (Math.abs(sx - centerX) < 0.3 && Math.abs(sy - roomH / 2) < 0.5) continue;
            result.push({ id: label + (c + 1), row: label, col: c + 1, x: Math.round(sx * 100), y: Math.round(sy * 100), w: Math.round(seatSize * 100), h: Math.round(seatSize * 100), rotation: dir * angle, type: 'seat' });
        }
    }
    return result;
}

function generateBanquet(cfg) {
    const roomW = cfg.roomWidth || 12, roomH = cfg.roomLength || 10;
    const tableDiam = cfg.tableDiameter || 1.8;
    const chairsPerTable = cfg.chairsPerTable || 8;
    const tableGap = cfg.tableGap || 0.8;
    const marginX = 0.6, marginY = 0.6;
    const result = [];
    const totalW = roomW - marginX * 2;
    const cols = Math.floor((totalW + tableGap) / (tableDiam + tableGap));
    const tablesPerCol = Math.floor((roomH - marginY * 2 + tableGap) / (tableDiam + tableGap));
    const startX = marginX + (totalW - cols * (tableDiam + tableGap) + tableGap) / 2;
    const chairRadius = tableDiam / 2 + 0.2;
    for (let t = 0; t < Math.min(cols * tablesPerCol, 20); t++) {
        const tx = startX + (t % cols) * (tableDiam + tableGap) + tableDiam / 2;
        const ty = marginY + Math.floor(t / cols) * (tableDiam + tableGap) + tableDiam / 2;
        result.push({ id: 'T' + (t + 1), row: 'T' + (t + 1), col: 0, x: Math.round((tx - tableDiam / 2) * 100), y: Math.round((ty - tableDiam / 2) * 100), w: Math.round(tableDiam * 100), h: Math.round(tableDiam * 100), type: 'table' });
        const angleStep = 360 / chairsPerTable;
        for (let ch = 0; ch < chairsPerTable; ch++) {
            const a = ch * angleStep * Math.PI / 180;
            const cx = tx + chairRadius * Math.cos(a);
            const cy = ty + chairRadius * Math.sin(a);
            result.push({ id: 'T' + (t + 1) + '-' + (ch + 1), row: 'T' + (t + 1), col: ch + 1, x: Math.round((cx - 0.2) * 100), y: Math.round((cy - 0.2) * 100), w: 20, h: 20, type: 'seat', tableId: 'T' + (t + 1) });
        }
    }
    return result;
}

module.exports = router;
