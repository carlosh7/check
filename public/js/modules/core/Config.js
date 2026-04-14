/**
 * modules/core/Config.js
 * Configuración global de la aplicación
 */

export const Config = {
    // Versión actual de la app
    VERSION: '12.44.366',
    
    // Configuración de API
    API_URL: '/api',
    
    // Configuración de debug
    DEBUG: true,
    
    // Configuración de caché
    CACHE_TTL: 300,
    CACHE_CHECK_PERIOD: 60,
    
    // Configuración de límites
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_GUESTS_PER_PAGE: 100,
    MAX_EVENTS_PER_PAGE: 50,
    
    // Configuración de UI
    TOAST_DURATION: 4000,
    ANIMATION_DURATION: 300,
    SIDEBAR_WIDTH: 240,
    SIDEBAR_COLLAPSED_WIDTH: 80,
    
    // Configuración de autenticación
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 horas
    
    // Configuración de eventos
    EVENT_STATES: ['active', 'upcoming', 'completed', 'draft', 'cancelled', 'inactive'],
    GUEST_STATES: ['pending', 'confirmed', 'checked-in', 'cancelled'],
    
    // URLs y paths
    ROUTES: {
        LOGIN: '/login',
        LOGOUT: '/logout',
        EVENTS: '/api/events',
        GUESTS: '/api/guests',
        USERS: '/api/users',
        GROUPS: '/api/groups',
    },
    
    // Métodos útiles
    isDebug() {
        return this.DEBUG && window.location.hostname === 'localhost';
    },
    
    getVersion() {
        return this.VERSION;
    },
    
    getApiUrl() {
        return this.API_URL;
    },
};

// Export default para compatibilidad
export default Config;