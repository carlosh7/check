// server.js — Check Elite Pro V11.6.1 (Cleaning & Architecture Update)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { db, createEventEmailTemplates } = require('./database');
const multer = require('multer');
const ExcelJS = require('exceljs');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const imap = require('imap');
const { simpleParser } = require('mailparser');
const crypto = require('crypto');

// --- VERSIÓN DINÁMICA V10.3 ---
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const APP_VERSION = pkg.version;
let tempImport = {};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const port = 3000;

// --- ID COMPATIBILITY WRAPPER (V10.4.3) ---
const getValidId = (tableName) => {
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const idCol = info.find(c => c.name === 'id');
        return (idCol && idCol.type === 'INTEGER') ? null : uuidv4();
    } catch(e) { return uuidv4(); }
};

const castId = (tableName, id) => {
    if (id === null || id === undefined) return id;
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const idCol = info.find(c => c.name === 'id');
        if (idCol && idCol.type === 'INTEGER' && !isNaN(id)) return parseInt(id, 10);
        return id;
    } catch(e) { return id; }
};

// --- EMAIL SERVICE V10.6 ---
async function getSMTPConfig() {
    return db.prepare("SELECT * FROM smtp_config WHERE id = 1").get();
}

async function getEmailTemplate(templateId) {
    return db.prepare("SELECT * FROM email_templates WHERE id = ?").get(templateId);
}

function replaceTemplateVariables(template, data) {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return result;
}

async function sendEmail(to, subject, html, options = {}) {
    try {
        const config = await getSMTPConfig();
        
        // Registrar en logs (independientemente de si es simulado o real)
        const logId = uuidv4();
        db.prepare(`INSERT INTO email_logs (id, event_id, type, subject, from_email, to_email, body_html, message_id, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            logId, 
            options.eventId || null, 
            'SENT', 
            subject, 
            config ? (config.from_email || config.smtp_user) : 'system@check.com', 
            to, 
            html,
            null, // El message_id real vendrá del transportista si es exitoso
            new Date().toISOString()
        );

        if (!config || !config.smtp_host || !config.smtp_user) {
            console.log('📧 Email simulation (no SMTP configured):', { to, subject });
            return { success: true, simulated: true, logId };
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
        
        const mailOptions = {
            from: `"${config.from_name || 'Check'}" <${config.from_email || config.smtp_user}>`,
            to,
            subject,
            html
        };
        
        const result = await transporter.sendMail(mailOptions);
        console.log('📧 Email sent:', { to, subject, messageId: result.messageId });
        
        // Actualizar message_id en el log
        if (result.messageId) {
            db.prepare("UPDATE email_logs SET message_id = ? WHERE id = ?").run(result.messageId, logId);
        }

        return { success: true, messageId: result.messageId, logId };
    } catch (error) {
        console.error('📧 Email error:', error.message);
        return { success: false, error: error.message };
    }
}

// ═══ MOTOR DE COLAS (QUEUE ENGINE) V11.0 ═══
let isQueuePaused = false;

async function processEmailQueue() {
    if (isQueuePaused) return;

    // Buscar el siguiente correo pendiente
    const nextMail = db.prepare(`SELECT * FROM email_queue WHERE status = 'PENDING' ORDER BY scheduled_at ASC LIMIT 1`).get();

    if (!nextMail) return;

    // Cambiar estado a SENDING para evitar duplicados
    db.prepare("UPDATE email_queue SET status = 'SENDING' WHERE id = ?").run(nextMail.id);

    // Verificar si el invitado se ha desuscrito
    if (nextMail.guest_id) {
        const guest = db.prepare("SELECT unsubscribed FROM guests WHERE id = ?").get(nextMail.guest_id);
        if (guest && guest.unsubscribed === 1) {
            db.prepare("UPDATE email_queue SET status = 'CANCELLED', last_error = 'User unsubscribed' WHERE id = ?").run(nextMail.id);
            return;
        }
    }

    // Enviar el email
    const result = await sendEmail(nextMail.to_email, nextMail.subject, nextMail.body_html, { eventId: nextMail.event_id });

    if (result.success) {
        db.prepare("UPDATE email_queue SET status = 'SENT', processed_at = ? WHERE id = ?").run(new Date().toISOString(), nextMail.id);
        // Notificar por socket el progreso
        io.emit('email_queue_progress', { eventId: nextMail.event_id });
    } else {
        const attempts = (nextMail.attempts || 0) + 1;
        const newStatus = attempts >= 3 ? 'ERROR' : 'PENDING';
        db.prepare("UPDATE email_queue SET status = ?, attempts = ?, last_error = ? WHERE id = ?").run(newStatus, attempts, result.error, nextMail.id);
    }
}

// Procesar cola cada 5 segundos para no saturar el SMTP
setInterval(processEmailQueue, 5000);

// ═══ SINCRONIZACIÓN IMAP V12.0 ═══
async function syncEmails() {
    console.log('[IMAP] Iniciando sincronización...');
    const config = db.prepare("SELECT * FROM imap_config WHERE id = 1").get();
    if (!config || !config.imap_host || !config.imap_user) {
        return { success: false, error: 'IMAP no configurado' };
    }

    return new Promise((resolve, reject) => {
        const imapConn = new imap({
            user: config.imap_user,
            password: config.imap_pass,
            host: config.imap_host,
            port: config.imap_port || 993,
            tls: config.imap_tls === 1,
            tlsOptions: { rejectUnauthorized: true }
        });

        let newEmailsCount = 0;

        imapConn.once('ready', () => {
            imapConn.openBox('INBOX', true, (err, box) => {
                if (err) { imapConn.end(); return reject(err); }
                
                if (box.messages.total === 0) {
                    imapConn.end();
                    return resolve({ success: true, newEmails: 0 });
                }

                // Buscar los últimos 15 mensajes
                const start = Math.max(1, box.messages.total - 14);
                const f = imapConn.seq.fetch(`${start}:*`, { bodies: '' });
                
                f.on('message', (msg, seqno) => {
                    let buffer = '';
                    msg.on('body', (stream) => {
                        stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
                    });
                    msg.once('end', async () => {
                        try {
                            const parsed = await simpleParser(buffer);
                            const mId = parsed.messageId || `imap-${seqno}-${Date.now()}`;
                            
                            // Verificar duplicados contra message_id
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
                        } catch (e) { console.error('[IMAP] Error parsing email:', e.message); }
                    });
                });

                f.once('error', (err) => { imapConn.end(); reject(err); });
                f.once('end', () => {
                    imapConn.end();
                    console.log(`[IMAP] Sincronización finalizada. Nuevos: ${newEmailsCount}`);
                    resolve({ success: true, newEmails: newEmailsCount });
                });
            });
        });

        imapConn.once('error', (err) => { 
            console.error('[IMAP] Connection Error:', err.message);
            reject(err); 
        });
        imapConn.connect();
    });
}

async function sendUserApprovedEmail(user) {
    const template = await getEmailTemplate('user_approved');
    if (!template) return { success: false, error: 'Template not found' };
    
    const password = options?.password || user.temp_password || 'Tu contraseña actual';
    
    const subject = replaceTemplateVariables(template.subject, {
        user_name: user.display_name || user.username
    });
    
    const html = replaceTemplateVariables(template.body, {
        user_name: user.display_name || user.username,
        email: user.username,
        password: password,
        role: user.role,
        login_url: `http://localhost:3000/`
    });
    
    return sendEmail(user.username, subject, html);
}

async function sendUserInvitedEmail(user, companyName = '') {
    const template = await getEmailTemplate('user_invited');
    if (!template) return { success: false, error: 'Template not found' };
    
    const subject = replaceTemplateVariables(template.subject, {
        user_name: user.display_name || user.username,
        company_name: companyName
    });
    
    const html = replaceTemplateVariables(template.body, {
        user_name: user.display_name || user.username,
        company_name: companyName,
        role: user.role,
        login_url: `http://localhost:3000/`
    });
    
    return sendEmail(user.username, subject, html);
}

