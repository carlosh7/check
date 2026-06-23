/**
 * Rutas del Marketplace de Plugins (C11-09)
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { loadPlugin } = require('../engine/plugin-engine');

const router = express.Router();

// ─── Listar todos los plugins disponibles ───

router.get('/', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var plugins = db.prepare("SELECT * FROM plugins ORDER BY is_system DESC, name ASC").all();
        plugins.forEach(function(p) {
            try { p.hooks = JSON.parse(p.hooks); } catch(e) { p.hooks = []; }
            try { p.settings_schema = JSON.parse(p.settings_schema); } catch(e) { p.settings_schema = null; }
        });
        res.json(plugins);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Instalar plugin en un evento ───

router.post('/:pluginId/install', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var plugin = db.prepare("SELECT * FROM plugins WHERE id = ?").get(req.params.pluginId);
        if (!plugin) return res.status(404).json({ error: 'Plugin no encontrado' });
        var { event_id } = req.body;
        if (!event_id) return res.status(400).json({ error: 'event_id requerido' });
        var existing = db.prepare("SELECT id FROM plugin_instances WHERE plugin_id = ? AND event_id = ?").get(req.params.pluginId, event_id);
        if (existing) return res.json({ success: true, alreadyInstalled: true });
        var settings = {};
        if (plugin.settings_schema) {
            try { var schema = JSON.parse(plugin.settings_schema); settings = schema.defaults || {}; } catch(e) {}
        }
        var id = uuidv4();
        db.prepare("INSERT INTO plugin_instances (id, plugin_id, event_id, enabled, settings) VALUES (?, ?, ?, 1, ?)").run(id, req.params.pluginId, event_id, JSON.stringify(settings));
        // Ensure plugin is globally enabled
        if (!plugin.enabled) {
            db.prepare("UPDATE plugins SET enabled = 1 WHERE id = ?").run(req.params.pluginId);
            loadPlugin(plugin);
        }
        res.json({ success: true, alreadyInstalled: false });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Desinstalar plugin de un evento ───

router.post('/:pluginId/uninstall', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { event_id } = req.body;
        db.prepare("DELETE FROM plugin_instances WHERE plugin_id = ? AND event_id = ?").run(req.params.pluginId, event_id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Plugins instalados en un evento ───

router.get('/event/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var instances = db.prepare("SELECT pi.*, p.name, p.description, p.icon, p.version, p.author, p.hooks, p.settings_schema FROM plugin_instances pi JOIN plugins p ON p.id = pi.plugin_id WHERE pi.event_id = ? ORDER BY p.name ASC").all(req.params.eventId);
        instances.forEach(function(i) {
            try { i.hooks = JSON.parse(i.hooks); } catch(e) { i.hooks = []; }
            try { i.settings = JSON.parse(i.settings); } catch(e) { i.settings = {}; }
            try { i.settings_schema = JSON.parse(i.settings_schema); } catch(e) { i.settings_schema = null; }
        });
        res.json(instances);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Actualizar configuración de un plugin ───

router.put('/instance/:instanceId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { enabled, settings } = req.body;
        if (enabled !== undefined) db.prepare("UPDATE plugin_instances SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, req.params.instanceId);
        if (settings !== undefined) db.prepare("UPDATE plugin_instances SET settings = ? WHERE id = ?").run(JSON.stringify(settings), req.params.instanceId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Logs de plugins ───

router.get('/logs/:eventId', authMiddleware(['ADMIN']), (req, res) => {
    try {
        var logs = db.prepare("SELECT pl.*, p.name as plugin_name FROM plugin_logs pl JOIN plugins p ON p.id = pl.plugin_id WHERE pl.event_id = ? ORDER BY pl.logged_at DESC LIMIT 100").all(req.params.eventId);
        res.json(logs);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
