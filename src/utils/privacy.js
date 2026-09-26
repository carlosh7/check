/**
 * Utilidades de privacidad y cumplimiento (Ley 1581 de 2012)
 * Fase L (v12.44.818): helpers usados por consentimiento, kiosco y export.
 */

const crypto = require('crypto');

/**
 * Enmascara un email preservando dominio: juan.perez@acme.com -> j***@acme.com
 * Minimización de datos para vistas públicas (kiosco).
 */
function maskEmail(email) {
    if (!email || typeof email !== 'string' || !email.includes('@')) return email || '';
    const at = email.indexOf('@');
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    return local.slice(0, 1) + '***@' + domain;
}

/**
 * Hash SHA-256 hex de un texto (prueba de versión exacta de política aceptada).
 */
function sha256Hex(text) {
    return crypto.createHash('sha256').update(String(text == null ? '' : text), 'utf8').digest('hex');
}

module.exports = { maskEmail, sha256Hex };
