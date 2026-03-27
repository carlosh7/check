/**
 * Utilidades del servidor
 * ⚠️ SECURITY: Validaciones críticas para prevenir SQL Injection
 * @module utils/helpers
 * @version 12.3.3
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');

// Tablas permitidas para castId - previene SQL injection en tableName
const ALLOWED_TABLES = new Set([
    'users', 'events', 'guests', 'groups', 'surveys', 'settings',
    'email_templates', 'email_logs', 'email_queue', 'webhooks',
    'user_events', 'group_users', 'pre_registrations', 'password_resets',
    'smtp_config', 'imap_config', 'event_email_config', 'event_email_templates',
    'event_agenda', 'audit_logs',
    'event_wheels', 'wheel_participants', 'wheel_spins', 'wheel_leads', 'wheel_results'
]);

/**
 * Genera un ID válido para una tabla
 * @param {string} tableName - Nombre de la tabla
 * @returns {string|null} UUID si la tabla usa TEXT ID, null si usa INTEGER
 */
function getValidId(tableName) {
    // Validar nombre de tabla permitido
    if (!ALLOWED_TABLES.has(tableName)) {
        console.warn(`[SECURITY] Intento de usar tabla no permitida: ${tableName}`);
        return null;
    }
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const idCol = info.find(c => c.name === 'id');
        return (idCol && idCol.type === 'INTEGER') ? null : uuidv4();
    } catch(e) { return uuidv4(); }
}

/**
 * Convierte y valida IDs para consultas de base de datos
 * @param {string} tableName - Nombre de la tabla
 * @param {string|number} id - ID a validar
 * @returns {number|string|null} ID validado o null si es inválido
 */
function castId(tableName, id) {
    if (id === null || id === undefined) return id;
    
    // Validar tabla permitida
    if (!ALLOWED_TABLES.has(tableName)) {
        console.warn(`[SECURITY] castId: Tabla no permitida: ${tableName}`);
        return null;
    }
    
    // Validar formato del ID
    const idStr = String(id).trim();
    
    // Verificar si es un UUID válido (formato estándar)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Verificar si es un número válido
    const numRegex = /^\d+$/;
    
    // Prevenir SQL injection en el ID mismo (caracteres peligrosos)
    if (/[;'"\\<>\/]/.test(idStr)) {
        console.warn(`[SECURITY] castId: Caracteres sospechosos en ID: ${idStr}`);
        return null;
    }
    
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const idCol = info.find(c => c.name === 'id');
        
        if (idCol && idCol.type === 'INTEGER') {
            // Tabla con ID numérico
            if (!numRegex.test(idStr)) {
                console.warn(`[SECURITY] castId: ID no válido para tabla numérica: ${idStr}`);
                return null;
            }
            return parseInt(idStr, 10);
        }
        
        // Tabla con ID UUID - verificar formato
        if (!uuidRegex.test(idStr)) {
            console.warn(`[SECURITY] castId: UUID malformado: ${idStr}`);
            return null;
        }
        
        return idStr;
    } catch(e) { 
        console.error('[SECURITY] castId error:', e.message);
        return null; 
    }
}

function successResponse(res, data = {}) {
    res.json({ success: true, ...data });
}

function errorResponse(res, status, message) {
    res.status(status).json({ success: false, error: message });
}

function getProducerGroups(userId) {
    try {
        const rows = db.prepare("SELECT group_id FROM group_users WHERE user_id = ?").all(userId);
        return rows.map(r => r.group_id).filter(Boolean);
    } catch(e) { return []; }
}

function hasEventAccess(userId, eventId, role) {
    if (role === 'ADMIN') return true;
    try {
        const event = db.prepare("SELECT group_id FROM events WHERE id = ?").get(eventId);
        if (!event) return false;
        if (event.group_id) {
            const groups = getProducerGroups(userId);
            return groups.includes(event.group_id);
        }
        const userEvents = db.prepare("SELECT 1 FROM user_events WHERE user_id = ? AND event_id = ?").get(userId, eventId);
        return !!userEvents;
    } catch(e) { return false; }
}

module.exports = {
    getValidId,
    castId,
    successResponse,
    errorResponse,
    getProducerGroups,
    hasEventAccess
};
