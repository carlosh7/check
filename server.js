// server.js — Check Pro v12.34.1
// Regla de Oro V12 - Sistema Modular con Deep Dark Mode
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { db } = require('./database');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const imap = require('imap');

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

// --- EMAIL SERVICE (Delegado al módulo email.routes.js) ---
// Las funciones de email ahora están en src/routes/email.routes.js
// Esta variable global es usada por el módulo de email
global.emailService = null;

// Inicializar email service
try {
    const emailService = require('./src/utils/email-service');
    global.emailService = emailService;
    console.log('✓ Email Service inicializado');
} catch (e) {
    console.warn('⚠ Email Service no disponible:', e.message);
}

function replaceTemplateVariables(template, data) {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return result;
}

// Envío básico de emails transaccionales (legacy - para compatibilidad)
async function sendEmail(to, subject, html, options = {}) {
    console.log('📧 sendEmail() legado llamado - migrar a email-service.js');
    // Si hay un servicio de email configurado, lo usamos
    if (global.emailService) {
        return global.emailService.sendEmail({ to, subject, html, ...options });
    }
    console.log('📧 Email simulation (no email service configured):', { to, subject });
    return { success: true, simulated: true };
}

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
            upgradeInsecureRequests: null
        }
    },
    // HSTS - Deshabilitado (lo maneja nginx si aplica)
    hsts: false,
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
        // 1. Permitir peticiones sin origen (apps móviles, Postman o carga directa de assets)
        if (!origin) return callback(null, true);

        // 2. Permitir Red Local / Desarrollo (v12.44.398 Hybrid Check)
        const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.[0-9.]+|10\.[0-9.]+|172\.[0-9.]+)(:[0-9]+)?$/.test(origin);
        
        // 3. Permitir Dominios en Whitelist (ALLOWED_ORIGINS)
        const isWhitelisted = ALLOWED_ORIGINS.includes(origin);

        if (isLocal || isWhitelisted) {
            callback(null, true);
        } else {
            console.log(`[CORS] Bloqueado origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
// ⚠️ SECURITY: Limitar tamaño de request JSON para prevenir DoS
app.use(express.json({ limit: '50mb' })); // Límite de 50MB para permitir importaciones masivas

// --- RATE LIMITING POR ENDPOINT ---
app.set('trust proxy', 1);
const skipLocal = (req) => {
    // Detectar peticiones locales: localhost, 127.0.0.1, ::1, red docker (172.x.x.x)
    const ip = req.ip || '';
    return ip === '::1' || 
           ip === '127.0.0.1' || 
           ip === '::ffff:127.0.0.1' ||
           ip.startsWith('172.') ||    // Docker network
           ip.startsWith('192.168.') || // Local network
           ip.startsWith('10.') ||      // Docker/Local network
           !ip;                          // No IP (internal)
};

// Rate limit general: 10000 pet/15min (aumentado para evitar 429)
const apiLimiter = rateLimit({ 
    windowMs: 15*60*1000, 
    max: 10000, 
    skip: skipLocal, 
    message: { error: 'Demasiadas peticiones. Espera unos segundos.' } 
});

// Rate limit estricto para auth: 50 pet/15min (aumentado)
const authLimiter = rateLimit({ 
    windowMs: 15*60*1000, 
    max: 50, 
    skip: skipLocal, 
    message: { error: 'Demasiados intentos de login. Espera unos segundos.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limit para guests: 500 pet/15min (aumentado para evitar 429)
const guestLimiter = rateLimit({ 
    windowMs: 15*60*1000, 
    max: 500, 
    skip: skipLocal, 
    message: { error: 'Demasiadas consultas. Espera unos segundos.' } 
});

// Rate limit para uploads: 30 pet/15min (aumentado)
const uploadLimiter = rateLimit({ 
    windowMs: 15*60*1000, 
    max: 30, 
    skip: skipLocal, 
    message: { error: 'Demasiadas cargas. Espera unos segundos.' } 
});

app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/signup', authLimiter);  // Prevenir creación masiva de cuentas
app.use('/api/password-reset', authLimiter);  // Prevenir abuso de reset
app.use('/api/guests', guestLimiter);
app.use('/api/events', guestLimiter);

// --- SEGURIDAD: Headers y CSRF ---
app.use(securityHeaders); // Headers de seguridad
app.use(csrfMiddleware); // Protección CSRF para state-changing requests

// --- ANTI-CACHÉ SOLO PARA INDEX.HTML (siempre debe ser fresco) ---
app.get('/', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// --- STATIC FILES CON CACHE (versionados con ?v=X.Y.Z) ---
// CSS y JS tienen query string de versión, cacheamos pero permitimos revalidación
app.use('/css', express.static(path.join(__dirname, 'public/css'), {
    maxAge: '1m',
    etag: true,
    lastModified: true
}));

app.use('/js', express.static(path.join(__dirname, 'public/js'), {
    maxAge: '1m',
    etag: true,
    lastModified: true
}));

app.use('/html', express.static(path.join(__dirname, 'public/html'), {
    maxAge: '1m',
    etag: true,
    lastModified: true
}));

// Archivos estáticos raíz (imágenes, favicon, etc.)
app.use(express.static(path.join(__dirname, '/'), {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, reqPath) => {
        // HTML nunca se cachea
        if (reqPath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
    }
}));

// Uploads y middleware de validación se manejan en registerRoutes

// --- SWAGGER UI (importación condicional) ---
let swaggerUi = null;
let swaggerSpec = null;
try {
    swaggerUi = require('swagger-ui-express');
    swaggerSpec = require('./src/docs/swagger').swaggerSpec;
} catch (e) {
    // swagger-ui-express no disponible
}

const isProduction = process.env.NODE_ENV === 'production';
if (!swaggerUi || isProduction) {
    // En producción o sin swagger, devolver 404 para evitar exponer la API
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

// --- RUTAS PÚBLICAS DE RULETA (antes del registro de rutas) ---
// Debe estar ANTES de registerRoutes para que tenga prioridad
app.get(/\/wheel\/[^/]+\/public$/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/pages/wheel.html'));
});
app.get(/\/[^/]+\/wheel\/[^/]+\/public$/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/html/pages/wheel.html'));
});

// --- REGISTRAR RUTAS MODULARES ---
registerRoutes(app);

// --- SPA FALLBACK ---
app.use((req, res, next) => {
    // Rutas para archivos HTML en nueva estructura
    if (req.path === '/registro.html') return res.sendFile(path.join(__dirname, 'public/html/pages/registro.html'));
    if (req.path === '/survey.html') return res.sendFile(path.join(__dirname, 'public/html/pages/survey.html'));
    if (req.path === '/wheel.html') return res.sendFile(path.join(__dirname, 'public/html/pages/wheel.html'));
    if (req.path === '/ticket.html') return res.sendFile(path.join(__dirname, 'public/html/pages/ticket.html'));
    if (req.path === '/toolbar_v16.html') return res.sendFile(path.join(__dirname, 'public/html/pages/toolbar_v16.html'));
    if (req.path === '/app-shell.html') return res.sendFile(path.join(__dirname, 'public/html/app-shell.html'));
    
    // Ruta raíz (login) cargando desde raíz del proyecto
    if (req.path === '/' || req.path === '/index.html') {
        return res.sendFile(path.join(__dirname, 'index.html'));
    }
    
    // Solo servir login.html para rutas que no son API/social y que aceptan HTML
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

// ═══ BACKUP AUTOMATIZADO ═══
// Iniciar scheduler de backups (cada 6 horas)
try {
    const { startBackupScheduler } = require('./src/utils/backup');
    startBackupScheduler();
    console.log('✓ Backup Scheduler inicializado (cada 6 horas)');
} catch (e) {
    console.warn('⚠️ Backup Scheduler no disponible:', e.message);
}

// ═══ ARRANQUE DEL SERVIDOR ═══
server.listen(port, () => console.log(`\x1b[35mCHECK PRO V${APP_VERSION} (Enterprise Grade + Backups + Rate Limiting): Puerto ${port}\x1b[0m`));