async function sendPasswordResetEmail(user, resetCode) {
    const template = await getEmailTemplate('password_reset');
    if (!template) return { success: false, error: 'Template not found' };
    
    const subject = replaceTemplateVariables(template.subject, {
        user_name: user.display_name || user.username
    });
    
    const html = replaceTemplateVariables(template.body, {
        user_name: user.display_name || user.username,
        reset_code: resetCode,
        reset_url: `http://localhost:3000/?reset=${resetCode}`
    });
    
    return sendEmail(user.username, subject, html);
}

// --- EMAIL POR EVENTO ---
async function getEventEmailConfig(eventId) {
    return db.prepare("SELECT * FROM event_email_config WHERE event_id = ? AND enabled = 1").get(eventId);
}

async function getEventEmailTemplate(eventId, templateType) {
    return db.prepare("SELECT * FROM event_email_templates WHERE event_id = ? AND template_type = ? AND is_active = 1").get(eventId, templateType);
}

async function getEventAgenda(eventId) {
    const agenda = db.prepare("SELECT * FROM event_agenda WHERE event_id = ? ORDER BY sort_order, start_time").all(eventId);
    return agenda.map(item => {
        let time = '';
        if (item.start_time) {
            time = item.start_time;
            if (item.end_time) time += ` - ${item.end_time}`;
        }
        return `<p><strong>${time} ${item.title}</strong>${item.speaker ? ` - ${item.speaker}` : ''}${item.location ? ` @ ${item.location}` : ''}</p>`;
    }).join('');
}

async function sendEventEmail(eventId, to, templateType, data = {}) {
    try {
        const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
        if (!event) return { success: false, error: 'Evento no encontrado' };
        
        const config = await getEventEmailConfig(eventId);
        
        // Si no hay config de evento, usar SMTP global
        let transporter, fromConfig;
        if (config && config.smtp_host) {
            transporter = nodemailer.createTransport({
                host: config.smtp_host,
                port: config.smtp_port || 587,
                secure: config.smtp_secure === 1,
                auth: {
                    user: config.smtp_user,
                    pass: config.smtp_pass
                }
            });
            fromConfig = {
                name: config.from_name || event.name,
                email: config.from_email || config.smtp_user
            };
        } else {
            // Fallback a SMTP global
            const globalConfig = await getSMTPConfig();
            if (!globalConfig || !globalConfig.smtp_host) {
                console.log('📧 Event email simulation (no SMTP):', { eventId, to, templateType });
                return { success: true, simulated: true };
            }
            transporter = nodemailer.createTransport({
                host: globalConfig.smtp_host,
                port: globalConfig.smtp_port || 587,
                secure: globalConfig.smtp_secure === 1,
                auth: {
                    user: globalConfig.smtp_user,
                    pass: globalConfig.smtp_pass
                }
            });
            fromConfig = {
                name: globalConfig.from_name || 'Check',
                email: globalConfig.from_email || globalConfig.smtp_user
            };
        }
        
        // Obtener plantilla
        const template = await getEventEmailTemplate(eventId, templateType);
        if (!template) {
            console.log('📧 Event email skipped (no template):', { eventId, to, templateType });
            return { success: false, error: 'Plantilla no encontrada o inactiva' };
        }
        
        // Preparar variables
        const variables = {
            guest_name: data.guest_name || '',
            guest_email: data.email || to,
            event_name: event.name,
            event_date: event.date ? new Date(event.date).toLocaleString('es-ES') : '',
            event_location: event.location || '',
            organization: data.organization || '',
            checkin_time: data.checkin_time || new Date().toLocaleString('es-ES'),
            agenda: data.agenda || await getEventAgenda(eventId),
            suggestion_url: `${req?.headers?.origin || 'http://localhost:3000'}/suggest.html?event=${eventId}${data.guest_id ? '&guest=' + data.guest_id : ''}`
        };
        
        // Reemplazar variables
        let subject = template.subject;
        let html = template.body;
        for (const [key, value] of Object.entries(variables)) {
            subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
            html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        
        const mailOptions = {
            from: `"${fromConfig.name}" <${fromConfig.email}>`,
            to,
            subject,
            html
        };
        
        const result = await transporter.sendMail(mailOptions);
        console.log('📧 Event email sent:', { eventId, to, templateType, messageId: result.messageId });
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('📧 Event email error:', error.message);
        return { success: false, error: error.message };
    }
}

// Función wrapper para enviar emails automáticos (sin access a req)
global.sendEventEmailAuto = async function(eventId, to, templateType, data = {}) {
    return sendEventEmail(eventId, to, templateType, data);
};

// --- SECURITY MIDDLEWARE ---
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json()); // Nativo en Express 5 — body-parser ya no es necesario

// --- RATE LIMITING ---
app.set('trust proxy', 1);
const skipLocal = (req) => req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';
const apiLimiter = rateLimit({ windowMs: 15*60*1000, max: 2000, skip: skipLocal, message: { error: 'Demasiadas peticiones.' } });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 50, skip: skipLocal, message: { error: 'Demasiados intentos.' } });
app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);

// --- STATIC FILES ---
app.use(express.static(path.join(__dirname, '/'), {
    maxAge: 0,
    setHeaders: (res, reqPath) => {
        // No cachear HTML, JS ni CSS para desarrollo
        if (reqPath.endsWith('.html') || reqPath.endsWith('.js') || reqPath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
        }
    }
}));

// --- ROOT ROUTE (siempre sin caché) ---
app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const upload = multer({ dest: 'uploads/' });

// --- ENRUTAMIENTO SPA (V9) ---
app.get('/:eventName/registro', (req, res) => {
    res.sendFile(path.join(__dirname, 'registro.html'));
});

// ─────────────────────────────────────────────────────────────
// MIDDLEWARE DE AUTH — better-sqlite3: síncrono
// ─────────────────────────────────────────────────────────────
const authMiddleware = (roles = []) => {
    return (req, res, next) => {
        let userId = req.headers['x-user-id'] || req.query['x-user-id'];
        if (!userId) return res.status(401).json({ error: 'No autorizado' });
        userId = castId('users', userId); // ASEGURAR TIPO DE DATO
        const row = db.prepare("SELECT role, status FROM users WHERE id = ?").get(userId);
        if (!row) return res.status(401).json({ error: 'Usuario inexistente' });
        if (row.status !== 'APPROVED') return res.status(403).json({ error: 'Cuenta pendiente de aprobación' });
        if (roles.length > 0 && !roles.includes(row.role)) return res.status(403).json({ error: 'Acceso denegado' });
        req.userId = userId; // Inyectar ID casteado
        req.userRole = row.role;
        req.userGroupId = row.group_id;
        next();
    };
};

// ═══ FUNCIONES HELPER PARA PERMISOS JERÁRQUICOS V10.5 ═══

// Obtener grupos que administra un PRODUCTOR
const getProducerGroups = (userId) => {
    const groupUsers = db.prepare("SELECT group_id FROM group_users WHERE user_id = ?").all(userId);
    return groupUsers.map(g => g.group_id);
};

// Obtener eventos a los que tiene acceso un usuario (por grupo o asignados)
const getUserEventIds = (userId, role) => {
    if (role === 'ADMIN') {
        const all = db.prepare("SELECT id FROM events").all();
        return all.map(e => e.id);
    }
    
    const userGroups = db.prepare("SELECT group_id FROM group_users WHERE user_id = ?").all(userId);
    const groupIds = userGroups.map(g => g.group_id);
    
    let eventIds = [];
    if (groupIds.length > 0) {
        const placeholders = groupIds.map(() => '?').join(',');
        const eventsByGroup = db.prepare(`SELECT id FROM events WHERE group_id IN (${placeholders})`).all(...groupIds);
        eventIds = eventsByGroup.map(e => e.id);
    }
    
    const userEvents = db.prepare("SELECT event_id FROM user_events WHERE user_id = ?").all(userId);
    const assignedIds = userEvents.map(e => e.event_id);
    
    return [...new Set([...eventIds, ...assignedIds])];
};

