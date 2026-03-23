/**
 * JWT Utilities
 * Generación y verificación de tokens JWT
 */

const jwt = require('jsonwebtoken');

// JWT_SECRET - CRÍTICO: Debe configurarse en变量 de entorno
// En producción, NUNCA usar valores por defecto
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Validación de seguridad en startup
if (!JWT_SECRET) {
    console.error('🔴 ERROR CRÍTICO: JWT_SECRET no está configurado en variables de entorno');
    console.error('   Para entornos de desarrollo, añade: JWT_SECRET=tu-clave-secreta');
    console.error('   Para producción, usa un secret seguro (mínimo 32 caracteres)');
    // En producción, lanzar error致命
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
    // En desarrollo, usar fallback inseguro PERO con warning claro
    console.warn('⚠️  ADVERTENCIA: Usando JWT_SECRET de desarrollo. NO usar en producción!');
}

function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET || 'dev-secret-do-not-use-in-prod', { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

function decodeToken(token) {
    return jwt.decode(token);
}

module.exports = { generateToken, verifyToken, decodeToken, JWT_SECRET };
