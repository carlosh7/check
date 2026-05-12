// server.js — Check Pro v12.34.1
// Regla de Oro V12 - Sistema Modular con Deep Dark Mode
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { db } = require('./database');
const fs = require('fs');
const helmet = require('helmet');

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
global.emailService = null;
try {
    global.emailService = require('./src/utils/email-service');
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
            frameSrc: ["*"],
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
    crossOriginOpenerPolicy: false,
    // Denegar embedding en iframes
    frameguard: { action: 'deny' },
    // Prevenir MIME sniffing
    noSniff: true,
    // Origen referrer
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // XSS filter (legacy pero útil)
    xssFilter: true
}));
// Remover headers que generan errores en HTTP (requieren HTTPS)
app.use(function (req, res, next) {
    res.removeHeader('Origin-Agent-Cluster');
    next();
});

// Logger estructurado (H-05)
const { requestLogger } = require('./src/middleware/logger');
app.use(requestLogger);

app.use(cors({
    origin: function (origin, callback) {
        // 1. Permitir peticiones sin origen (apps móviles, Postman o carga directa de assets)
        if (!origin) return callback(null, true);

        // 2. Permitir Red Local / Desarrollo (v12.44.398 Hybrid Check)
        const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.[0-9.]+|10\.[0-9.]+|172\.[0-9.]+)(:[0-9]+)?$/.test(origin);
        
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
// Stripe webhook necesita raw body (antes de express.json)
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
// Deploy webhook necesita raw body para verificar firma GitHub
app.use('/api/deploy/webhook', express.raw({ type: 'application/json' }));

// ⚠️ SECURITY: Limitar tamaño de request JSON para prevenir DoS
app.use(express.json({ limit: '10mb' }));

// --- RATE LIMITING GRANULAR (C8-14) ---
const { limiters, getRateLimitStatus } = require('./src/middleware/rate-limiter');
app.set('trust proxy', 1);

app.use('/api/', limiters.general);
app.use('/api/login', limiters.auth);
app.use('/api/signup', limiters.auth);
app.use('/api/password-reset', limiters.auth);
app.use('/api/guests', limiters.guests);
app.use('/api/events', limiters.guests);
app.use('/api/email', limiters.email);
app.use('/api/webhooks', limiters.webhooks_out);
app.use('/api/stats', limiters.stats);
app.use('/api/analytics', limiters.stats);
app.use('/api/reports', limiters.stats);
app.use('/api/bi', limiters.stats);
app.use('/api/health', limiters.stats);
app.use('/api/deploy', limiters.deploy);
app.use('/api/compliance', limiters.compliance);
app.use('/api/raffles', limiters.raffles);
app.use('/api/proposals', limiters.proposals);
app.use('/api/automation', limiters.automation);
app.use('/api/settings', limiters.settings);
app.use('/api/surveys', limiters.surveys);
app.use('/api/polls', limiters.polls);
app.use('/api/leaderboard', limiters.polls);
app.use('/api/sessions', limiters.sessions);
app.use('/api/venues', limiters.venues);
app.use('/api/chatbot', limiters.chatbot);
app.use('/api/api-keys', limiters.apikeys);
app.use('/api/v1', limiters.apiKeyLimit);
app.use('/api/security', limiters.settings);

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

// Archivos subidos (logos, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// --- MIGRACIONES AUTOMÁTICAS (BL-23) ---
try { require('./src/utils/migrate').runPending(); } catch(e) { console.error('[MIGRATE] Error:', e.message); }

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

// ═══ PLUGIN ENGINE (C11-09) ═══
try {
    const { initPlugins, seedDefaultPlugins } = require('./src/engine/plugin-engine');
    seedDefaultPlugins();
    initPlugins();
    console.log('✓ Plugin Engine inicializado');
} catch (e) {
    console.warn('⚠️ Plugin Engine no disponible:', e.message);
}

// ═══ ARRANQUE DEL SERVIDOR ═══
server.listen(port, '0.0.0.0', () => console.log(`\x1b[35mCHECK PRO V${APP_VERSION} (Enterprise Grade + Backups + Rate Limiting): Puerto ${port}\x1b[0m`));
