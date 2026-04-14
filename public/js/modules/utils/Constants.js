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

// Export todo
export const Constants = {
    API: API_CONSTANTS,
    EVENT: EVENT_CONSTANTS,
    GUEST: GUEST_CONSTANTS,
    ROLE: ROLE_CONSTANTS,
    UI: UI_CONSTANTS,
    COLUMNS: COLUMN_CONFIG,
};

export default Constants;