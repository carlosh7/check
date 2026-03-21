// server.js — Check Elite Pro v12.2.2 (Quill Fix & Robust Sync)
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
const bcrypt = require('bcryptjs');

// --- MÓDULOS (Fase 10 - Modularización) ---
const { registerRoutes } = require('./src/routes');
const { getValidId: modGetValidId, castId: modCastId } = require('./src/utils/helpers');

// --- VERSIÓN DINÁMICA V10.3 ---
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const APP_VERSION = pkg.version;
let tempImport = {};

const app = express();
const server = http.createServer(app);

// CORS whitelist desde variable de entorno
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ["GET", "POST"]
    }
});
const port = process.env.PORT || 3000;

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

async function sendUserApprovedEmail(user, options = {}) {
    const template = await getEmailTemplate('user_approved');
    if (!template) return { success: false, error: 'Template not found' };
    
    const password = options.password || user.temp_password || 'Tu contraseña actual';
    
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
            suggestion_url: `${data.origin || 'http://localhost:3000'}/suggest.html?event=${eventId}${data.guest_id ? '&guest=' + data.guest_id : ''}`
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

// SERVER V12.2.1 - ARQUITECTURA DISTRIBUIDA Y SEGURA 🛡️🚀
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: false // Desactivar HSTS por ahora (requiere HTTPS)
}));
app.use(cors({
    origin: function (origin, callback) {
        // Permitir requests sin origin (mobile apps, Postman) o origins en whitelist
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            console.log(`[CORS] Bloqueado origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json()); // Nativo en Express 5 — body-parser ya no es necesario

// --- RATE LIMITING ---
app.set('trust proxy', 1);
const skipLocal = (req) => req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';
const apiLimiter = rateLimit({ windowMs: 15*60*1000, max: 200, skip: skipLocal, message: { error: 'Demasiadas peticiones. Espera 15 minutos.' } });
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

// Validación de uploads - tipos permitidos y tamaño máximo
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB máximo
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
            'application/vnd.ms-excel', // xls
            'text/csv'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            console.log(`[UPLOAD] Archivo bloqueado: ${file.originalname} (${file.mimetype})`);
            cb(new Error('Tipo de archivo no permitido'), false);
        }
    }
});

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

// --- REGISTRAR RUTAS MODULARES ---
registerRoutes(app, io);

// --- SPA FALLBACK ---
app.use((req, res, next) => {
    if (req.path === '/registro.html') return res.sendFile(path.join(__dirname, 'registro.html'));
    if (req.path === '/survey.html') return res.sendFile(path.join(__dirname, 'survey.html'));
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else { next(); }
});

// --- RUTAS ÚNICAS QUE NO ESTÁN EN MÓDULOS ---

// Endpoint Público de Desuscripción
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

server.listen(port, () => console.log(`\x1b[35mCHECK PRO V${APP_VERSION} (Smart Import Engine + Column Config): Puerto ${port}\x1b[0m`));
