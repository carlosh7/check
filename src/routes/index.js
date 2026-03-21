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

function registerRoutes(app, io, rootDir) {
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
    
    // Static files
    app.use('/uploads', express.static(path.join(rootDir, 'uploads')));
    
    // Auth (login, signup, password reset)
    app.use('/api', authRoutes);
    
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
    if (io) guestsRoutes.setIO(io);
    
    // Email (SMTP, IMAP, templates, queue)
    app.use('/api', emailRoutes);
    
    // Settings
    app.use('/api/settings', settingsRoutes);
    
    console.log('✓ Rutas registradas (modulares)');
}

module.exports = { registerRoutes };