// Verificar si usuario tiene acceso a un evento específico
const hasEventAccess = (userId, eventId, role) => {
    if (role === 'ADMIN') return true;
    
    const event = db.prepare("SELECT group_id FROM events WHERE id = ?").get(eventId);
    if (!event) return false;
    
    if (event.group_id) {
        const inGroup = db.prepare("SELECT 1 FROM group_users WHERE user_id = ? AND group_id = ?").get(userId, event.group_id);
        if (inGroup) return true;
    }
    
    const assigned = db.prepare("SELECT 1 FROM user_events WHERE user_id = ? AND event_id = ?").get(userId, eventId);
    return !!assigned;
};

// ═══ AUTH ENDPOINTS
// ─────────────────────────────────────────────────────────────
app.post('/api/signup', (req, res) => {
    const { username, password, role } = req.body;
    const id = getValidId('users');
    const status = (role === 'ADMIN') ? 'APPROVED' : 'PENDING';
    try {
        db.prepare("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(id, username, password, role || 'PRODUCTOR', status, new Date().toISOString());
        res.json({ success: true, userId: id, status });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const row = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
    if (row && row.status === 'APPROVED') {
        res.json({ success: true, userId: row.id, role: row.role, username: row.username });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales inválidas o cuenta no aprobada' });
    }
});

// ─────────────────────────────────────────────────────────────
// GOVERNANCE V10 — USUARIOS
// ─────────────────────────────────────────────────────────────
app.get('/api/users', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    // ADMIN y PRODUCTOR ven usuarios (PRODUCTOR ve solo los de su grupo)
    let rows;
    if (req.userRole === 'ADMIN') {
        rows = db.prepare("SELECT id, username, display_name, phone, role, role_detail, status, created_at, group_id FROM users ORDER BY display_name || username ASC").all();
    } else {
        // PRODUCTOR ve solo usuarios de sus grupos
        const groupIds = getProducerGroups(req.userId);
        if (groupIds.length === 0) {
            rows = [];
        } else {
            const placeholders = groupIds.map(() => '?').join(',');
            rows = db.prepare(`SELECT id, username, display_name, phone, role, role_detail, status, created_at, group_id FROM users WHERE group_id IN (${placeholders}) ORDER BY display_name || username ASC`).all(...groupIds);
        }
    }
    
    // Agregar nombre del grupo y eventos asignados a cada usuario
    const usersWithDetails = rows.map(u => {
        const group = u.group_id ? db.prepare("SELECT name FROM groups WHERE id = ?").get(u.group_id) : null;
        const events = db.prepare("SELECT event_id FROM user_events WHERE user_id = ?").all(u.id);
        return {
            ...u,
            group_name: group?.name || null,
            events: events.map(e => e.event_id)
        };
    });
    
    res.json(usersWithDetails);
});

// ═══ ENDPOINTS DE GRUPOS V10.5 ═══

// Ver grupos (ADMIN ve todos, PRODUCTOR ve los suyos)
app.get('/api/groups', authMiddleware(), (req, res) => {
    const userId = req.userId;
    const role = req.userRole;
    
    let rows;
    if (role === 'ADMIN') {
        rows = db.prepare("SELECT * FROM groups ORDER BY created_at DESC").all();
    } else {
        // PRODUCTOR ve solo sus grupos
        const groupIds = getProducerGroups(userId);
        if (groupIds.length === 0) {
            rows = [];
        } else {
            const placeholders = groupIds.map(() => '?').join(',');
            rows = db.prepare(`SELECT * FROM groups WHERE id IN (${placeholders}) ORDER BY created_at DESC`).all(...groupIds);
        }
    }
    res.json(rows);
});

// Crear grupo (solo ADMIN)
app.post('/api/groups', authMiddleware(['ADMIN']), (req, res) => {
    const { name, description, email, phone } = req.body;
    const id = getValidId('groups');
    const created_by = req.userId;
    
    db.prepare("INSERT INTO groups (id, name, description, email, phone, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, name, description || '', email || '', phone || '', 'ACTIVE', new Date().toISOString(), created_by);
    
    res.json({ success: true, groupId: id });
});

// Actualizar grupo
app.put('/api/groups/:id', authMiddleware(['ADMIN']), (req, res) => {
    const { name, description, email, phone, status } = req.body;
    const groupId = castId('groups', req.params.id);
    
    db.prepare("UPDATE groups SET name = ?, description = ?, email = ?, phone = ?, status = ? WHERE id = ?")
      .run(name, description || '', email || '', phone || '', status || 'ACTIVE', groupId);
    
    res.json({ success: true });
});

// Obtener usuarios de un grupo
app.get('/api/groups/:groupId/users', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const groupId = castId('groups', req.params.groupId);
    
    // Verificar acceso
    if (req.userRole === 'PRODUCTOR') {
        const hasAccess = db.prepare("SELECT 1 FROM group_users WHERE user_id = ? AND group_id = ?").get(req.userId, groupId);
        if (!hasAccess) return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }
    
    const users = db.prepare(`
        SELECT u.id, u.username, u.display_name, u.role, u.status, gu.role_in_group
        FROM users u
        LEFT JOIN group_users gu ON u.id = gu.user_id AND gu.group_id = ?
        WHERE gu.group_id = ?
        ORDER BY u.display_name || u.username
    `).all(groupId, groupId);
    
    res.json(users);
});

// Agregar usuario a grupo
app.post('/api/groups/:groupId/users', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { userId, role_in_group } = req.body;
    const groupId = castId('groups', req.params.groupId);
    
    // Verificar que el PRODUCTOR tenga acceso al grupo
    if (req.userRole === 'PRODUCTOR') {
        const hasAccess = db.prepare("SELECT 1 FROM group_users WHERE user_id = ? AND group_id = ?").get(req.userId, groupId);
        if (!hasAccess) return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }
    
    const id = getValidId('group_users');
    db.prepare("INSERT OR REPLACE INTO group_users (id, group_id, user_id, role_in_group, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, groupId, userId, role_in_group || 'PRODUCTOR', new Date().toISOString());
    
    res.json({ success: true });
});

// Quitar usuario de grupo
app.delete('/api/groups/:groupId/users/:userId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const groupId = castId('groups', req.params.groupId);
    const userId = castId('users', req.params.userId);
    
    if (req.userRole === 'PRODUCTOR') {
        const hasAccess = db.prepare("SELECT 1 FROM group_users WHERE user_id = ? AND group_id = ?").get(req.userId, groupId);
        if (!hasAccess) return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }
    
    db.prepare("DELETE FROM group_users WHERE group_id = ? AND user_id = ?").run(groupId, userId);
    res.json({ success: true });
});

// Asignar usuario a evento
app.post('/api/events/:eventId/users', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { userId } = req.body;
    const eventId = castId('events', req.params.eventId);
    
    // Verificar acceso al evento
    if (!hasEventAccess(req.userId, eventId, req.userRole)) {
        return res.status(403).json({ error: 'No tienes acceso a este evento' });
    }
    
    const id = getValidId('user_events');
    db.prepare("INSERT OR IGNORE INTO user_events (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)")
      .run(id, userId, eventId, new Date().toISOString());
    
    res.json({ success: true });
});

app.post('/api/users/invite', authMiddleware(['ADMIN']), (req, res) => {
    const { username, password, role, display_name, phone, group_id, send_email = true } = req.body;
    const id = getValidId('users');
    
    // Obtener nombre de empresa si se asigna
    let companyName = '';
    if (group_id) {
        const group = db.prepare("SELECT name FROM groups WHERE id = ?").get(group_id);
        companyName = group?.name || '';
    }
    
    try {
        db.prepare("INSERT INTO users (id, username, password, role, display_name, phone, group_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)")
          .run(id, username.toLowerCase(), password, role || 'PRODUCTOR', display_name || username, phone || '', group_id || null, new Date().toISOString());
        
        const newUser = { 
            id, 
            username: username.toLowerCase(), 
            password, 
            role: role || 'PRODUCTOR', 
            display_name: display_name || username 
        };
        
        // Enviar email de invitación
        if (send_email) {
            sendUserInvitedEmail(newUser, companyName).catch(err => {
                console.error('Error sending invitation email:', err);
            });
        }
        
        res.json({ success: true, userId: id });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ success: false, error: 'Este email ya está registrado' });
        res.status(400).json({ success: false, error: 'Error al crear usuario' });
    }
});

