const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getEventConnection } = require('../../database');
const { getValidId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/compliance/classification — Listar clasificaciones de datos
router.get('/classification', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { table_name } = req.query;
        var sql = "SELECT * FROM data_classification";
        var params = [];
        if (table_name) {
            sql += " WHERE table_name = ?";
            params.push(table_name);
        }
        sql += " ORDER BY table_name, column_name";
        const items = db.prepare(sql).all(...params);
        res.json(items);
    } catch (err) {
        console.error('[COMPLIANCE] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener clasificaciones' });
    }
});

// POST /api/compliance/classification — Agregar clasificación
router.post('/classification', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { table_name, column_name, classification, category, description, is_pii, is_spi } = req.body;
        if (!table_name || !column_name) return res.status(400).json({ error: 'table_name y column_name requeridos' });
        var existing = db.prepare("SELECT id FROM data_classification WHERE table_name = ? AND column_name = ?").get(table_name, column_name);
        if (existing) return res.status(409).json({ error: 'Ya existe clasificación para esa columna' });
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO data_classification (id, table_name, column_name, classification, category, description, is_pii, is_spi, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
            id, table_name, column_name, classification || 'internal', category || 'general', description || '',
            is_pii ? 1 : 0, is_spi ? 1 : 0, now
        );
        res.json({ success: true, id });
    } catch (err) {
        console.error('[COMPLIANCE] Error:', err.message);
        res.status(500).json({ error: 'Error al crear clasificación' });
    }
});

// PUT /api/compliance/classification/:id — Editar clasificación
router.put('/classification/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { classification, category, description, is_pii, is_spi } = req.body;
        const now = new Date().toISOString();
        db.prepare("UPDATE data_classification SET classification = COALESCE(?, classification), category = COALESCE(?, category), description = COALESCE(?, description), is_pii = COALESCE(?, is_pii), is_spi = COALESCE(?, is_spi), updated_at = ? WHERE id = ?").run(
            classification || null, category || null, description || null,
            is_pii != null ? (is_pii ? 1 : 0) : null, is_spi != null ? (is_spi ? 1 : 0) : null,
            now, req.params.id
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[COMPLIANCE] Error:', err.message);
        res.status(500).json({ error: 'Error al actualizar clasificación' });
    }
});

// DELETE /api/compliance/classification/:id — Eliminar clasificación
router.delete('/classification/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        db.prepare("DELETE FROM data_classification WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('[COMPLIANCE] Error:', err.message);
        res.status(500).json({ error: 'Error al eliminar clasificación' });
    }
});

// GET /api/events/:eventId/guests/:guestId/export — Portabilidad de datos (exportar datos del invitado en JSON)
router.get('/events/:eventId/guests/:guestId/export', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const eventDb = getEventConnection(req.params.eventId);
        if (!eventDb) return res.status(404).json({ error: 'Evento no encontrado' });
        const guestId = req.params.guestId;
        const guest = eventDb.prepare("SELECT * FROM guests WHERE id = ?").get(guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });

        var sessions = [];
        try { sessions = eventDb.prepare("SELECT s.name, s.date, s.time FROM session_attendees sa JOIN sessions s ON s.id = sa.session_id WHERE sa.guest_id = ?").all(guestId); } catch(e) {}

        var exportData = {
            exported_at: new Date().toISOString(),
            guest: guest,
            sessions: sessions,
            format: 'GDPR-compliant'
        };

        // Log access
        try {
            const user = req.user || {};
            db.prepare("INSERT INTO data_access_log (id, user_id, user_name, table_name, record_id, action, sensitivity, ip_address, details) VALUES (?, ?, ?, ?, ?, 'export', 'confidential', ?, ?)").run(
                uuidv4(), user.id || 'unknown', user.name || 'unknown', 'guests', guestId,
                req.ip || '', JSON.stringify({ eventId: req.params.eventId })
            );
        } catch(e) {}

        res.json(exportData);
    } catch (err) {
        console.error('[COMPLIANCE] Export error:', err.message);
        res.status(500).json({ error: 'Error al exportar datos' });
    }
});

// DELETE /api/events/:eventId/guests/:guestId/personal-data — Derecho al olvido (anonimizar datos personales)
router.delete('/events/:eventId/guests/:guestId/personal-data', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eventDb = getEventConnection(req.params.eventId);
        if (!eventDb) return res.status(404).json({ error: 'Evento no encontrado' });
        const guestId = req.params.guestId;
        const guest = eventDb.prepare("SELECT * FROM guests WHERE id = ?").get(guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });

        var anonName = 'Anonimizado ' + guestId.substring(0, 8);
        eventDb.prepare("UPDATE guests SET name = ?, email = ?, phone = ?, company = 'Anonimizada', position = '', dietary_restrictions = '', special_needs = '', notes = '[Datos eliminados por solicitud de derecho al olvido]' WHERE id = ?").run(
            anonName, 'anon-' + guestId.substring(0, 8) + '@removed.com', '', guestId
        );

        // Log access
        try {
            const user = req.user || {};
            db.prepare("INSERT INTO data_access_log (id, user_id, user_name, table_name, record_id, action, sensitivity, ip_address, details) VALUES (?, ?, ?, ?, ?, 'erasure', 'confidential', ?, ?)").run(
                uuidv4(), user.id || 'unknown', user.name || 'unknown', 'guests', guestId,
                req.ip || '', JSON.stringify({ eventId: req.params.eventId, anonimized: true })
            );
        } catch(e) {}

        res.json({ success: true, message: 'Datos personales eliminados exitosamente' });
    } catch (err) {
        console.error('[COMPLIANCE] Erasure error:', err.message);
        res.status(500).json({ error: 'Error al eliminar datos personales' });
    }
});

// GET /api/compliance/access-logs — Listar logs de acceso a datos
router.get('/access-logs', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = (page - 1) * limit;
        const action = req.query.action || '';

        var where = '';
        var params = [];
        if (action) {
            where = " WHERE action = ?";
            params.push(action);
        }
        var total = db.prepare("SELECT COUNT(*) as cnt FROM data_access_log" + where).get(...params).cnt;
        var rows = db.prepare("SELECT * FROM data_access_log" + where + " ORDER BY created_at DESC LIMIT ? OFFSET ?").all(...params, limit, offset);
        res.json({ data: rows, pagination: { page, limit, total } });
    } catch (err) {
        console.error('[COMPLIANCE] Access logs error:', err.message);
        res.status(500).json({ error: 'Error al obtener logs de acceso' });
    }
});

module.exports = router;
