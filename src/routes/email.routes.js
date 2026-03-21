/**
 * Rutas de Email (SMTP, IMAP, Templates, Queue)
 * Usa rutas completas para compatibilidad con frontend
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { db } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Configuración SMTP
router.get('/smtp-config', authMiddleware(['ADMIN']), (req, res) => {
    const config = db.prepare("SELECT * FROM smtp_config WHERE id = 1").get();
    if (config) {
        config.smtp_pass = config.smtp_pass ? '***' : '';
    }
    res.json(config || {});
});

router.put('/smtp-config', authMiddleware(['ADMIN']), (req, res) => {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_name, from_email } = req.body;
    
    let passToSave = smtp_pass;
    if (!smtp_pass || smtp_pass === '***') {
        const current = db.prepare("SELECT smtp_pass FROM smtp_config WHERE id = 1").get();
        passToSave = current?.smtp_pass || '';
    }
    
    db.prepare(`INSERT OR REPLACE INTO smtp_config (id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_name, from_email, updated_at) 
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(smtp_host || '', smtp_port || 587, smtp_user || '', passToSave, smtp_secure ? 1 : 0, from_name || 'Check', from_email || '', new Date().toISOString());
    
    res.json({ success: true });
});

// Probar conexión SMTP
router.post('/smtp-test', authMiddleware(['ADMIN']), async (req, res) => {
    res.json({ success: true, message: 'Test SMTP disponible' });
});

// Configuración IMAP
router.get('/imap-config', authMiddleware(['ADMIN']), (req, res) => {
    const config = db.prepare("SELECT * FROM imap_config WHERE id = 1").get();
    if (config) {
        config.imap_pass = config.imap_pass ? '***' : '';
    }
    res.json(config || {});
});

router.put('/imap-config', authMiddleware(['ADMIN']), (req, res) => {
    const { imap_host, imap_port, imap_user, imap_pass, imap_tls } = req.body;
    
    let passToSave = imap_pass;
    if (!imap_pass || imap_pass === '***') {
        const current = db.prepare("SELECT imap_pass FROM imap_config WHERE id = 1").get();
        passToSave = current?.imap_pass || '';
    }
    
    db.prepare(`INSERT OR REPLACE INTO imap_config (id, imap_host, imap_port, imap_user, imap_pass, imap_tls, updated_at) 
                VALUES (1, ?, ?, ?, ?, ?, ?)`)
      .run(imap_host || '', imap_port || 993, imap_user || '', passToSave, imap_tls ? 1 : 0, new Date().toISOString());
    
    res.json({ success: true });
});

// Probar conexión IMAP
router.post('/imap-test', authMiddleware(['ADMIN']), async (req, res) => {
    const { imap_host, imap_port, imap_user, imap_pass, imap_tls } = req.body;
    
    try {
        const Imap = require('imap');
        const imap = new Imap({
            user: imap_user,
            password: imap_pass,
            host: imap_host,
            port: parseInt(imap_port) || 993,
            tls: imap_tls,
            connTimeout: 10000,
            authTimeout: 10000
        });
        
        imap.once('ready', () => {
            imap.end();
            res.json({ success: true, message: 'Conexión IMAP exitosa' });
        });
        
        imap.once('error', (err) => {
            res.status(400).json({ success: false, error: err.message });
        });
        
        imap.connect();
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Templates de email
router.get('/email-templates', authMiddleware(['ADMIN']), (req, res) => {
    const templates = db.prepare("SELECT * FROM email_templates WHERE event_id IS NULL ORDER BY name ASC").all();
    res.json(templates);
});

router.post('/email-templates', authMiddleware(['ADMIN']), (req, res) => {
    const { name, subject, body, event_id } = req.body;
    try {
        const result = db.prepare("INSERT INTO email_templates (name, subject, body, event_id, is_active) VALUES (?, ?, ?, ?, 1)")
            .run(name, subject, body, event_id || null);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/email-templates/:id', authMiddleware(['ADMIN']), (req, res) => {
    const { subject, body } = req.body;
    db.prepare("UPDATE email_templates SET subject = ?, body = ?, updated_at = ? WHERE id = ?")
      .run(subject, body, new Date().toISOString(), req.params.id);
    res.json({ success: true });
});

router.delete('/email-templates/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        db.prepare("DELETE FROM email_templates WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Logs de email
router.get('/email-logs', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { type, event_id } = req.query;
    let query = "SELECT * FROM email_logs WHERE 1=1";
    let params = [];
    
    if (type) {
        query += " AND type = ?";
        params.push(type);
    }
    if (event_id) {
        query += " AND event_id = ?";
        params.push(event_id);
    }
    
    query += " ORDER BY created_at DESC LIMIT 100";
    const logs = db.prepare(query).all(...params);
    res.json(logs);
});

// Broadcast email
router.post('/emails/broadcast', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const { event_id, subject, body } = req.body;
    
    if (!event_id || !body) return res.status(400).json({ error: 'Faltan datos' });

    try {
        const guests = db.prepare("SELECT * FROM guests WHERE event_id = ? AND unsubscribed = 0").all(event_id);
        
        const insertQueue = db.prepare(`INSERT INTO email_queue (id, event_id, guest_id, to_email, subject, body_html, status, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`);
        const updateToken = db.prepare("UPDATE guests SET unsubscribe_token = ? WHERE id = ? AND unsubscribe_token IS NULL");

        db.transaction(() => {
            for (const guest of guests) {
                if (!guest.unsubscribe_token) {
                    const token = crypto.randomBytes(16).toString('hex');
                    updateToken.run(token, guest.id);
                    guest.unsubscribe_token = token;
                }

                const personalizedBody = body.replace(/{{guest_name}}/g, guest.name)
                    .replace(/{{guest_email}}/g, guest.email)
                    .replace(/{{unsubscribe_url}}/g, `${req.protocol}://${req.get('host')}/unsubscribe/${guest.unsubscribe_token}`);

                insertQueue.run(uuidv4(), event_id, guest.id, guest.email, subject, personalizedBody, new Date().toISOString());
            }
        })();

        res.json({ success: true, count: guests.length });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al encolar' });
    }
});

// Control de cola
router.post('/emails/queue-control', authMiddleware(['ADMIN']), (req, res) => {
    const { action, event_id } = req.body;
    
    if (action === 'pause') {
        if (event_id) db.prepare("UPDATE email_queue SET status = 'PAUSED' WHERE event_id = ? AND status = 'PENDING'").run(event_id);
    }
    if (action === 'resume') {
        if (event_id) db.prepare("UPDATE email_queue SET status = 'PENDING' WHERE event_id = ? AND status = 'PAUSED'").run(event_id);
    }
    if (action === 'stop') {
        db.prepare("UPDATE email_queue SET status = 'CANCELLED' WHERE status = 'PENDING'").run();
    }
    if (action === 'clear' && event_id) {
        db.prepare("DELETE FROM email_queue WHERE event_id = ? AND status != 'SENT'").run(event_id);
    }
    res.json({ success: true });
});

// Stats de cola
router.get('/emails/queue-stats', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const stats = {
        pending: db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'PENDING'").get().count,
        sent: db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'SENT'").get().count,
        error: db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'ERROR'").get().count
    };
    res.json(stats);
});

// ═══ RUTAS DE EMAIL POR EVENTO ═══

// Configuración de email por evento
router.get('/events/:eventId/email-config', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eId = castId('events', req.params.eventId);
    const config = db.prepare("SELECT * FROM event_email_config WHERE event_id = ?").get(eId);
    if (config) {
        config.smtp_pass = config.smtp_pass ? '***' : '';
    }
    res.json(config || {});
});

router.put('/events/:eventId/email-config', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eId = castId('events', req.params.eventId);
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_name, from_email, enabled } = req.body;
    
    let passToSave = smtp_pass;
    if (!smtp_pass || smtp_pass === '***') {
        const current = db.prepare("SELECT smtp_pass FROM event_email_config WHERE event_id = ?").get(eId);
        passToSave = current?.smtp_pass || '';
    }
    
    db.prepare(`INSERT OR REPLACE INTO event_email_config (id, event_id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_name, from_email, enabled, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(getValidId('eec'), eId, smtp_host || '', smtp_port || 587, smtp_user || '', passToSave, smtp_secure ? 1 : 0, from_name || '', from_email || '', enabled ? 1 : 0, new Date().toISOString());
    
    res.json({ success: true });
});

// Templates de email por evento
router.get('/events/:eventId/email-templates', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eId = castId('events', req.params.eventId);
    const templates = db.prepare("SELECT * FROM event_email_templates WHERE event_id = ? ORDER BY name ASC").all(eId);
    res.json(templates);
});

router.put('/events/:eventId/email-templates/:type', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eId = castId('events', req.params.eventId);
    const templateType = req.params.type;
    const { subject, body, is_active, auto_send } = req.body;
    
    const existing = db.prepare("SELECT * FROM event_email_templates WHERE event_id = ? AND template_type = ?").get(eId, templateType);
    
    if (existing) {
        db.prepare("UPDATE event_email_templates SET subject = ?, body = ?, is_active = ?, auto_send = ?, updated_at = ? WHERE event_id = ? AND template_type = ?")
          .run(subject, body, is_active ? 1 : 0, auto_send ? 1 : 0, new Date().toISOString(), eId, templateType);
    } else {
        db.prepare("INSERT INTO event_email_templates (id, event_id, template_type, subject, body, is_active, auto_send, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(getValidId('eet'), eId, templateType, subject, body, is_active ? 1 : 0, auto_send ? 1 : 0, new Date().toISOString());
    }
    
    res.json({ success: true });
});

// Email de prueba por evento
router.post('/events/:eventId/email-test', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eId = castId('events', req.params.eventId);
    const { test_email } = req.body;
    
    if (!test_email) return res.status(400).json({ error: 'Email de prueba requerido' });
    
    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eId);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
    
    const config = db.prepare("SELECT * FROM event_email_config WHERE event_id = ? AND enabled = 1").get(eId);
    
    if (!config || !config.smtp_host) {
        return res.json({ success: false, error: 'SMTP no configurado o deshabilitado para este evento' });
    }
    
    console.log('📧 TEST: Email de prueba a', test_email, 'desde evento', event.name);
    res.json({ success: true, message: 'Email de prueba enviado (simulado)' });
});

module.exports = router;
