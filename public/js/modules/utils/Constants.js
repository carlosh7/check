/**
 * modules/utils/Constants.js
 * Constantes de la aplicación
 */

// Constantes de API
export const API_CONSTANTS = {
    URL: '/api',
    ENDPOINTS: {
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout',
        EVENTS: '/events',
        GUESTS: '/guests',
        USERS: '/users',
        GROUPS: '/groups',
        REGISTER: '/register',
        EMAIL: '/email',
        SURVEYS: '/surveys',
    },
};

// Constantes de eventos
export const EVENT_CONSTANTS = {
    ESTADOS: ['active', 'upcoming', 'completed', 'draft', 'cancelled', 'inactive'],
    LABELS: {
        active: 'Activo',
        upcoming: 'Próximo',
        completed: 'Finalizado',
        draft: 'Borrador',
        cancelled: 'Cancelado',
        inactive: 'Inactivo',
    },
    COLORES: {
        active: '#10b981',
        upcoming: '#3b82f6',
        completed: '#6b7280',
        draft: '#f59e0b',
        cancelled: '#ef4444',
        inactive: '#9ca3af',
    },
};

// Constantes de invitados
export const GUEST_CONSTANTS = {
    ESTADOS: ['pending', 'confirmed', 'checked-in', 'cancelled'],
    LABELS: {
        pending: 'Pendiente',
        confirmed: 'Confirmado',
        'checked-in': 'Check-in',
        cancelled: 'Cancelado',
    },
    COLORES: {
        pending: '#f59e0b',
        confirmed: '#3b82f6',
        'checked-in': '#10b981',
        cancelled: '#ef4444',
    },
};

// Constantes de roles
export const ROLE_CONSTANTS = {
    ROLES: ['ADMIN', 'PRODUCTOR', 'INVITADO'],
    LABELS: {
        ADMIN: 'Administrador',
        PRODUCTOR: 'Productor',
        INVITADO: 'Invitado',
    },
};

// Constantes de UI
export const UI_CONSTANTS = {
    SIDEBAR_WIDTH: 240,
    SIDEBAR_COLLAPSED_WIDTH: 80,
    TOAST_DURATION: 4000,
    ANIMATION_DURATION: 300,
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    PAGINATION: {
        GUESTS: 100,
        EVENTS: 50,
    },
};

// Constantes de columnas de invitados
export const COLUMN_CONFIG = {
    name: { label: 'Nombre', visible: true, order: 0 },
    email: { label: 'Email', visible: true, order: 1 },
    organization: { label: 'Empresa', visible: true, order: 2 },
    phone: { label: 'Teléfono', visible: false, order: 3 },
    position: { label: 'Cargo', visible: false, order: 4 },
    status: { label: 'Estado', visible: true, order: 5 },
};

// Funciones utilitarias
export const Utils = {
    // Normalizar texto para búsqueda
    normalize(text) {
        if (!text) return '';
        return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
    },
    
    // Highlight texto
    highlightText(text, term) {
        if (!text || !term) return text;
        const norm = this.normalize(text);
        const search = this.normalize(term);
        const idx = norm.indexOf(search);
        if (idx === -1) return text;
        return text.substring(0, idx) + '<mark class="bg-yellow-500/30 text-yellow-200 px-1 rounded">' + text.substring(idx, idx + term.length) + '</mark>' + text.substring(idx + term.length);
    },
    
    // Get event status
    getEventStatus(event) {
        if (!event) return 'draft';
        
        const now = new Date();
        const fecha = event.date ? new Date(event.date) : null;
        
        if (!fecha) return 'draft';
        if (event.status === 'cancelled') return 'cancelled';
        if (event.status === 'inactive') return 'inactive';
        
        if (now < fecha) {
            return event.status === 'draft' ? 'draft' : 'upcoming';
        }
        
        const endDate = event.end_date ? new Date(event.end_date) : null;
        if (endDate && now > endDate) return 'completed';
        
        if (event.has_checkin === 1 || event.has_guests === 1) {
            return 'active';
        }
        
        return 'completed';
    },
    
    // Format fecha
    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    },
    
    // Format hora
    formatTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    },
    
    // Format número
    formatNumber(num) {
        return new Intl.NumberFormat('es-ES').format(num);
    },
    
    // Debounce
    debounce(fn, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    },
    
    // Throttle
    throttle(fn, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
};

// Export todo
export const Constants = {
    API: API_CONSTANTS,
    EVENT: EVENT_CONSTANTS,
    GUEST: GUEST_CONSTANTS,
    ROLE: ROLE_CONSTANTS,
    UI: UI_CONSTANTS,
    COLUMNS: COLUMN_CONFIG,
    Utils: Utils,
};

export default Constants;