app.put('/api/users/:id/role', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('users', req.params.id);
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(req.body.role, targetId);
    res.json({ success: true });
});

// Asignar usuario a grupo
app.put('/api/users/:id/group', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('users', req.params.id);
    const { group_id } = req.body;
    db.prepare("UPDATE users SET group_id = ? WHERE id = ?").run(group_id || null, targetId);
    res.json({ success: true });
});

// Asignar usuario a eventos (reemplaza todas las asignaciones)
app.put('/api/users/:id/events', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const targetId = castId('users', req.params.id);
    const { events } = req.body;
    
    // Verificar que PRODUCTOR solo asigne a usuarios de su grupo
    if (req.userRole === 'PRODUCTOR') {
        const userGroups = getProducerGroups(req.userId);
        const user = db.prepare("SELECT group_id FROM users WHERE id = ?").get(targetId);
        if (!user || !user.group_id || !userGroups.includes(user.group_id)) {
            return res.status(403).json({ error: 'No tienes acceso a este usuario' });
        }
    }
    
    // Eliminar asignaciones actuales
    db.prepare("DELETE FROM user_events WHERE user_id = ?").run(targetId);
    
    // Insertar nuevas asignaciones
    if (events && events.length > 0) {
        const insert = db.prepare("INSERT INTO user_events (id, user_id, event_id, created_at) VALUES (?, ?, ?, ?)");
        events.forEach(eventId => {
            insert.run(getValidId('user_events'), targetId, eventId, new Date().toISOString());
        });
    }
    
    res.json({ success: true });
});

// Quitar un evento específico de un usuario
app.delete('/api/users/:id/events/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const targetId = castId('users', req.params.id);
    const eventId = castId('events', req.params.eventId);
    
    if (req.userRole === 'PRODUCTOR') {
        const userGroups = getProducerGroups(req.userId);
        const user = db.prepare("SELECT group_id FROM users WHERE id = ?").get(targetId);
        if (!user || !user.group_id || !userGroups.includes(user.group_id)) {
            return res.status(403).json({ error: 'No tienes acceso a este usuario' });
        }
    }
    
    db.prepare("DELETE FROM user_events WHERE user_id = ? AND event_id = ?").run(targetId, eventId);
    res.json({ success: true });
});

app.put('/api/users/:id/status', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('users', req.params.id);
    const newStatus = req.body.status;
    
    // Obtener datos del usuario antes de actualizar
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(newStatus, targetId);
    
    // Si se aprueba, enviar email de bienvenida
    if (newStatus === 'APPROVED') {
        // Generar contraseña temporal si no tiene
        if (!user.password || user.password.length === 0) {
            const tempPassword = Math.random().toString(36).slice(-8);
            db.prepare("UPDATE users SET password = ? WHERE id = ?").run(tempPassword, targetId);
            user.temp_password = tempPassword;
        }
        
        // Enviar email en background (no bloquear respuesta)
        sendUserApprovedEmail({ ...user, temp_password: user.temp_password }).catch(err => {
            console.error('Error sending approval email:', err);
        });
    }
    
    res.json({ success: true });
});

app.put('/api/users/:id/password', authMiddleware(), (req, res) => {
    const targetId = castId('users', req.params.id);
    const requesterId = req.userId; // YA CASTEADO
    if (req.userRole !== 'ADMIN' && requesterId !== targetId) return res.status(403).json({ error: 'Acceso Denegado' });
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(req.body.password, targetId);
    res.json({ success: true });
});

// Actualizar perfil de usuario
app.put('/api/users/:id/profile', authMiddleware(), (req, res) => {
    const targetId = castId('users', req.params.id);
    const requesterId = req.userId;
    
    // Solo el propio usuario o admin puede actualizar
    if (req.userRole !== 'ADMIN' && requesterId !== targetId) {
        return res.status(403).json({ error: 'Acceso Denegado' });
    }
    
    const { display_name, phone, group_id } = req.body;
    
    // Users can only update their own profile, admins can update group_id
    if (req.userRole === 'ADMIN') {
        db.prepare("UPDATE users SET display_name = ?, phone = ?, group_id = ? WHERE id = ?")
          .run(display_name || '', phone || '', group_id || null, targetId);
    } else {
        db.prepare("UPDATE users SET display_name = ?, phone = ? WHERE id = ?")
          .run(display_name || '', phone || '', targetId);
    }
    
    // Return updated user data
    const user = db.prepare("SELECT id, username, display_name, role, group_id, phone, status FROM users WHERE id = ?").get(targetId);
    res.json({ success: true, user });
});

// Solicitar recuperación de contraseña
app.post('/api/password-reset-request', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });
    
    const user = db.prepare("SELECT id, username, display_name FROM users WHERE username = ?").get(email.toLowerCase());
    if (!user) {
        // No revelar si el email existe o no
        return res.json({ success: true, message: 'Si el email existe, recibirás un enlace de recuperación.' });
    }
    
    // Generar código de recuperación (6 dígitos)
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hora
    
    // Invalidar códigos anteriores
    db.prepare("UPDATE password_resets SET used = 1 WHERE user_id = ?").run(user.id);
    
    // Guardar nuevo código
    db.prepare("INSERT INTO password_resets (id, user_id, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(getValidId('pr'), user.id, resetCode, resetExpiry, new Date().toISOString());
    
    // Enviar email
    sendPasswordResetEmail(user, resetCode).catch(err => {
        console.error('Error sending password reset email:', err);
    });
    
    res.json({ success: true, message: 'Si el email existe, recibirás un enlace de recuperación.' });
});

// Verificar código de recuperación
app.post('/api/password-reset-verify', (req, res) => {
    const { email, code, new_password } = req.body;
    
    if (!email || !code) {
        return res.status(400).json({ error: 'Email y código requeridos' });
    }
    
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(email.toLowerCase());
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const reset = db.prepare("SELECT * FROM password_resets WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > ?")
        .get(user.id, code, new Date().toISOString());
    
    if (!reset) {
        return res.status(400).json({ error: 'Código inválido o expirado' });
    }
    
    if (new_password) {
        // Actualizar contraseña
        db.prepare("UPDATE users SET password = ? WHERE id = ?").run(new_password, user.id);
        // Marcar código como usado
        db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(reset.id);
        return res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
    }
    
    res.json({ success: true, valid: true });
});

// Solicitar cuenta (signup)
app.post('/signup', async (req, res) => {
    const { username, password, role = 'PRODUCTOR' } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) return res.status(400).json({ error: 'Email inválido' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    
    try {
        const id = getValidId('users');
        db.prepare("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(id, username.toLowerCase(), password, role, 'PENDING', new Date().toISOString());
        
        res.json({ success: true, message: 'Solicitud enviada. Un administrador debe aprobar tu acceso.' });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Este email ya está registrado' });
        res.status(500).json({ error: 'Error al crear la cuenta' });
    }
});

// ─────────────────────────────────────────────────────────────
// GOVERNANCE V10 — SETTINGS (LEGALES)
// ─────────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all();
    const dict = {};
    rows.forEach(r => dict[r.setting_key] = r.setting_value);
    res.json(dict);
});

// Endpoint para obtener la versión actual de la aplicación (V11.6.1)
app.get('/api/app-version', (req, res) => {
    res.json({ version: APP_VERSION });
});

