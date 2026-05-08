const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { getValidId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/security/ai/inventory — Listar sistemas de IA detectados
router.get('/ai/inventory', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const items = db.prepare("SELECT * FROM ai_inventory ORDER BY detected_at DESC").all();
        items.forEach(function(item) {
            try { item.data_processed = JSON.parse(item.data_processed); } catch(e) { item.data_processed = []; }
        });
        res.json(items);
    } catch (err) {
        console.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener inventario' });
    }
});

// POST /api/security/ai/inventory — Agregar sistema de IA al inventario
router.post('/ai/inventory', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { name, type, provider, description, data_processed, risk_level } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO ai_inventory (id, name, type, provider, description, data_processed, risk_level, status, detected_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'detected', ?, ?)").run(
            id, name.trim(), type || 'llm', provider || '', description || '', JSON.stringify(data_processed || []), risk_level || 'medium', now, now
        );
        res.json({ success: true, id });
    } catch (err) {
        console.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al agregar sistema' });
    }
});

// DELETE /api/security/ai/inventory/:id — Eliminar sistema del inventario
router.delete('/ai/inventory/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM ai_inventory WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

// PUT /api/security/ai/inventory/:id — Actualizar estado/riesgo
router.put('/ai/inventory/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { status, risk_level, last_seen_at } = req.body;
        db.prepare("UPDATE ai_inventory SET status = COALESCE(?, status), risk_level = COALESCE(?, risk_level), last_seen_at = COALESCE(?, last_seen_at) WHERE id = ?").run(
            status || null, risk_level || null, last_seen_at || null, req.params.id
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// GET /api/security/ai/policies — Listar politicas de IA
router.get('/ai/policies', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const policies = db.prepare("SELECT * FROM ai_policies ORDER BY created_at DESC").all();
        res.json(policies);
    } catch (err) {
        console.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener politicas' });
    }
});

// POST /api/security/ai/policies — Crear/actualizar politica
router.post('/ai/policies', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { name, description, content } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO ai_policies (id, name, description, content, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, name.trim(), description || '', content || '', now);
        res.json({ success: true, id });
    } catch (err) {
        console.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al crear politica' });
    }
});

// PUT /api/security/ai/policies/:id — Editar politica
router.put('/ai/policies/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { name, description, content, is_active } = req.body;
        const now = new Date().toISOString();
        db.prepare("UPDATE ai_policies SET name = COALESCE(?, name), description = COALESCE(?, description), content = COALESCE(?, content), is_active = COALESCE(?, is_active), updated_at = ? WHERE id = ?").run(
            name || null, description || null, content || null, is_active != null ? (is_active ? 1 : 0) : null, now, req.params.id
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al actualizar politica' });
    }
});

// DELETE /api/security/ai/policies/:id — Eliminar politica
router.delete('/ai/policies/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM ai_policies WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('[AI_SECURITY] Error:', err.message);
        res.status(500).json({ error: 'Error al eliminar politica' });
    }
});

module.exports = router;
