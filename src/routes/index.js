/**
 * Índice de rutas
 * Carga todas las rutas del sistema
 */

const express = require('express');
const multer = require('multer');
let imageUploadMiddleware;
try {
    const imgOpt = require('../middleware/imageOptimizer');
    imageUploadMiddleware = imgOpt.imageUploadMiddleware;
} catch (e) {
    console.warn('⚠️ Optimización de imágenes no disponible (sharp no instalado)');
    imageUploadMiddleware = (req, res, next) => next();
}
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const eventsRoutes = require('./events.routes');
const guestsRoutes = require('./guests.routes');
const emailRoutes = require('./email.routes'); // MÓDULO DE MAILING (V12.45)
const groupsRoutes = require('./groups.routes');
const clientsRoutes = require('./clients.routes'); // NUEVO: Módulo de Clientes
const surveysRoutes = require('./surveys.routes');
const settingsRoutes = require('./settings.routes');
const publicRoutes = require('./public.routes');
const versionRoutes = require('./version.routes');
const webhooksRoutes = require('./webhooks.routes');
const pushRoutes = require('./push.routes');
const statsRoutes = require('./stats.routes');
const importRoutes = require('./import.routes');
const sessionsRoutes = require('./sessions.routes');
const seatLayoutsRoutes = require('./seat-layouts.routes');
const aiSecurityRoutes = require('./ai-security.routes');
const complianceRoutes = require('./compliance.routes');
const venuesRoutes = require('./venues.routes');
const googleRoutes = require('./google.routes');
const rafflesRoutes = require('./raffles.routes');
const paymentsRoutes = require('./payments.routes').router;
const smsRoutes = require('./sms.routes');
const budgetRoutes = require('./budget.routes');
const speakersRoutes = require('./speakers.routes');
const proposalsRoutes = require('./proposals.routes');
const automationRoutes = require('./automation.routes');
const tenantsRoutes = require('./tenants.routes');
const chatbotRoutes = require('./chatbot.routes');
const apikeysRoutes = require('./apikeys.routes');
const deployRoutes = require('./deploy.routes');
const changesRoutes = require('./changes.routes');
const ecommerceRoutes = require('./ecommerce.routes');
const crmRoutes = require('./crm.routes');
const ecosystemRoutes = require('./ecosystem.routes');
const intelligenceRoutes = require('./intelligence.routes');
const automationV2Routes = require('./automation-v2.routes');
const pollsRoutes = require('./polls.routes');
const leaderboardRoutes = require('./leaderboard.routes');

// Configuración segura de multer (memoryStorage para import/export)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB máximo
        files: 1 // Solo 1 archivo a la vez
    },
    fileFilter: (req, file, cb) => {
        // Tipos de archivo permitidos
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido'), false);
        }
    }
});

// Middleware para optimizar imágenes automáticamente
function optimizeUploadedImage(req, res, next) {
    if (!req.file) return next();
    
    // Solo optimizar imágenes (no PDFs, Excels, etc.)
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!imageTypes.includes(req.file.mimetype)) return next();
    
    // Aplicar optimización
    imageUploadMiddleware(req, res, next);
}