app.put('/api/settings', authMiddleware(['ADMIN']), (req, res) => {
    const { policy_data, terms_conditions } = req.body;
    if (policy_data !== undefined) {
        db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = 'policy_data'").run(policy_data);
    }
    if (terms_conditions !== undefined) {
        db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = 'terms_conditions'").run(terms_conditions);
    }
    res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// EVENTS ENDPOINTS
// ─────────────────────────────────────────────────────────────
app.post('/api/events', authMiddleware(['ADMIN', 'PRODUCTOR']), upload.single('logo'), (req, res) => {
    const { name, date, end_date, location, description } = req.body;
    const userId = req.userId; // YA CASTEADO EN EL MIDDLEWARE
    const id = getValidId('events');
    const logoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    try {
        db.prepare("INSERT INTO events (id, user_id, name, date, end_date, location, logo_url, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(id, userId, name, date, end_date, location, logoUrl, description, new Date().toISOString());
        
        // Crear plantillas de email por defecto para el nuevo evento
        createEventEmailTemplates(id);
        
        res.json({ success: true, eventId: id });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/events', authMiddleware(), (req, res) => {
    const userId = req.userId;
    const role = req.userRole;
    
    let rows;
    if (role === 'ADMIN') {
        // ADMIN ve todos los eventos
        rows = db.prepare("SELECT * FROM events ORDER BY created_at DESC").all();
    } else {
        // PRODUCTOR, STAFF, CLIENTE ven solo eventos de sus grupos/asignaciones
        const eventIds = getUserEventIds(userId, role);
        if (eventIds.length === 0) {
            rows = [];
        } else {
            const placeholders = eventIds.map(() => '?').join(',');
            rows = db.prepare(`SELECT * FROM events WHERE id IN (${placeholders}) ORDER BY created_at DESC`).all(...eventIds);
        }
    }
    res.json(rows);
});

app.put('/api/events/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { 
        name, date, location, description, end_date,
        reg_title, reg_welcome_text, reg_policy, reg_success_message,
        reg_show_phone, reg_show_org, reg_show_position, reg_show_vegan,
        reg_show_dietary, reg_show_gender, reg_require_agreement,
        qr_color_dark, qr_color_light, qr_logo_url, ticket_bg_url, ticket_accent_color
    } = req.body;
    const targetId = castId('events', req.params.id);
    
    db.prepare(`UPDATE events SET 
        name = ?, date = ?, location = ?, description = ?, end_date = ?,
        reg_title = ?, reg_welcome_text = ?, reg_policy = ?, reg_success_message = ?,
        reg_show_phone = ?, reg_show_org = ?, reg_show_position = ?, reg_show_vegan = ?,
        reg_show_dietary = ?, reg_show_gender = ?, reg_require_agreement = ?,
        qr_color_dark = ?, qr_color_light = ?, qr_logo_url = ?, ticket_bg_url = ?, ticket_accent_color = ?
        WHERE id = ?`).run(
        name, date, location, description, end_date || null,
        reg_title || null, reg_welcome_text || null, reg_policy || null, reg_success_message || null,
        reg_show_phone ? 1 : 0, reg_show_org ? 1 : 0, reg_show_position ? 1 : 0, reg_show_vegan ? 1 : 0,
        reg_show_dietary ? 1 : 0, reg_show_gender ? 1 : 0, reg_require_agreement ? 1 : 0,
        qr_color_dark || '#000000', qr_color_light || '#ffffff', qr_logo_url || null, ticket_bg_url || null, ticket_accent_color || '#7c3aed',
        targetId
    );
    res.json({ success: true });
});

app.delete('/api/events/:id', authMiddleware(['ADMIN']), (req, res) => {
    const targetId = castId('events', req.params.id);
    db.prepare("DELETE FROM events WHERE id = ?").run(targetId);
    res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// INVITADOS
// ─────────────────────────────────────────────────────────────
app.get('/api/guests/:eventId', authMiddleware(), (req, res) => {
    const eId = castId('events', req.params.eventId);
    const rows = db.prepare("SELECT * FROM guests WHERE event_id = ? ORDER BY name ASC").all(eId);
    res.json(rows);
});

// ─────────────────────────────────────────────────────────────
// IMPORTACIÓN MOTOR V10.5.2 (Limpieza de duplicados y anidados)
// ─────────────────────────────────────────────────────────────
app.post('/api/import-preview', authMiddleware(), upload.single('file'), async (req, res) => {
    if (!req.file || !req.body.event_id) return res.status(400).json({ error: 'Data faltante' });
    const eId = castId('events', req.body.event_id);
    const guests = [];
    
    try {
        if (req.file.originalname.endsWith('.pdf')) {
            const dataBuffer = fs.readFileSync(req.file.path);
            const data = await pdfParse(dataBuffer);
            const text = data.text;
            
            // Extraer emails con regex
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const emails = text.match(emailRegex) || [];
            
            // Para cada email, intentar extraer nombre asociado
            emails.forEach(email => {
                // Buscar texto antes del email (nombre posible)
                const emailIndex = text.indexOf(email);
                const beforeText = text.substring(Math.max(0, emailIndex - 150), emailIndex);
                const lines = beforeText.split('\n');
                const lastLine = lines[lines.length - 1].trim();
                
                // Limpiar nombre: quitar números, caracteres especiales al inicio/final
                let name = lastLine.replace(/^[0-9\s\.\,\-\:]+/, '').trim();
                name = name.split(/[0-9]{5,}/)[0].trim(); // Quitar códigos largos
                
                // Si el nombre está vacío o es muy corto, usar genérico
                if (!name || name.length < 2) {
                    name = email.split('@')[0].replace(/[._]/g, ' ');
                    name = name.charAt(0).toUpperCase() + name.slice(1);
                }
                
                guests.push({ 
                    name: name.substring(0, 80), 
                    email: email.toLowerCase(), 
                    organization: 'Importado PDF' 
                });
            });
            
            // Si no se encontraron emails, intentar con teléfonos
            if (guests.length === 0) {
                const phoneRegex = /[\+]?[0-9\s\-\(\)]{7,20}/g;
                const phones = text.match(phoneRegex) || [];
                phones.forEach(phone => {
                    const cleanPhone = phone.replace(/\D/g, '');
                    if (cleanPhone.length >= 8) {
                        guests.push({ 
                            name: 'Invitado ' + guests.length, 
                            email: '', 
                            phone: phone.trim(),
                            organization: 'Importado PDF' 
                        });
                    }
                });
            }
        } else {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(req.file.path);
            const sheet = workbook.getWorksheet(1);
            if (sheet) {
                sheet.eachRow((row, i) => {
                    if (i > 1) {
                        const name = row.getCell(1).text;
                        const email = row.getCell(2).text;
                        if (name && email) {
                            const genderRaw = (row.getCell(5).text || 'O').toString().toUpperCase();
                            const gender = ['M', 'F', 'O'].includes(genderRaw) ? genderRaw : 'O';
                            guests.push({ 
                                name, 
                                email, 
                                organization: row.getCell(3).text || '', 
                                phone: row.getCell(4).text || '', 
                                gender,
                                dietary_notes: row.getCell(6).text || ''
                            });
                        }
                    }
                });
            }
        }
        
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        
        // Calcular duplicados contra la BD
        const existing = db.prepare("SELECT email, phone FROM guests WHERE event_id = ?").all(eId);
        const existingEmails = new Set(existing.map(e => (e.email || '').toLowerCase().trim()));
        const existingPhones = new Set(existing.map(e => (e.phone || '').replace(/\D/g, '')));
        
        let duplicates = 0;
        const seenEmails = new Set();
        const seenPhones = new Set();
        
        for (const g of guests) {
            const email = (g.email || '').toLowerCase().trim();
            const phone = (g.phone || '').replace(/\D/g, '');
            
            const isDupEmail = email && (existingEmails.has(email) || seenEmails.has(email));
            const isDupPhone = phone.length > 6 && (existingPhones.has(phone) || seenPhones.has(phone));
            
            if (isDupEmail || isDupPhone) {
                duplicates++;
            } else {
                if (email) seenEmails.add(email);
                if (phone) seenPhones.add(phone);
            }
        }
        
        tempImport[req.userId] = { event_id: eId, guests };
        res.json({ success: true, total: guests.length, valid: guests.length - duplicates, duplicates });
    } catch (e) { 
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/import-confirm', authMiddleware(), (req, res) => {
    const data = tempImport[req.userId];
    if (!data || String(data.event_id) !== String(req.body.event_id)) return res.status(400).json({ error: 'Sesión de importación expirada' });
    
    // Obtener existentes para filtrar duplicados
    const existing = db.prepare("SELECT email, phone FROM guests WHERE event_id = ?").all(data.event_id);
    
    // Crear sets normalizados para comparación (email y telefono separados)
    const existingEmails = new Set(existing.map(e => (e.email || '').toLowerCase().trim()));
    const existingPhones = new Set(existing.map(e => (e.phone || '').replace(/\D/g, '')));
    
    let duplicates = 0;
    const newGuests = data.guests.filter(g => {
        const email = (g.email || '').toLowerCase().trim();
        const phone = (g.phone || '').replace(/\D/g, '');
        
        // Es duplicado si: el email existe Y no está vacío, O el teléfono existe Y tiene más de 6 dígitos
        const isDuplicateEmail = email && existingEmails.has(email);
        const isDuplicatePhone = phone.length > 6 && existingPhones.has(phone);
        
        if (isDuplicateEmail || isDuplicatePhone) {
            duplicates++;
            return false;
        }
        
        // Agregar a los sets para detectar duplicados dentro del mismo archivo
        if (email) existingEmails.add(email);
        if (phone) existingPhones.add(phone);
        
        return true;
    });
    
    const insertMany = db.transaction((guestList) => {
        const insertGuest = db.prepare("INSERT INTO guests (id, event_id, name, email, organization, phone, gender, dietary_notes, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        for (const g of guestList) {
            insertGuest.run(getValidId('guests'), data.event_id, g.name, g.email, g.organization, g.phone || '', g.gender || 'O', g.dietary_notes || '', uuidv4());
        }
    });

    try {
        insertMany(newGuests);
        delete tempImport[req.userId];
        io.to(data.event_id).emit('update_stats', data.event_id);
        res.json({ success: true, count: newGuests.length, skipped: duplicates });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// EXPORTAR EXCEL
// ─────────────────────────────────────────────────────────────
app.get('/api/export-excel/:eventId', authMiddleware(), async (req, res) => {
    const eId = castId('events', req.params.eventId);
    const rows = db.prepare("SELECT name as Nombre, email as Email, organization as Organizacion, phone as Telefono, gender as Genero, CASE WHEN checked_in = 1 THEN 'SÍ' ELSE 'NO' END as Asistio, checkin_time as Hora FROM guests WHERE event_id = ?").all(eId);
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Check Pro V10';
    const sheet = workbook.addWorksheet('Invitados', {
        views: [{ state: 'frozen', ySplit: 1 }]
    });
    
    // Cabeceras con estilo premium
    sheet.columns = [
        { header: 'Nombre', key: 'Nombre', width: 30 },
        { header: 'Email', key: 'Email', width: 35 },
        { header: 'Organización', key: 'Organizacion', width: 30 },
        { header: 'Teléfono', key: 'Telefono', width: 18 },
        { header: 'Género', key: 'Genero', width: 10 },
        { header: 'Asistió', key: 'Asistio', width: 12 },
        { header: 'Hora Check-in', key: 'Hora', width: 22 }
    ];
    
    // Estilo del encabezado
    sheet.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF5B21B6' } } };
    });
    sheet.getRow(1).height = 24;
    
    // Datos con filas alternas
    rows.forEach((row, i) => {
        const dataRow = sheet.addRow(row);
        if (i % 2 === 0) {
            dataRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
            });
        }
        // Colorear asistidos en verde
        const asistioCell = dataRow.getCell('Asistio');
        if (asistioCell.value === 'SÍ') {
            asistioCell.font = { bold: true, color: { argb: 'FF059669' } };
        }
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=CheckPro_Export_${req.params.eventId}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
});

// ─────────────────────────────────────────────────────────────
// LIMPIAR BD / CHECK-IN / STATS / REGISTRO PÚBLICO
// ─────────────────────────────────────────────────────────────
app.post('/api/clear-db/:eventId', authMiddleware(['ADMIN']), (req, res) => {
    const eId = castId('events', req.params.eventId);
    db.prepare("DELETE FROM guests WHERE event_id = ?").run(eId);
    db.prepare("DELETE FROM survey_responses WHERE event_id = ?").run(eId);
    res.json({ success: true });
});

app.post('/api/checkin/:guestId', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO']), (req, res) => {
    const { status } = req.body;
    const gId = castId('guests', req.params.guestId);
    const time = status ? new Date().toISOString() : null;
    
    // Obtener datos del invitado antes de actualizar
    const guest = db.prepare("SELECT * FROM guests WHERE id = ?").get(gId);
    
    db.prepare("UPDATE guests SET checked_in = ?, checkin_time = ? WHERE id = ?").run(status ? 1 : 0, time, gId);
    
    if (guest && status) {
        io.to(guest.event_id).emit('update_stats', guest.event_id);
        
        // Enviar email de bienvenida con agenda (en background)
        if (guest.email) {
            sendEventEmail(guest.event_id, guest.email, 'checkin_welcome', {
                guest_name: guest.name,
                email: guest.email,
                organization: guest.organization,
                checkin_time: new Date(time).toLocaleString('es-ES')
            }).catch(err => console.error('Error sending checkin welcome email:', err));
        }
    } else if (guest) {
        io.to(guest.event_id).emit('update_stats', guest.event_id);
    }
    
    res.json({ success: true });
});

app.get('/api/stats/:eventId', authMiddleware(), (req, res) => {
    const eId = castId('events', req.params.eventId);
    
    // Estadísticas generales y On-site
    const gen = db.prepare(`
        SELECT 
            COUNT(*) as total, 
            SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checkedIn, 
            COUNT(DISTINCT organization) as orgs, 
            SUM(CASE WHEN is_new_registration = 1 THEN 1 ELSE 0 END) as onsite 
        FROM guests WHERE event_id = ?
    `).get(eId);
    
    // Alertas de salud (dietas/alergias)
    const health = db.prepare("SELECT COUNT(*) as health FROM guests WHERE event_id = ? AND (dietary_notes IS NOT NULL AND dietary_notes != '')").get(eId);
    
    // Flujo de entrada por hora
    const flow = db.prepare("SELECT strftime('%H', checkin_time) as hour, COUNT(*) as count FROM guests WHERE event_id = ? AND checked_in = 1 GROUP BY hour ORDER BY hour").all(eId);
    
    // Distribución por Organización (Top 5 + Otros)
    const orgsRaw = db.prepare(`
        SELECT organization, COUNT(*) as count 
        FROM guests WHERE event_id = ? AND organization IS NOT NULL AND organization != ''
        GROUP BY organization ORDER BY count DESC
    `).all(eId);
    
    let orgDistribution = orgsRaw.slice(0, 5);
    if (orgsRaw.length > 5) {
        const othersCount = orgsRaw.slice(5).reduce((acc, curr) => acc + curr.count, 0);
        orgDistribution.push({ organization: 'Otros', count: othersCount });
    }
    
    // Distribución por Género
    const genderDist = db.prepare(`
        SELECT gender, COUNT(*) as count 
        FROM guests WHERE event_id = ? 
        GROUP BY gender
    `).all(eId);
    
    // Métricas de Mailing para este evento
    const mailingStats = db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as errors
        FROM email_queue WHERE event_id = ?
    `).get(eId);

    res.json({ 
        ...gen, 
        healthAlerts: health.health, 
        flowData: flow,
        orgDistribution,
        genderDistribution: genderDist,
        mailingStats: {
            total: mailingStats.total || 0,
            sent: mailingStats.sent || 0,
            errors: mailingStats.errors || 0
        }
    });
});

app.post('/api/register', (req, res) => {
    const { event_id, name, email, phone, organization, gender, dietary_notes } = req.body;
    const eId = castId('events', event_id);
    
    const guestId = getValidId('guests');
    db.prepare("INSERT INTO guests (id, event_id, name, email, phone, organization, gender, dietary_notes, qr_token, is_new_registration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)")
      .run(guestId, eId, name, email, phone, organization, gender, dietary_notes, uuidv4());
    io.to(eId).emit('update_stats', eId);
    
    // Enviar email de confirmación de registro (en background)
    if (email) {
        const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eId);
        sendEventEmail(eId, email, 'registration_confirm', {
            guest_name: name,
            email: email,
            organization: organization
        }).catch(err => console.error('Error sending registration confirm email:', err));
    }
    
    res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// PUBLIC EVENT — Para la ruta de registro
// ─────────────────────────────────────────────────────────────
app.get('/api/events/public/:name', (req, res) => {
    const row = db.prepare("SELECT id, name, date, location, description, logo_url FROM events WHERE LOWER(REPLACE(name, ' ', '')) = LOWER(REPLACE(?, ' ', '')) AND status = 'ACTIVE' LIMIT 1").get(req.params.name);
    if (row) res.json(row);
    else res.status(404).json({ error: 'Evento no encontrado' });
});

// Obtener evento por ID (público)
app.get('/api/events/:id', (req, res) => {
    const eId = castId('events', req.params.id);
    const row = db.prepare(`
        SELECT id, name, date, end_date, location, description, logo_url,
               reg_title, reg_welcome_text, reg_policy, reg_success_message, reg_logo_url,
               reg_show_phone, reg_show_org, reg_show_position, reg_show_vegan, 
               reg_show_dietary, reg_show_gender, reg_require_agreement
        FROM events WHERE id = ?`).get(eId);
    if (row) {
        row.logo_path = row.logo_url ? `/uploads/${path.basename(row.logo_url)}` : null;
        row.reg_logo_path = row.reg_logo_url ? `/uploads/${path.basename(row.reg_logo_url)}` : row.logo_path;
        res.json(row);
    }
    else res.status(404).json({ error: 'Evento no encontrado' });
});

// Registro público de pre-inscripción
app.post('/api/public-register', async (req, res) => {
    const { event_id, name, email, phone, organization, position, gender, dietary_notes } = req.body;
    
    if (!event_id || !name || !email) {
        return res.status(400).json({ error: 'Datos obligatorios faltantes' });
    }

    try {
        // Verificar si ya existe
        const existing = db.prepare("SELECT id FROM pre_registrations WHERE event_id = ? AND email = ?").get(event_id, email.toLowerCase());
        if (existing) {
            return res.json({ success: true, message: 'Ya estás registrado. ¡Te esperamos!' });
        }

        // Crear pre-registro
        const id = getValidId('pre_reg');
        db.prepare(`INSERT INTO pre_registrations (id, event_id, name, email, phone, organization, position, gender, dietary_notes, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`)
            .run(id, event_id, name, email.toLowerCase(), phone || '', organization || '', position || '', gender || 'O', dietary_notes || '');

        res.json({ success: true, message: 'Registro exitoso. Tu inscripción está pendiente de aprobación.' });
    } catch (e) {
        res.status(500).json({ error: 'Error al procesar el registro' });
    }
});

app.get('/api/app-version', (req, res) => {
    res.json({ version: APP_VERSION });
});

// ═══ SMTP CONFIGURATION & EMAIL TEMPLATES ═══

// Obtener configuración SMTP
app.get('/api/smtp-config', authMiddleware(['ADMIN']), (req, res) => {
    const config = db.prepare("SELECT * FROM smtp_config WHERE id = 1").get();
    if (config) {
        // No devolver la contraseña en claro
        config.smtp_pass = config.smtp_pass ? '***' : '';
    }
    res.json(config || {});
});

// Guardar configuración SMTP
app.put('/api/smtp-config', authMiddleware(['ADMIN']), (req, res) => {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_name, from_email } = req.body;
    
    // Solo actualizar contraseña si no está vacía o es ***
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

// ═══ IMAP CONFIG ENDPOINTS ═══

// Obtener configuración IMAP
app.get('/api/imap-config', authMiddleware(['ADMIN']), (req, res) => {
    const config = db.prepare("SELECT * FROM imap_config WHERE id = 1").get();
    if (config) {
        config.imap_pass = config.imap_pass ? '***' : '';
    }
    res.json(config || {});
});

// Guardar configuración IMAP
app.put('/api/imap-config', authMiddleware(['ADMIN']), (req, res) => {
    const { imap_host, imap_port, imap_user, imap_pass, imap_tls } = req.body;
    
    // Solo actualizar contraseña si no está vacía o es ***
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
app.post('/api/imap-test', authMiddleware(['ADMIN']), async (req, res) => {
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

// Obtener plantillas de email
app.get('/api/email-templates', authMiddleware(['ADMIN']), (req, res) => {
    const templates = db.prepare("SELECT * FROM email_templates ORDER BY name ASC").all();
    res.json(templates);
});

// Crear nueva plantilla
app.post('/api/email-templates', authMiddleware(['ADMIN']), (req, res) => {
    const { name, subject, body, event_id } = req.body;
    try {
        const result = db.prepare("INSERT INTO email_templates (name, subject, body, event_id, is_active) VALUES (?, ?, ?, ?, 1)")
            .run(name, subject, body, event_id || null);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Eliminar plantilla
app.delete('/api/email-templates/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        db.prepare("DELETE FROM email_templates WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Actualizar plantilla de email
app.put('/api/email-templates/:id', authMiddleware(['ADMIN']), (req, res) => {
    const { subject, body } = req.body;
    const templateId = req.params.id;
    
    db.prepare("UPDATE email_templates SET subject = ?, body = ?, updated_at = ? WHERE id = ?")
      .run(subject, body, new Date().toISOString(), templateId);
    
    res.json({ success: true });
});

// ═══ SISTEMA DE BUZÓN Y ENVÍO MASIVO (V11.0) ═══

// 1. Obtener Logs (Buzón)
app.get('/api/email-logs', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const { type, event_id } = req.query;
    let query = "SELECT * FROM email_logs WHERE 1=1";
    let params = [];
    
    if (type) {
        query += " AND type = ?";
        params.push(type);
    }
    if (event_id) {
        query += " AND event_id = ?";
        params.push(castId('events', event_id));
    }
    
    query += " ORDER BY created_at DESC LIMIT 100";
    const logs = db.prepare(query).all(...params);
    res.json(logs);
});

// 2. Encolar Envío Masivo (Broadcast)
app.post('/api/emails/broadcast', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    const { event_id, template_id, subject, body } = req.body;
    const eId = castId('events', event_id);

    if (!eId || !body) return res.status(400).json({ error: 'Faltan datos' });

    try {
        const guests = db.prepare("SELECT * FROM guests WHERE event_id = ? AND unsubscribed = 0").all(eId);
        
        const insertQueue = db.prepare(`INSERT INTO email_queue (id, event_id, guest_id, to_email, subject, body_html, status, scheduled_at) 
                                        VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`);
        
        const updateToken = db.prepare("UPDATE guests SET unsubscribe_token = ? WHERE id = ? AND unsubscribe_token IS NULL");

        db.transaction(() => {
            for (const guest of guests) {
                // Generar token si no tiene
                if (!guest.unsubscribe_token) {
                    const token = crypto.randomBytes(16).toString('hex');
                    updateToken.run(token, guest.id);
                    guest.unsubscribe_token = token;
                }

                const personalizedBody = replaceTemplateVariables(body, {
                    guest_name: guest.name,
                    guest_email: guest.email,
                    unsubscribe_url: `${req.protocol}://${req.get('host')}/unsubscribe/${guest.unsubscribe_token}`
                });

                insertQueue.run(uuidv4(), eId, guest.id, guest.email, subject, personalizedBody, new Date().toISOString());
            }
        })();

        res.json({ success: true, count: guests.length });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al encolar' });
    }
});

