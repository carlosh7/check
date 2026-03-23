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
const emailRoutes = require('./email.routes');
const groupsRoutes = require('./groups.routes');
const surveysRoutes = require('./surveys.routes');
const settingsRoutes = require('./settings.routes');
const publicRoutes = require('./public.routes');
const versionRoutes = require('./version.routes');
const webhooksRoutes = require('./webhooks.routes');
const pushRoutes = require('./push.routes');

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

    // Public routes (unsubscribe)
    app.use('/', publicRoutes);
    
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
    
    // Email (SMTP, IMAP, templates, queue)
    app.use('/api', emailRoutes);
    
    // Settings
    app.use('/api/settings', settingsRoutes);
    
    // Webhooks (integraciones externas)
    app.use('/api/webhooks', webhooksRoutes);
    
    // Push notifications (Web Push API)
    app.use('/api/push', pushRoutes.router);
    
    console.log('✓ Rutas registradas (modulares)');
}

module.exports = { registerRoutes };
