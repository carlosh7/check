/**
 * Logger de seguridad
 * Sanitiza datos sensibles antes de loguear
 */

const SENSITIVE_FIELDS = new Set([
    'password', 'pass', 'pwd', 'secret', 'token', 'jwt', 
    'access_token', 'refresh_token', 'api_key', 'apikey',
    'smtp_pass', 'smtp_password', 'imap_pass', 'imap_password',
    'private_key', 'privatekey', 'credit_card', 'cvv'
]);

/**
 * Sanitiza un objeto reemplazando valores sensibles
 * @param {Object} data - Datos a sanitizar
 * @returns {Object} - Datos sanitizados
 */
function sanitizeForLog(data) {
    if (!data || typeof data !== 'object') {
        return data;
    }
    
    const sanitized = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        
        // Verificar si es un campo sensible
        const isSensitive = SENSITIVE_FIELDS.has(lowerKey) || 
            SENSITIVE_FIELDS.some(field => lowerKey.includes(field));
        
        if (isSensitive) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeForLog(value);
        } else if (typeof value === 'string') {
            // También sanitizar strings que parezcan tokens
            if (value.length > 50 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
                sanitized[key] = value.substring(0, 20) + '...[REDACTED]';
            } else {
                sanitized[key] = value;
            }
        } else {
            sanitized[key] = value;
        }
    }
    
    return sanitized;
}

/**
 * Loguea con sanitización automática
 * @param {string} level - Nivel (info, warn, error, debug)
 * @param {string} message - Mensaje
 * @param {Object} data - Datos a loguear
 */
function log(level, message, data = {}) {
    const sanitized = sanitizeForLog(data);
    const prefix = `[${level.toUpperCase()}]`;
    
    switch (level) {
        case 'error':
            console.error(prefix, message, sanitized);
            break;
        case 'warn':
            console.warn(prefix, message, sanitized);
            break;
        case 'debug':
            console.debug(prefix, message, sanitized);
            break;
        default:
            console.log(prefix, message, sanitized);
    }
}

// Métodos convenience
const logger = {
    info: (msg, data) => log('info', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
    debug: (msg, data) => log('debug', msg, data),
    sanitize: sanitizeForLog
};

module.exports = logger;