// 3. Control de Cola (Pausa/Reinicio)
app.post('/api/emails/queue-control', authMiddleware(['ADMIN']), (req, res) => {
    const { action } = req.body;
    if (action === 'pause') isQueuePaused = true;
    if (action === 'resume') isQueuePaused = false;
    if (action === 'stop') {
        db.prepare("UPDATE email_queue SET status = 'CANCELLED' WHERE status = 'PENDING'").run();
        isQueuePaused = false;
    }
    res.json({ success: true, isPaused: isQueuePaused });
});

// 4. Estadísticas de Cola
app.get('/api/emails/queue-stats', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const stats = db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as errors,
            SUM(CASE WHEN status = 'SENDING' THEN 1 ELSE 0 END) as sending
        FROM email_queue WHERE status != 'CANCELLED'
    `).get();
    res.json({ ...stats, isPaused: isQueuePaused });
});

// 5. Endpoint Público de Desuscripción
app.get('/unsubscribe/:token', (req, res) => {
    const token = req.params.token;
    const guest = db.prepare("SELECT id, name FROM guests WHERE unsubscribe_token = ?").get(token);
    
    if (!guest) {
        return res.send('<h1>Enlace no válido</h1><p>No pudimos encontrar tu suscripción.</p>');
    }

    db.prepare("UPDATE guests SET unsubscribed = 1 WHERE id = ?").run(guest.id);
    
    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>Desuscripción Exitosa</h1>
            <p>Hola ${guest.name}, hemos procesado tu solicitud. No recibirás más correos automáticos de este sistema.</p>
            <p><small>Si fue un error, contacta con soporte.</small></p>
        </div>
    `);
});

