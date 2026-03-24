// server.js — Check Elite Pro v12.9.9
// Regla de Oro V12 - Sistema Modular con Glassmorphismg();
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { db, createEventEmailTemplates } = require('./database');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const imap = require('imap');
const { simpleParser } = require('mailparser');

// Middleware de seguridad
const { csrfMiddleware, securityHeaders } = require('./src/middleware/csrf');
// --- GZIP COMPRESSION (Performance) ---
const compression = require('compression');

// --- CACHE IN-MEMORY (Performance) ---
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
global.cache = cache;

// --- CACHE UTILITIES ---
const { init: initCache } = require('./src/utils/cache');
initCache(cache);

// --- MÓDULOS (Fase 10 - Modularización) ---
const { registerRoutes } = require('./src/routes');
const { init: initSocket, getIO: socketGetIO } = require('./src/socket');

// --- VERSIÓN DINÁMICA V10.3 ---
const APP_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version;

const app = express();
const server = http.createServer(app);

// CORS whitelist desde variable de entorno
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8080').split(',');

const io = initSocket(server, { cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] } });
const port = process.env.PORT || 3000;

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
async function processEmailQueue() {
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
        (socketGetIO() || io).emit('email_queue_progress', { eventId: nextMail.event_id });
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
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        const accept = req.headers['accept-encoding'] || '';
        if (accept.match(/\bdeflate\b/)) return 'deflate';
        if (accept.match(/\bgzip\b/)) return 'gzip';
        return false;
    },
    level: 6,
    threshold: 1024
}));

// --- HELMET: Security headers mejorados (SEC-012, SEC-013, SEC-024) ---
app.disable('x-powered-by'); // Deshabilitar exposición de tecnología

app.use(helmet({
    // Content Security Policy (CSP) - proteger contra XSS e inyecciones
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net", "https://cdn.quilljs.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net", "https://cdn.quilljs.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "wss:", "https:"],
            mediaSrc: ["'self'", "https:"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    // HSTS - Solo habilitar si hay HTTPS
    hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000, // 1 año
        includeSubDomains: true,
        preload: true
    } : false,
    // Cross-Origin policies
    crossOriginEmbedderPolicy: false, // Deshabilitado por compatibilidad con fonts
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    // Denegar embedding en iframes
    frameguard: { action: 'deny' },
    // Prevenir MIME sniffing
    noSniff: true,
    // Origen referrer
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // XSS filter (legacy pero útil)
    xssFilter: true
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
// ⚠️ SECURITY: Limitar tamaño de request JSON para prevenir DoS
app.use(express.json({ limit: '10mb' })); // Límite de 10MB para uploads JSON

// --- RATE LIMITING POR ENDPOINT ---
app.set('trust proxy', 1);
const skipLocal = (req) => req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';

// Rate limit general: 200 pet/15min
const apiLimiter = rateLimit({ 
    windowMs: 15*60*1000, 
    max: 200, 
    skip: skipLocal, 
    message: { error: 'Demasiadas peticiones. Espera 15 minutos.' } 
});

// Rate limit estricto para auth: 10 pet/15min
const authLimiter = rateLimit({ 
    windowMs: 15*60*1000, 
    max: 10, 
    skip: skipLocal, 
    message: { error: 'Demasiados intentos de login. Espera 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limit para guests: 50 pet/15min (prevenir enumeración)
const guestLimiter = rateLimit({ 
    windowMs: 15*60*1000, 
    max: 50, 
    skip: skipLocal, 
    message: { error: 'Demasiadas consultas. Espera 15 minutos.' } 
});

// Rate limit para email: 20 pet/15min
const emailLimiter = rateLimit({ 
    windowMs: 15*60*1000, 
    max: 20, 
    skip: skipLocal, 
    message: { error: 'Demasiados emails. Espera 15 minutos.' } 
});

// Rate limit para uploads: 10 pet/15min
const uploadLimiter = rateLimit({ 
    windowMs: 15*60*1000, 
    max: 10, 
    skip: skipLocal, 
    message: { error: 'Demasiadas cargas. Espera 15 minutos.' } 
});

app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/signup', authLimiter);  // Prevenir creación masiva de cuentas
app.use('/api/password-reset', authLimiter);  // Prevenir abuso de reset
app.use('/api/guests', guestLimiter);
app.use('/api/events', guestLimiter);
app.use('/api/email', emailLimiter);

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

// --- SEGURIDAD: Headers y CSRF ---
app.use(securityHeaders); // Headers de seguridad
app.use(csrfMiddleware); // Protección CSRF para state-changing requests

// Uploads y middleware de validación se manejan en registerRoutes

// --- SWAGGER UI ---
// ⚠️ SECURITY: Proteger Swagger en producción
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./src/docs/swagger');

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
    // En producción, devolver 404 para evitar exponer la API
    app.use('/api-docs', (req, res) => {
        res.status(404).json({ error: 'API Docs no disponible en producción' });
    });
    console.log('⚠️  Swagger UI deshabilitado en producción');
} else {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Check Pro API Docs'
    }));
}

// --- REGISTRAR RUTAS MODULARES ---
registerRoutes(app);

// --- SPA FALLBACK ---
app.use((req, res, next) => {
    if (req.path === '/registro.html') return res.sendFile(path.join(__dirname, 'registro.html'));
    if (req.path === '/survey.html') return res.sendFile(path.join(__dirname, 'survey.html'));
    
    // Solo servir index.html para rutas que no son API/social y que aceptan HTML
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io') && !req.path.startsWith('/uploads')) {
        const accept = req.headers.accept || '';
        if (accept.includes('text/html')) {
            return res.sendFile(path.join(__dirname, 'index.html'));
        }
    }
    next();
});


// ═══ RUTAS INLINE NECESARIAS (requieren acceso directo a variables de server.js) ═══
// - /                   → SPA root (usa path.join(__dirname, 'index.html'))
// - /:eventName/registro → Registro público (usa path.basename para logos)
// Estas rutas NO pueden migrarse a módulos porque necesitan variables del scope de server.js

// --- ERROR HANDLER GLOBAL (SEC-014) ---
// Prevenir exposición de stack traces en producción
app.use((err, req, res, next) => {
    // Loguear error completo para debugging
    console.error('[ERROR]', {
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        path: req.path,
        method: req.method,
        ip: req.ip
    });
    
    // No exponer detalles del error en producción
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Manejar errores específicos
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'JSON inválido' });
    }
    
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Payload demasiado grande' });
    }
    
    if (err.message && err.message.includes('CSV')) {
        return res.status(400).json({ error: err.message });
    }
    
    // Respuesta genérica
    res.status(err.status || 500).json({
        error: isProduction ? 'Error interno del servidor' : err.message,
        ...(isProduction && { code: 'INTERNAL_ERROR' })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Recurso no encontrado' });
});

server.listen(port, () => console.log(`\x1b[35mCHECK PRO V${APP_VERSION} (Smart Import Engine + Column Config): Puerto ${port}\x1b[0m`));
