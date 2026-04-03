/**
 * Índice de rutas
 * Carga todas las rutas del sistema
 */

const express = require('express');
const multer = require('multer');
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const eventsRoutes = require('./events.routes');
const guestsRoutes = require('./guests.routes');
const emailRoutes = require('./email.routes'); // MÓDULO DE MAILING (V12.45)
const groupsRoutes = require('./groups.routes');
const surveysRoutes = require('./surveys.routes');
const settingsRoutes = require('./settings.routes');
const publicRoutes = require('./public.routes');
const versionRoutes = require('./version.routes');
const webhooksRoutes = require('./webhooks.routes');
const pushRoutes = require('./push.routes');
const statsRoutes = require('./stats.routes');
const importRoutes = require('./import.routes');

// Configuración segura de multer
const upload = multer({
    dest: 'uploads/',
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
    
    // Webhooks (integraciones externas)
    app.use('/api/webhooks', webhooksRoutes);
    
    // Push notifications (Web Push API)
    app.use('/api/push', pushRoutes.router);
    
    // Stats (Dashboard Analítica)
    app.use('/api', statsRoutes);
    
    // Import/Export (V12.44.38)
    app.use('/api/import', upload.single('file'), importRoutes);
    app.use('/api/export', importRoutes);
    
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