// Middleware de protección path traversal
function preventPathTraversal(req, res, next) {
    const filePath = req.path;
    // Verificar si contiene sequences de path traversal
    if (filePath.includes('..') || filePath.includes('%2e%2e') || filePath.includes('//')) {
        console.warn(`[SECURITY] Path traversal attempt detected: ${filePath}`);
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
}

function registerRoutes(app, rootDir) {
    const path = require('path');
    rootDir = rootDir || __dirname + '/../..';
    
    // SPA Routes (index.html, registro.html)
    app.get('/', (req, res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.join(rootDir, 'index.html'));
    });
    
    app.get('/calendar', (req, res) => {
        res.sendFile(path.join(rootDir, 'public/html/pages/calendar.html'));
    });
    
    app.get('/:eventName/registro', (req, res) => {
        res.sendFile(path.join(rootDir, 'registro.html'));
    });
    
    // Static files - CON protección path traversal
    app.use('/uploads', 
        preventPathTraversal,
        express.static(path.join(rootDir, 'uploads'), {
            dotfiles: 'deny', // Denegar archivos que empiezan con .
            index: false, // No servir index.html de directorios
            maxAge: '1d'
        })
    );
    
    // Auth (login, signup, password reset)
    app.use('/api', authRoutes);

    // Version and health (público)
    app.use('/api', versionRoutes);

    // Public routes (unsubscribe, captcha, public-register)
    app.use('/api', publicRoutes);
    
    // Users
    app.use('/api/users', usersRoutes);
    
    // Groups
    app.use('/api/groups', groupsRoutes);
    
    // Clients (V12.45)
    app.use('/api/clients', clientsRoutes);
    
    // Events
    app.use('/api/events', eventsRoutes);
    
    // Surveys (encuestas, sugerencias, agenda - montadas en /api/events/:eventId/...)
    app.use('/api/events', surveysRoutes);
    
    // Guests
    app.use('/api/guests', guestsRoutes);
    
    // Email (Módulo de Mailing V12.45)
    app.use('/api/email', emailRoutes);
    
// Settings
app.use('/api/settings', settingsRoutes);

// Sessions
app.use('/api/sessions', sessionsRoutes);

// Seat layouts
app.use('/api/seat-layouts', seatLayoutsRoutes);

// AI Security
app.use('/api/security', aiSecurityRoutes);

// Compliance & Data Governance (FS-02)
app.use('/api/compliance', complianceRoutes);

    // Webhooks (integraciones externas)
    app.use('/api/webhooks', webhooksRoutes);
    
    // Push notifications (Web Push API)
    app.use('/api/push', pushRoutes.router);
    app.use('/api/venues', venuesRoutes);

    // Payments (F3-07)
    app.use('/api', paymentsRoutes);

    // SMS (BL-13)
    app.use('/', smsRoutes);
    // Budget (BL-18)
    app.use('/api', budgetRoutes);
    // Speakers (BL-19)
    app.use('/api', speakersRoutes);
    // Proposals (BL-20)
    app.use('/api', proposalsRoutes);
    // Automation (C3-06)
    app.use('/api', automationRoutes);
    // Tenants / Multi-tenant (C3-07)
    app.use('/', tenantsRoutes);
    // Chatbot (C4-08)
    app.use('/', chatbotRoutes);
    // API Keys (C6-08)
    app.use('/', apikeysRoutes);
    // Deploy webhook (C6-14)
    app.use('/api', deployRoutes);
    // Change history undo/redo (C6-06)
    app.use('/api', changesRoutes);
    // Ecommerce integrations (C8-04)
    app.use('/api/ecommerce', ecommerceRoutes);
    // CRM integrations (C8-06)
    app.use('/api', crmRoutes);
    // Plugin system + Marketplace + Pricing (C8-09/10/11)
    app.use('/api', ecosystemRoutes);
    // Intelligence: tagging, prediction, recommendations (C9-03/04/05)
    app.use('/api', intelligenceRoutes);
    // Automation v2: business rules, workflows, sync (C9-06/07/02)
    app.use('/api', automationV2Routes);

    // Google Sheets Integration (F3-09)
    app.use('/api/google', googleRoutes.router);

    // Raffles / Sorteos (V12.45)
    app.use('/api/raffles', rafflesRoutes);

    // Polls / Live Polling (C11-01)
    app.use('/api/polls', pollsRoutes);

    // Leaderboard / Insignias (C11-01)
    app.use('/api/leaderboard', leaderboardRoutes);

    googleRoutes.startSyncWorker();

    // Stats (Dashboard Analítica)
    app.use('/api', statsRoutes);
    
    // Import/Export (V12.44.38)
    app.use('/api/import', upload.single('file'), importRoutes);
    app.use('/api/export', importRoutes);
    
    // Rutas públicas para páginas standalone
    app.get('/:slug/raffle/:id', (req, res) => {
        res.sendFile(path.join(rootDir, 'public/html/pages/wheel.html'));
    });
    app.get('/:slug/survey/:id', (req, res) => {
        res.sendFile(path.join(rootDir, 'public/html/pages/survey.html'));
    });
    app.get('/:slug/landing', (req, res) => {
        res.sendFile(path.join(rootDir, 'public/html/pages/landing.html'));
    });
    app.get('/:slug/portal', (req, res) => {
        res.sendFile(path.join(rootDir, 'public/html/pages/portal.html'));
    });
    app.get('/:slug/kiosko', (req, res) => {
        res.sendFile(path.join(rootDir, 'public/html/pages/kiosk.html'));
    });

    // SPA Catch-all: Cualquier ruta que no sea API sirve index.html
    // Esto permite que las rutas como /system/email, /event-config/123 funcionen
    app.use((req, res, next) => {
        // Ignorar si ya hay respuesta o es una ruta de API/archivos
        if (req.path.startsWith('/api/') || req.path.startsWith('/css/') || 
            req.path.startsWith('/js/') || req.path.startsWith('/html/') ||
            req.path.startsWith('/uploads/') || req.path.startsWith('/socket.io/') ||
            req.path.includes('.') || req.method !== 'GET') {
            return next();
        }
        
        // Para todas las demás rutas GET, servir index.html (SPA)
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.join(rootDir, 'index.html'));
    });

    console.log('✓ Rutas registradas (modulares)');
}

module.exports = { registerRoutes };
