/**
 * Rutas de Settings y Admin
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { getValidId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Obtener settings
router.get('/', (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all();
    const dict = {};
    rows.forEach(r => dict[r.setting_key] = r.setting_value);
    res.json(dict);
});

// Actualizar settings
router.put('/', authMiddleware(['ADMIN']), (req, res) => {
    const { key, value } = req.body;

    if (key && value !== undefined) {
        db.prepare("INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)").run(key, value);
    }

    res.json({ success: true });
});

// Legal texts (policy/terms)
router.put('/legal', authMiddleware(['ADMIN']), (req, res) => {
    const { type, content } = req.body;
    const key = type === 'policy' ? 'legal_policy' : 'legal_terms';

    if (type && content !== undefined) {
        db.prepare("INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)").run(key, content);
    }

    res.json({ success: true });
});

router.get('/legal', (req, res) => {
    const rows = db.prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('legal_policy', 'legal_terms')").all();
    const dict = {};
    rows.forEach(r => dict[r.setting_key] = r.setting_value);
    res.json(dict);
});

// Admin: purge database (DANGEROUS)
router.post('/purge', authMiddleware(['ADMIN']), (req, res) => {
    console.warn(`[ADMIN] PURGE requested by user: ${req.userId}`);

    try {
        // Disable foreign keys temporarily
        db.prepare("PRAGMA foreign_keys = OFF").run();

        // Delete in correct order to avoid FK violations
        const tables = ['email_logs', 'email_queue', 'campaigns', 'survey_responses', 'survey_questions',
                       'agenda_items', 'guests', 'pre_registrations', 'user_events', 'group_users',
                       'events', 'groups', 'users', 'audit_logs', 'settings'];

        for (const table of tables) {
            db.prepare(`DELETE FROM ${table}`).run();
        }

        // Re-enable foreign keys
        db.prepare("PRAGMA foreign_keys = ON").run();

        console.warn(`[ADMIN] Database purged by user: ${req.userId}`);
        res.json({ success: true, message: 'Base de datos limpiada' });
    } catch (e) {
        db.prepare("PRAGMA foreign_keys = ON").run();
        console.error('[ADMIN] Purge failed:', e);
        res.status(500).json({ error: 'Error al purgar la base de datos' });
    }
});

// Admin: approve user (temporal fix for status issues)
router.post('/approve-user', authMiddleware(['ADMIN']), (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId requerido' });

    try {
        db.prepare("UPDATE users SET status = 'APPROVED' WHERE id = ?").run(userId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin: approve ALL pending users
router.post('/approve-all-users', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const result = db.prepare("UPDATE users SET status = 'APPROVED' WHERE status != 'APPROVED'").run();
        res.json({ success: true, updated: result.changes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
