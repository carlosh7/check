/**
 * Rutas de Email (SMTP, IMAP, Templates, Queue)
 */

const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Configuración SMTP
router.get('/smtp-config', authMiddleware(['ADMIN']), (req, res) => {
    const config = db.prepare("SELECT * FROM smtp_config WHERE id = 1").get();
    if (config) delete config.smtp_pass;
    res.json(config);
});

router.put('/smtp-config', authMiddleware(['ADMIN']), (req, res) => {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_name, from_email } = req.body;
    
    const existing = db.prepare("SELECT id FROM smtp_config WHERE id = 1").get();
    if (existing) {
        const updates = [];
        const values = [];
        if (smtp_host !== undefined) { updates.push('smtp_host = ?'); values.push(smtp_host); }
        if (smtp_port !== undefined) { updates.push('smtp_port = ?'); values.push(smtp_port); }
        if (smtp_user !== undefined) { updates.push('smtp_user = ?'); values.push(smtp_user); }
        if (smtp_pass !== undefined && smtp_pass) { updates.push('smtp_pass = ?'); values.push(smtp_pass); }
        if (smtp_secure !== undefined) { updates.push('smtp_secure = ?'); values.push(smtp_secure ? 1 : 0); }
        if (from_name !== undefined) { updates.push('from_name = ?'); values.push(from_name); }
        if (from_email !== undefined) { updates.push('from_email = ?'); values.push(from_email); }
        updates.push('updated_at = ?');
        values.push(new Date().toISOString());
        
        if (values.length > 1) {
            db.prepare(`UPDATE smtp_config SET ${updates.join(', ')} WHERE id = 1`).run(...values);
        }
    } else {
        db.prepare("INSERT INTO smtp_config (id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_name, from_email, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(smtp_host || '', smtp_port || 587, smtp_user || '', smtp_pass || '', smtp_secure ? 1 : 0, from_name || '', from_email || '', new Date().toISOString());
    }
    res.json({ success: true });
});

// Configuración IMAP
router.get('/imap-config', authMiddleware(['ADMIN']), (req, res) => {
    const config = db.prepare("SELECT * FROM imap_config WHERE id = 1").get();
    if (config) delete config.imap_pass;
    res.json(config);
});

router.put('/imap-config', authMiddleware(['ADMIN']), (req, res) => {
    const { imap_host, imap_port, imap_user, imap_pass, imap_tls } = req.body;
    
    const existing = db.prepare("SELECT id FROM imap_config WHERE id = 1").get();
    if (existing) {
        const updates = [];
        const values = [];
        if (imap_host !== undefined) { updates.push('imap_host = ?'); values.push(imap_host); }
        if (imap_port !== undefined) { updates.push('imap_port = ?'); values.push(imap_port); }
        if (imap_user !== undefined) { updates.push('imap_user = ?'); values.push(imap_user); }
        if (imap_pass !== undefined && imap_pass) { updates.push('imap_pass = ?'); values.push(imap_pass); }
        if (imap_tls !== undefined) { updates.push('imap_tls = ?'); values.push(imap_tls ? 1 : 0); }
        updates.push('updated_at = ?');
        values.push(new Date().toISOString());
        
        if (values.length > 1) {
            db.prepare(`UPDATE imap_config SET ${updates.join(', ')} WHERE id = 1`).run(...values);
        }
    } else {
        db.prepare("INSERT INTO imap_config (id, imap_host, imap_port, imap_user, imap_pass, imap_tls, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)")
          .run(imap_host || '', imap_port || 993, imap_user || '', imap_pass || '', imap_tls ? 1 : 0, new Date().toISOString());
    }
    res.json({ success: true });
});

// Probar conexión IMAP
router.post('/imap-test', authMiddleware(['ADMIN']), async (req, res) => {
    res.json({ success: false, error: 'Configurar credenciales en SMTP' });
});

// Templates de email
router.get('/templates', authMiddleware(['ADMIN']), (req, res) => {
    const templates = db.prepare("SELECT * FROM email_templates WHERE event_id IS NULL ORDER BY name").all();
    res.json(templates);
});

router.post('/templates', authMiddleware(['ADMIN']), (req, res) => {
    const { id, name, subject, body, is_active } = req.body;
    const { v4: uuidv4 } = require('uuid');
    const templateId = id || uuidv4();
    
    db.prepare("INSERT OR REPLACE INTO email_templates (id, name, subject, body, is_active, event_id, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?)")
      .run(templateId, name, subject, body, is_active ? 1 : 0, new Date().toISOString());
    
    res.json({ success: true, id: templateId });
});

router.put('/templates/:id', authMiddleware(['ADMIN']), (req, res) => {
    const { name, subject, body, is_active } = req.body;
    db.prepare("UPDATE email_templates SET name = ?, subject = ?, body = ?, is_active = ?, updated_at = ? WHERE id = ?")
      .run(name, subject, body, is_active ? 1 : 0, new Date().toISOString(), req.params.id);
    res.json({ success: true });
});

router.delete('/templates/:id', authMiddleware(['ADMIN']), (req, res) => {
    db.prepare("DELETE FROM email_templates WHERE id = ?").run(req.params.id);
    res.json({ success: true });
});

// Logs de email
router.get('/logs', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const logs = db.prepare("SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 100").all();
    res.json(logs);
});

// Broadcast email
router.post('/broadcast', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const { event_id, subject, body } = req.body;
    const { v4: uuidv4 } = require('uuid');
    
    const guests = db.prepare("SELECT * FROM guests WHERE event_id = ? AND unsubscribed = 0").all(event_id);
    
    for (const guest of guests) {
        db.prepare("INSERT INTO email_queue (id, event_id, guest_id, to_email, subject, body_html, status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')")
          .run(uuidv4(), event_id, guest.id, guest.email, subject, body);
    }
    
    res.json({ success: true, queued: guests.length });
});

// Control de cola
router.post('/queue-control', authMiddleware(['ADMIN']), (req, res) => {
    const { action, event_id } = req.body;
    
    if (action === 'pause') {
        db.prepare("UPDATE email_queue SET status = 'PAUSED' WHERE event_id = ? AND status = 'PENDING'").run(event_id);
    } else if (action === 'resume') {
        db.prepare("UPDATE email_queue SET status = 'PENDING' WHERE event_id = ? AND status = 'PAUSED'").run(event_id);
    } else if (action === 'clear') {
        db.prepare("DELETE FROM email_queue WHERE event_id = ? AND status != 'SENT'").run(event_id);
    }
    
    res.json({ success: true });
});

// Stats de cola
router.get('/queue-stats', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const stats = {
        pending: db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'PENDING'").get().count,
        sent: db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'SENT'").get().count,
        error: db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'ERROR'").get().count
    };
    res.json(stats);
});

module.exports = router;
