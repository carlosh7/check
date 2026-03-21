/**
 * Índice de rutas
 * Carga todas las rutas del sistema
 */

const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const eventsRoutes = require('./events.routes');
const guestsRoutes = require('./guests.routes');
const emailRoutes = require('./email.routes');
const groupsRoutes = require('./groups.routes');
const surveysRoutes = require('./surveys.routes');
const settingsRoutes = require('./settings.routes');

function registerRoutes(app, io) {
    // Auth
    app.use('/api/login', authRoutes);
    app.use('/signup', authRoutes);
    app.use('/api/password-reset', authRoutes);
    
    // Users
    app.use('/api/users', usersRoutes);
    
    // Groups
    app.use('/api/groups', groupsRoutes);
    
    // Events
    app.use('/api/events', eventsRoutes);
    
    // Guests
    app.use('/api/guests', guestsRoutes);
    if (io) guestsRoutes.setIO(io);
    
    // Email
    app.use('/api/email', emailRoutes);
    
    // Settings
    app.use('/api/settings', settingsRoutes);
    
    console.log('✓ Rutas registradas (modulares)');
}

module.exports = { registerRoutes };
