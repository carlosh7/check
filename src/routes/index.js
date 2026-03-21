/**
 * Índice de rutas
 * Carga todas las rutas del sistema
 */

const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const eventsRoutes = require('./events.routes');

function registerRoutes(app) {
    // Auth
    app.use('/api/login', authRoutes);
    app.use('/signup', authRoutes);
    app.use('/api/password-reset', authRoutes);
    
    // Users
    app.use('/api/users', usersRoutes);
    
    // Events
    app.use('/api/events', eventsRoutes);
    
    console.log('✓ Rutas registradas');
}

module.exports = { registerRoutes };
