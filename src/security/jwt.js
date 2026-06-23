/**
 * JWT Utilities - Módulo de tokens JWT con blacklist
 * @module security/jwt
 * @version 12.44.765
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

if (!JWT_SECRET) {
    console.error('🔴 ERROR CRÍTICO: JWT_SECRET no está configurado en variables de entorno');
    console.error('   Configúralo en .env: JWT_SECRET=tu-clave-secreta');
    process.exit(1);
}

// Lazy-load de la BD para evitar circular dependency
let _db = null;
function getDb() {
    if (!_db) {
        try {
            _db = require('../../database').db;
        } catch (e) {
            console.error('[JWT] No se pudo cargar la BD para blacklist:', e.message);
        }
    }
    return _db;
}

/**
 * Genera un token JWT con jti único para blacklist
 */
function generateToken(payload) {
    const jti = uuidv4();
    return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' });
}

/**
 * Verifica un token JWT y检查a blacklist
 * @returns {Object|null} Payload decodificado o null si es inválido/blacklisted
 */
function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        if (decoded && decoded.jti && isTokenBlacklisted(decoded.jti)) {
            return null;
        }
        return decoded;
    } catch (err) {
        return null;
    }
}

/**
 * Agrega un token a la blacklist (revocación)
 * @param {string} token - Token JWT a revocar
 * @returns {boolean} true si se agregó, false si hubo error
 */
function blacklistToken(token) {
    const db = getDb();
    if (!db) return false;
    
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.jti) return false;
        
        const expiresAt = new Date(decoded.exp * 1000).toISOString();
        db.prepare("INSERT OR IGNORE INTO token_blacklist (token_jti, user_id, expires_at) VALUES (?, ?, ?)")
            .run(decoded.jti, decoded.userId || null, expiresAt);
        return true;
    } catch (e) {
        console.error('[JWT] Error adding to blacklist:', e.message);
        return false;
    }
}

/**
 * Verifica si un token está en la blacklist
 * @param {string} jti - JWT ID a verificar
 * @returns {boolean} true si está blacklisted
 */
function isTokenBlacklisted(jti) {
    const db = getDb();
    if (!db) return false;
    
    try {
        const row = db.prepare("SELECT 1 FROM token_blacklist WHERE token_jti = ?").get(jti);
        return !!row;
    } catch (e) {
        return false;
    }
}

/**
 * Limpia tokens expirados de la blacklist
 * @returns {number} Cantidad de tokens eliminados
 */
function cleanBlacklist() {
    const db = getDb();
    if (!db) return 0;
    
    try {
        const result = db.prepare("DELETE FROM token_blacklist WHERE expires_at < datetime('now')").run();
        return result.changes;
    } catch (e) {
        return 0;
    }
}

/**
 * Decodifica un token sin verificar (deprecated)
 * @deprecated Usar verifyToken()
 */
function decodeToken(token) {
    return jwt.decode(token);
}

module.exports = { generateToken, verifyToken, decodeToken, blacklistToken, isTokenBlacklisted, cleanBlacklist, JWT_SECRET };
