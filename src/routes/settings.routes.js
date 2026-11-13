/**
 * Rutas de Settings y Admin
 */

const express = require('express');
const { z } = require('zod');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const logger = require("../utils/logger");
const router = express.Router();

const updateLegalSchema = z.object({
    type: z.enum(['policy', 'terms'], { errorMap: () => ({ message: 'type debe ser "policy" o "terms"' }) }),
    content: z.string().min(1, 'Contenido requerido')
});

const purgeSchema = z.object({
    confirm: z.literal('PURGE', { errorMap: () => ({ message: 'confirm debe ser "PURGE" para eliminar todos los datos' }) })
});

// Obtener settings
// v12.44.838 (auditoría SEC): GET / devolvía TODAS las claves en claro, incluidos
// secretos de terceros (openrouter, google_client_secret, twitter/linkedin tokens).
// Lista blanca: solo claves no secretas salen; los secretos se gestionan por sus
// propias rutas que ya los cifran/mascaran.
const SECRET_SETTING_KEYS = new Set([
    'ai_openrouter_key', 'google_client_secret', 'twitter_token', 'twitter_token_secret',
    'linkedin_token', 'wa_access_token', 'vapid_private_key', 'smtp_password',
    'imap_password', 'stripe_secret_key', 'paypal_secret'
]);
router.get('/', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const rows = db.prepare("SELECT * FROM settings").all();
        const dict = {};
        rows.forEach(r => {
            if (SECRET_SETTING_KEYS.has(r.setting_key)) {
                dict[r.setting_key] = r.setting_value ? '***configurado***' : '';
            } else {
                dict[r.setting_key] = r.setting_value;
            }
        });
        res.json(dict);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Actualizar settings
router.put('/', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { key, value } = req.body;
        if (key && value !== undefined) {
            db.prepare("INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)").run(key, value);
        }
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Legal texts (policy/terms)
router.put('/legal', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const result = updateLegalSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`) });
        }
        const { type, content } = result.data;
        const key = type === 'policy' ? 'legal_policy' : 'legal_terms';
        db.prepare("INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)").run(key, content);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/legal', (req, res) => {
    try {
        const rows = db.prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('legal_policy', 'legal_terms')").all();
        const dict = {};
        rows.forEach(r => dict[r.setting_key] = r.setting_value);
        res.json(dict);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Admin: purge database (DANGEROUS)
router.post('/purge', authMiddleware(['ADMIN']), (req, res) => {
    const result = purgeSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`) });
    }

    logger.warn(`[ADMIN] PURGE requested by user: ${req.userId}`);

    try {
        // Disable foreign keys temporarily
        db.prepare("PRAGMA foreign_keys = OFF").run();

        // Delete in correct order to avoid FK violations
        const tables = ['survey_responses', 'survey_questions',
                       'event_agenda', 'guests', 'pre_registrations', 'user_events', 'group_users',
                       'events', 'groups', 'users', 'audit_logs', 'settings'];

        for (const table of tables) {
            db.prepare(`DELETE FROM ${table}`).run();
        }

        // Re-enable foreign keys
        db.prepare("PRAGMA foreign_keys = ON").run();

        logger.warn(`[ADMIN] Database purged by user: ${req.userId}`);
        res.json({ success: true, message: 'Base de datos limpiada' });
    } catch (e) {
        db.prepare("PRAGMA foreign_keys = ON").run();
        logger.error('[ADMIN] Purge failed:', e);
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
