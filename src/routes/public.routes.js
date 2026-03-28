/**
 * Rutas públicas de Check Pro
 */

const express = require('express');
const { db } = require('../../database');
const { generateCaptcha, verifyCaptcha } = require('../security/captcha');
const { AuditLog } = require('../security/audit');

const router = express.Router();
const { castId } = require('../utils/helpers');

// Obtener detalles públicos de un evento para registro
router.get('/event/:id', (req, res) => {
    const id = castId('events', req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID de evento no válido' });

    const event = db.prepare(`SELECT id, name, date, end_date, location, description, 
                                     reg_title, reg_welcome_text, reg_success_message, reg_show_phone, 
                                     reg_show_org, reg_show_position, reg_show_vegan, reg_show_dietary, 
                                     reg_show_gender, reg_require_agreement, reg_policy, reg_logo_url,
                                     reg_email_whitelist, reg_email_blacklist
                              FROM events WHERE id = ?`).get(id);

    if (!event) return res.status(404).json({ success: false, error: 'Evento no encontrado' });
    res.json(event);
});

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

// Registro público de invitados
router.post('/public-register', async (req, res) => {
    const { event_id, name, email, phone, organization, position, gender, dietary_notes } = req.body;
    
    if (!event_id || !name || !email) {
        return res.status(400).json({ success: false, error: 'Datos requeridos: event_id, name, email' });
    }
    
    try {
        const { getValidId, castId } = require('../utils/helpers');
        const { v4: uuidv4 } = require('uuid');
        
        const eId = castId('events', event_id);
        if (!eId) {
            return res.status(400).json({ success: false, error: 'Evento no válido' });
        }
        
        const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eId);
        if (!event) {
            return res.status(404).json({ success: false, error: 'Evento no encontrado' });
        }
        
        // Verificar whitelist/blacklist de emails
        if (event.reg_email_whitelist) {
            const whitelist = event.reg_email_whitelist.split(',').map(e => e.trim().toLowerCase());
            if (!whitelist.some(domain => email.endsWith('@' + domain))) {
                return res.status(400).json({ success: false, error: 'Email no permitido para este evento' });
            }
        }
        
        if (event.reg_email_blacklist) {
            const blacklist = event.reg_email_blacklist.split(',').map(e => e.trim().toLowerCase());
            if (blacklist.some(domain => email.endsWith('@' + domain))) {
                return res.status(400).json({ success: false, error: 'Email bloqueado para este evento' });
            }
        }
        
        // Verificar si ya existe el invitado
        const existing = db.prepare("SELECT id FROM guests WHERE event_id = ? AND (email = ? OR phone = ?)").get(eId, email, phone || '');
        if (existing) {
            return res.status(400).json({ success: false, error: 'Ya estás registrado en este evento' });
        }
        
        const guestId = getValidId('guests');
        const qrToken = uuidv4();
        
        db.prepare(`INSERT INTO guests (id, event_id, name, email, phone, organization, position, gender, dietary_notes, qr_token, is_new_registration, checked_in)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`)
          .run(guestId, eId, name, email, phone || '', organization || '', position || '', gender || 'O', dietary_notes || '', qrToken);
        
        res.json({ success: true, message: 'Registro exitoso', guestId, qrToken });
    } catch (err) {
        console.error('[public-register] Error:', err.message);
        res.status(500).json({ success: false, error: 'Error al procesar registro' });
    }
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

// ═══ EMAIL TRACKING ROUTES (Públicas) ═══

// Tracking de apertura (pixel 1x1 transparente)
router.get('/track/open/:messageId', (req, res) => {
    const { messageId } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    
    console.log('[TRACK] Open tracked:', messageId);
    
    // Registrar apertura
    try {
        const { registerOpen } = require('../utils/emailTracker');
        registerOpen(messageId, ipAddress, userAgent);
    } catch (e) {
        console.error('[TRACK] Error registering open:', e.message);
    }
    
    // Devolver pixel transparente GIF
    const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
    );
    
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.send(pixel);
});

// Tracking de clicks
router.get('/track/click', (req, res) => {
    const { url, campaign, email, msg } = req.query;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    
    if (!url) {
        return res.status(400).send('URL requerida');
    }
    
    console.log('[TRACK] Click tracked:', { url, campaign, email });
    
    // Registrar click
    try {
        const { registerClick } = require('../utils/emailTracker');
        registerClick(url, campaign, email, msg, ipAddress, userAgent);
    } catch (e) {
        console.error('[TRACK] Error registering click:', e.message);
    }
    
    // Redireccionar a la URL original
    res.redirect(url);
});

module.exports = router;