// 6. Ejecutar Sincronización IMAP
app.post('/api/emails/sync', authMiddleware(['ADMIN']), async (req, res) => {
    try {
        const result = await syncEmails();
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Obtener usuarios asignados a un evento
app.get('/api/events/:eventId/users', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    
    // Verificar acceso
    if (req.userRole === 'PRODUCTOR') {
        if (!hasEventAccess(req.userId, eventId, req.userRole)) {
            return res.status(403).json({ error: 'No tienes acceso a este evento' });
        }
    }
    
    const users = db.prepare(`
        SELECT u.id, u.username, u.display_name, u.role, u.status, ue.created_at as assigned_at
        FROM users u
        INNER JOIN user_events ue ON u.id = ue.user_id
        WHERE ue.event_id = ?
        ORDER BY u.display_name || u.username
    `).all(eventId);
    
    res.json(users);
});

// ═══ EMAIL POR EVENTO ═══

// Obtener configuración SMTP de evento
app.get('/api/events/:eventId/email-config', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const config = db.prepare("SELECT * FROM event_email_config WHERE event_id = ?").get(eventId);
    if (config) {
        config.smtp_pass = config.smtp_pass ? '***' : '';
    }
    res.json(config || { event_id: eventId, enabled: 0 });
});

// Guardar configuración SMTP de evento
app.put('/api/events/:eventId/email-config', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_name, from_email, enabled } = req.body;
    
    const existing = db.prepare("SELECT smtp_pass FROM event_email_config WHERE event_id = ?").get(eventId);
    let passToSave = smtp_pass;
    if (!smtp_pass || smtp_pass === '***') {
        passToSave = existing?.smtp_pass || '';
    }
    
    db.prepare(`INSERT OR REPLACE INTO event_email_config 
                (id, event_id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, from_name, from_email, enabled, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(getValidId('eec'), eventId, smtp_host || '', smtp_port || 587, smtp_user || '', passToSave, smtp_secure ? 1 : 0, from_name || '', from_email || '', enabled ? 1 : 0, new Date().toISOString());
    
    res.json({ success: true });
});

// Obtener plantillas de email de evento
app.get('/api/events/:eventId/email-templates', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const templates = db.prepare("SELECT * FROM event_email_templates WHERE event_id = ? ORDER BY template_type").all(eventId);
    res.json(templates);
});

// Actualizar plantilla de email de evento
app.put('/api/events/:eventId/email-templates/:type', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const { subject, body, is_active, auto_send } = req.body;
    const templateType = req.params.type;
    
    const existing = db.prepare("SELECT id FROM event_email_templates WHERE event_id = ? AND template_type = ?").get(eventId, templateType);
    
    if (existing) {
        db.prepare("UPDATE event_email_templates SET subject = ?, body = ?, is_active = ?, auto_send = ?, updated_at = ? WHERE event_id = ? AND template_type = ?")
          .run(subject, body, is_active ? 1 : 0, auto_send ? 1 : 0, new Date().toISOString(), eventId, templateType);
    } else {
        db.prepare("INSERT INTO event_email_templates (id, event_id, template_type, subject, body, is_active, auto_send, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(getValidId('eet'), eventId, templateType, subject, body, is_active ? 1 : 0, auto_send ? 1 : 0, new Date().toISOString());
    }
    
    res.json({ success: true });
});

// Obtener agenda de evento
app.get('/api/events/:eventId/agenda', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const agenda = db.prepare("SELECT * FROM event_agenda WHERE event_id = ? ORDER BY sort_order, start_time").all(eventId);
    res.json(agenda);
});

// Guardar agenda de evento
app.put('/api/events/:eventId/agenda', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const { agenda_items } = req.body;
    
    // Eliminar agenda actual
    db.prepare("DELETE FROM event_agenda WHERE event_id = ?").run(eventId);
    
    // Insertar nueva agenda
    if (agenda_items && agenda_items.length > 0) {
        const insert = db.prepare("INSERT INTO event_agenda (id, event_id, title, description, start_time, end_time, speaker, location, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        agenda_items.forEach((item, index) => {
            insert.run(getValidId('ea'), eventId, item.title || '', item.description || '', item.start_time || '', item.end_time || '', item.speaker || '', item.location || '', index);
        });
    }
    
    res.json({ success: true });
});

// Enviar email de prueba para evento
app.post('/api/events/:eventId/email-test', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const { test_email } = req.body;
    
    if (!test_email) return res.status(400).json({ error: 'Email de prueba requerido' });
    
    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
    
    // Función simplificada para testing
    const config = db.prepare("SELECT * FROM event_email_config WHERE event_id = ? AND enabled = 1").get(eventId);
    
    if (!config || !config.smtp_host) {
        return res.json({ success: false, error: 'SMTP no configurado o deshabilitado para este evento' });
    }
    
    // Simular envío
    console.log('📧 TEST: Email de prueba a', test_email, 'desde evento', event.name);
    res.json({ success: true, message: 'Email de prueba enviado (simulado)' });
});

// Obtener sugerencias de un evento
app.get('/api/events/:eventId/suggestions', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const suggestions = db.prepare(`
        SELECT gs.*, g.name as guest_name, g.email as guest_email
        FROM guest_suggestions gs
        LEFT JOIN guests g ON gs.guest_id = g.id
        WHERE gs.event_id = ?
        ORDER BY gs.submitted_at DESC
    `).all(eventId);
    res.json(suggestions);
});

// Enviar sugerencia (público)
app.post('/api/events/:eventId/suggestions', (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const { guest_id, suggestion } = req.body;
    
    if (!suggestion || suggestion.trim().length === 0) {
        return res.status(400).json({ error: 'Sugerencia requerida' });
    }
    
    const id = getValidId('gs');
    db.prepare("INSERT INTO guest_suggestions (id, event_id, guest_id, suggestion, submitted_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, eventId, guest_id || null, suggestion.trim(), new Date().toISOString());
    
    res.json({ success: true, message: '¡Gracias por tu sugerencia!' });
});

// --- SPA FALLBACK (V10.5) ---
app.use((req, res, next) => {
    if (req.path === '/registro.html') {
        return res.sendFile(path.join(__dirname, 'registro.html'));
    }
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        next();
    }
});

server.listen(port, () => console.log(`\x1b[35mCHECK PRO V11.5.0 (Analytics Dashboard + Phase 7): Puerto ${port}\x1b[0m`));
