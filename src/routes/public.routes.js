/**
 * Rutas públicas de Check Pro
 */

const express = require('express');
const { db } = require('../../database');
const { generateCaptcha, verifyCaptcha } = require('../security/captcha');
const { AuditLog } = require('../security/audit');

const router = express.Router();

router.get('/captcha', (req, res) => {
    const captcha = generateCaptcha();
    res.json({ question: captcha.question, token: captcha.token });
});

router.post('/captcha/verify', (req, res) => {
    const { token, answer } = req.body;
    if (!token || answer === undefined) {
        return res.status(400).json({ valid: false, error: 'Token y respuesta requeridos' });
    }
    const valid = verifyCaptcha(token, answer);
    res.json({ valid });
});

router.get('/unsubscribe/:token', (req, res) => {
    const token = req.params.token;
    const guest = db.prepare("SELECT id, name FROM guests WHERE unsubscribe_token = ?").get(token);

    if (!guest) {
        return res.send('<h1>Enlace no válido</h1><p>No pudimos encontrar tu suscripción.</p>');
    }

    db.prepare("UPDATE guests SET unsubscribed = 1 WHERE id = ?").run(guest.id);

    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>Desuscripción Exitosa</h1>
            <p>Hola ${guest.name}, hemos procesado tu solicitud. No recibirás más correos automáticos.</p>
            <p><small>Si fue un error, contacta con soporte.</small></p>
        </div>
    `);
});

router.get('/audit-logs', (req, res) => {
    const { page = 1, limit = 50, action, user_id } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(200, Math.max(1, parseInt(limit)));

    let where = '1=1';
    let params = [];
    if (action) { where += ' AND action = ?'; params.push(action); }
    if (user_id) { where += ' AND user_id = ?'; params.push(user_id); }

    const total = db.prepare(`SELECT COUNT(*) as count FROM audit_logs WHERE ${where}`).get(...params).count;
    const logs = db.prepare(`SELECT * FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, Math.min(200, parseInt(limit)), offset);

    res.json({ data: logs, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / Math.min(200, parseInt(limit))) } });
});

module.exports = router;
