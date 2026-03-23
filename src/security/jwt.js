/**
 * JWT Utilities - Módulo de tokens JWT
 * @module security/jwt
 * @version 12.3.1
 */

const jwt = require('jsonwebtoken');

// JWT_SECRET - CRÍTICO: Debe configurarse en variables de entorno
// En producción, NUNCA usar valores por defecto
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Validación de seguridad en startup
if (!JWT_SECRET) {
    console.error('🔴 ERROR CRÍTICO: JWT_SECRET no está configurado en variables de entorno');
    console.error('   Para entornos de desarrollo, añade: JWT_SECRET=tu-clave-secreta');
    console.error('   Para producción, usa un secret seguro (mínimo 32 caracteres)');
    // En producción, lanzar error fatal
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
    // En desarrollo, usar fallback inseguro PERO con warning claro
    console.warn('⚠️  ADVERTENCIA: Usando JWT_SECRET de desarrollo. NO usar en producción!');
}

/**
 * Genera un token JWT
 * @param {Object} payload - Datos a incluir en el token
 * @param {string} payload.userId - ID del usuario
 * @param {string} payload.username - Email del usuario
 * @param {string} payload.role - Rol del usuario
 * @returns {string} Token JWT firmado
 */
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET || 'dev-secret-do-not-use-in-prod', { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifica y decodifica un token JWT
 * @param {string} token - Token JWT a verificar
 * @returns {Object|null} Payload decodificado o null si es inválido
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET || 'dev-secret-do-not-use-in-prod');
    } catch (err) {
        return null;
    }
}

/**
 * Decodifica un token sin verificar la firma
 * @param {string} token - Token JWT a decodificar
 * @returns {Object|null} Payload decodificado o null
 * @deprecated Usar verifyToken() para verificación segura
 */
function decodeToken(token) {
    return jwt.decode(token);
}

module.exports = { generateToken, verifyToken, decodeToken, JWT_SECRET };
