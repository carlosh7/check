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
const { schemas, validate } = require('../security/validation');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');

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

// Probar conexión SMTP (Real)
router.post('/smtp-test', authMiddleware(['ADMIN']), async (req, res) => {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure } = req.body;
    
    if (!smtp_host || !smtp_user) {
        return res.status(400).json({ success: false, error: 'Faltan datos SMTP' });
    }
    
    try {
        const nodemailer = require('nodemailer');
        
        const transporter = nodemailer.createTransport({
            host: smtp_host,
            port: parseInt(smtp_port) || 587,
            secure: smtp_secure === true || smtp_secure === 1,
            auth: {
                user: smtp_user,
                pass: smtp_pass
            },
            connectionTimeout: 10000
        });
        
        await transporter.verify();
        res.json({ success: true, message: 'Conexión SMTP exitosa' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
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

// Logs de email (con paginación)
router.get('/email-logs', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { type, event_id } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    let params = [];

    if (type) {
        whereClause += " AND type = ?";
        params.push(type);
    }
    if (event_id) {
        whereClause += " AND event_id = ?";
        params.push(castId('events', event_id));
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM email_logs WHERE ${whereClause}`).get(...params).count;
    const logs = db.prepare(`SELECT * FROM email_logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    res.json({
        data: logs,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
});

// Sincronización IMAP (Real)
router.get('/imap/sync', authMiddleware(['ADMIN']), async (req, res) => {
    const config = db.prepare("SELECT * FROM imap_config WHERE id = 1").get();
    
    if (!config || !config.imap_host || !config.imap_user) {
        return res.status(400).json({ success: false, error: 'IMAP no configurado' });
    }
    
    try {
        const Imap = require('imap');
        const { simpleParser } = require('mailparser');
        
        const imap = new Imap({
            user: config.imap_user,
            password: config.imap_pass,
            host: config.imap_host,
            port: parseInt(config.imap_port) || 993,
            tls: config.imap_tls === 1,
            connTimeout: 30000,
            authTimeout: 30000
        });
        
        let newEmailsCount = 0;
        
        await new Promise((resolve, reject) => {
            imap.once('ready', () => {
                imap.openBox('INBOX', true, (err, box) => {
                    if (err) { imap.end(); return reject(err); }
                    
                    if (box.messages.total === 0) {
                        imap.end();
                        return resolve(0);
                    }
                    
                    // Buscar los últimos 15 mensajes
                    const start = Math.max(1, box.messages.total - 14);
                    const f = imap.seq.fetch(`${start}:*`, { bodies: '' });
                    
                    f.on('message', (msg, seqno) => {
                        let buffer = '';
                        msg.on('body', (stream) => {
                            stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
                        });
                        msg.once('end', async () => {
                            try {
                                const parsed = await simpleParser(buffer);
                                const mId = parsed.messageId || `imap-${seqno}-${Date.now()}`;
                                
                                // Verificar duplicados
                                const exists = db.prepare("SELECT id FROM email_logs WHERE message_id = ?").get(mId);
                                if (!exists) {
                                    db.prepare(`INSERT INTO email_logs (id, type, subject, from_email, to_email, body_html, message_id, created_at, is_read) 
                                                VALUES (?, 'INBOX', ?, ?, ?, ?, ?, ?, 0)`).run(
                                        uuidv4(),
                                        parsed.subject || '(Sin Asunto)',
                                        parsed.from?.text || '',
                                        config.imap_user,
                                        parsed.html || parsed.textAsHtml || parsed.text || '',
                                        mId,
                                        parsed.date ? parsed.date.toISOString() : new Date().toISOString()
                                    );
                                    newEmailsCount++;
                                }
                            } catch (e) { console.error('[IMAP] Error parsing:', e.message); }
                        });
                    });
                    
                    f.once('error', (err) => { imap.end(); reject(err); });
                    f.once('end', () => {
                        imap.end();
                        console.log(`[IMAP] Sincronización completada. Nuevos: ${newEmailsCount}`);
                        resolve(newEmailsCount);
                    });
                });
            });
            
            imap.once('error', (err) => reject(err));
            imap.connect();
        });
        
        res.json({ success: true, count: newEmailsCount });
    } catch (e) {
        console.error('[IMAP] Sync error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Alias para envío masivo (v12.8.0)
router.post('/send-mass', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const { templateId, recipients, eventId, scheduledAt } = req.body;
    try {
        const batchId = uuidv4();
        const insertQueue = db.prepare(`INSERT INTO email_queue (id, event_id, to_email, subject, body_html, status, scheduled_at) VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`);
        
        const template = db.prepare("SELECT * FROM email_templates WHERE id = ?").get(templateId);
        if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });

        const startTime = scheduledAt || new Date().toISOString();

        db.transaction(() => {
            for (const r of recipients) {
                const body = template.body
                    .replace(/{{nombre}}/g, r.name || '')
                    .replace(/{{name}}/g, r.name || '')
                    .replace(/{{empresa}}/g, r.organization || '')
                    .replace(/{{ciudad}}/g, r.city || '')
                    .replace(/{{email}}/g, r.email || '');
                insertQueue.run(uuidv4(), castId('events', eventId), r.email, template.subject, body, startTime);
            }
        })();

        res.json({ success: true, batchId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Control de cola (REST Style v12.8.0)
router.post('/email-queue/:action', authMiddleware(['ADMIN']), (req, res) => {
    const { action } = req.params;
    const { event_id } = req.body;
    
    if (action === 'pause') {
        db.prepare("UPDATE email_queue SET status = 'PAUSED' WHERE status = 'PENDING'").run();
    }
    if (action === 'resume') {
        db.prepare("UPDATE email_queue SET status = 'PENDING' WHERE status = 'PAUSED'").run();
    }
    if (action === 'stop') {
        db.prepare("UPDATE email_queue SET status = 'CANCELLED' WHERE status IN ('PENDING', 'PAUSED')").run();
    }
    res.json({ success: true });
});

// Stats de cola (v12.8.0)
router.get('/email-queue/stats', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const stats = {
        total: db.prepare("SELECT COUNT(*) as count FROM email_queue").get().count,
        pending: db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'PENDING'").get().count,
        sent: db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'SENT'").get().count,
        errors: db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'ERROR'").get().count,
        status: db.prepare("SELECT status FROM email_queue WHERE status = 'PAUSED' LIMIT 1").get() ? 'PAUSED' : 'RUNNING'
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

// ═══ CAMPAIGN MANAGEMENT ═══

// Listar campañas
router.get('/campaigns', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { event_id, status } = req.query;
    
    let whereClause = '1=1';
    let params = [];
    
    if (event_id) {
        whereClause += ' AND event_id = ?';
        params.push(castId('events', event_id));
    }
    if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
    }
    
    const campaigns = db.prepare(`
        SELECT c.*, e.name as event_name, t.name as template_name
        FROM email_campaigns c
        LEFT JOIN events e ON c.event_id = e.id
        LEFT JOIN email_templates t ON c.template_id = t.id
        WHERE ${whereClause}
        ORDER BY c.created_at DESC
    `).all(...params);
    
    res.json(campaigns);
});

// Crear campaña
router.post('/campaigns', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { name, event_id, template_id, subject, body_html, filters, scheduled_at } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    
    const campaignId = getValidId('cmp');
    const now = new Date().toISOString();
    
    // Contar destinatarios según filtros
    let recipientCount = 0;
    let guests = [];
    
    if (event_id) {
        const eId = castId('events', event_id);
        let query = 'SELECT * FROM guests WHERE event_id = ?';
        let queryParams = [eId];
        
        if (filters) {
            const f = typeof filters === 'string' ? JSON.parse(filters) : filters;
            if (f.organizations?.length > 0) {
                query += ' AND organization IN (' + f.organizations.map(() => '?').join(',') + ')';
                queryParams.push(...f.organizations);
            }
            if (f.gender) {
                query += ' AND gender = ?';
                queryParams.push(f.gender);
            }
            if (f.checked_in !== null && f.checked_in !== undefined) {
                query += ' AND checked_in = ?';
                queryParams.push(f.checked_in ? 1 : 0);
            }
            if (f.search) {
                query += ' AND (name LIKE ? OR email LIKE ?)';
                queryParams.push(`%${f.search}%`, `%${f.search}%`);
            }
        }
        
        guests = db.prepare(query).all(...queryParams);
        recipientCount = guests.length;
    }
    
    db.prepare(`INSERT INTO email_campaigns 
        (id, name, event_id, template_id, subject, body_html, filters, status, total_recipients, scheduled_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?)`)
        .run(campaignId, name, event_id || null, template_id || null, subject || '', body_html || '', filters || '{}', recipientCount, scheduled_at || null, now, now);
    
    // Crear logs de destinatarios
    const insertLog = db.prepare(`INSERT INTO email_campaign_logs (id, campaign_id, guest_id, to_email, status) VALUES (?, ?, ?, ?, 'PENDING')`);
    for (const g of guests) {
        insertLog.run(getValidId('cml'), campaignId, g.id, g.email);
    }
    
    res.json({ success: true, id: campaignId, recipients: recipientCount });
});

// Obtener campaña específica
router.get('/campaigns/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const campaign = db.prepare(`
        SELECT c.*, e.name as event_name, t.name as template_name
        FROM email_campaigns c
        LEFT JOIN events e ON c.event_id = e.id
        LEFT JOIN email_templates t ON c.template_id = t.id
        WHERE c.id = ?
    `).get(req.params.id);
    
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });
    
    // Obtener logs recientes
    const logs = db.prepare(`SELECT * FROM email_campaign_logs WHERE campaign_id = ? ORDER BY sent_at DESC LIMIT 50`).all(req.params.id);
    
    res.json({ ...campaign, logs });
});

// Actualizar campaña
router.put('/campaigns/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { name, subject, body_html, filters, status } = req.body;
    
    const existing = db.prepare('SELECT * FROM email_campaigns WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Campaña no encontrada' });
    
    // Solo permitir edición si está en DRAFT
    if (existing.status !== 'DRAFT' && existing.status !== 'PAUSED') {
        return res.status(400).json({ error: 'No se puede editar una campaña en ejecución' });
    }
    
    db.prepare(`UPDATE email_campaigns SET name = ?, subject = ?, body_html = ?, filters = ?, updated_at = ? WHERE id = ?`)
        .run(name || existing.name, subject || existing.subject, body_html || existing.body_html, filters || existing.filters, new Date().toISOString(), req.params.id);
    
    res.json({ success: true });
});

// Iniciar campaña
router.post('/campaigns/:id/start', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const campaign = db.prepare('SELECT * FROM email_campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });
    
    if (campaign.status === 'RUNNING') {
        return res.status(400).json({ error: 'La campaña ya está en ejecución' });
    }
    
    // Obtener SMTP config
    const smtp = db.prepare('SELECT * FROM smtp_config WHERE id = 1').get();
    if (!smtp || !smtp.smtp_host) {
        return res.status(400).json({ error: 'SMTP no configurado' });
    }
    
    // Actualizar estado
    db.prepare(`UPDATE email_campaigns SET status = 'RUNNING', started_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), req.params.id);
    
    // Encolar emails pendientes
    const pendingLogs = db.prepare(`SELECT * FROM email_campaign_logs WHERE campaign_id = ? AND status = 'PENDING' LIMIT 100`).all(req.params.id);
    
    for (const log of pendingLogs) {
        db.prepare(`INSERT INTO email_queue (id, event_id, guest_id, to_email, subject, body_html, status, scheduled_at)
            VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`)
            .run(getValidId('eq'), campaign.event_id, log.guest_id, log.to_email, campaign.subject, campaign.body_html, new Date().toISOString());
    }
    
    res.json({ success: true, queued: pendingLogs.length });
});

// Pausar campaña
router.post('/campaigns/:id/pause', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    db.prepare(`UPDATE email_campaigns SET status = 'PAUSED', updated_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), req.params.id);
    db.prepare(`UPDATE email_queue SET status = 'PAUSED' WHERE event_id = (SELECT event_id FROM email_campaigns WHERE id = ?) AND status = 'PENDING'`)
        .run(req.params.id);
    res.json({ success: true });
});

// Reanudar campaña
router.post('/campaigns/:id/resume', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    db.prepare(`UPDATE email_campaigns SET status = 'RUNNING', updated_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), req.params.id);
    db.prepare(`UPDATE email_queue SET status = 'PENDING' WHERE event_id = (SELECT event_id FROM email_campaigns WHERE id = ?) AND status = 'PAUSED'`)
        .run(req.params.id);
    res.json({ success: true });
});

// Cancelar campaña
router.post('/campaigns/:id/cancel', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    db.prepare(`UPDATE email_campaigns SET status = 'CANCELLED', completed_at = ?, updated_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), new Date().toISOString(), req.params.id);
    res.json({ success: true });
});

// Eliminar campaña
router.delete('/campaigns/:id', authMiddleware(['ADMIN']), (req, res) => {
    db.prepare('DELETE FROM email_campaign_logs WHERE campaign_id = ?').run(req.params.id);
    db.prepare('DELETE FROM email_campaigns WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// Reporte de campaña
router.get('/campaigns/:id/report', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const campaign = db.prepare('SELECT * FROM email_campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });
    
    const stats = {
        total: campaign.total_recipients,
        sent: db.prepare('SELECT COUNT(*) as count FROM email_campaign_logs WHERE campaign_id = ? AND status = ?').get(req.params.id, 'SENT').count,
        errors: db.prepare('SELECT COUNT(*) as count FROM email_campaign_logs WHERE campaign_id = ? AND status = ?').get(req.params.id, 'ERROR').count,
        pending: db.prepare('SELECT COUNT(*) as count FROM email_campaign_logs WHERE campaign_id = ? AND status = ?').get(req.params.id, 'PENDING').count,
        bounced: db.prepare('SELECT COUNT(*) as count FROM email_campaign_logs WHERE campaign_id = ? AND status = ?').get(req.params.id, 'BOUNCED').count
    };
    
    // Métricas de tracking
    let trackingStats = { opens: { total: 0, unique: 0, percentage: 0 }, clicks: { total: 0, unique: 0, percentage: 0 } };
    try {
        const { getCampaignTrackingStats } = require('../utils/emailTracker');
        trackingStats = getCampaignTrackingStats(req.params.id);
    } catch (e) {
        console.error('[REPORT] Error getting tracking:', e.message);
    }
    
    // Últimos errores
    const recentErrors = db.prepare(`SELECT * FROM email_campaign_logs WHERE campaign_id = ? AND status = 'ERROR' ORDER BY sent_at DESC LIMIT 10`).all(req.params.id);
    
    // Emails más abiertos
    const topOpened = db.prepare(`
        SELECT to_email, COUNT(*) as opens 
        FROM email_tracking_opens 
        WHERE campaign_id = ?
        GROUP BY to_email 
        ORDER BY opens DESC 
        LIMIT 10
    `).all(req.params.id);
    
    // URLs más clickeadas
    const topClicked = db.prepare(`
        SELECT original_url, COUNT(*) as clicks 
        FROM email_tracking_clicks 
        WHERE campaign_id = ?
        GROUP BY original_url 
        ORDER BY clicks DESC 
        LIMIT 10
    `).all(req.params.id);
    
    res.json({ 
        campaign, 
        stats, 
        tracking: trackingStats,
        recentErrors,
        topOpened,
        topClicked
    });
});

// Enviar email de prueba
router.post('/send-test', authMiddleware(['ADMIN']), async (req, res) => {
    const { to_email, subject, body_html } = req.body;
    
    if (!to_email || !subject) {
        return res.status(400).json({ success: false, error: 'Email y asunto requeridos' });
    }
    
    try {
        const nodemailer = require('nodemailer');
        const config = db.prepare("SELECT * FROM smtp_config WHERE id = 1").get();
        
        if (!config || !config.smtp_host) {
            return res.status(400).json({ success: false, error: 'SMTP no configurado' });
        }
        
        const transporter = nodemailer.createTransport({
            host: config.smtp_host,
            port: config.smtp_port || 587,
            secure: config.smtp_secure === 1,
            auth: {
                user: config.smtp_user,
                pass: config.smtp_pass
            }
        });
        
        // Procesar con tracking
        const { processEmailForTracking } = require('../utils/emailTracker');
        const processed = processEmailForTracking(body_html || '<p>Test email</p>', {
            campaignId: 'test',
            toEmail: to_email
        });
        
        await transporter.sendMail({
            from: `"${config.from_name || 'Check Pro'}" <${config.from_email || config.smtp_user}>`,
            to: to_email,
            subject: `[TEST] ${subject}`,
            html: processed.html
        });
        
        res.json({ success: true, message: 'Email de prueba enviado' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
