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

// P1-2 auditoría 2026-08: detectar placeholder débil conocido (tokens falsificables)
const WEAK_JWT_SECRETS = ['genera_una_clave_unica', 'changeme', 'secret', 'change_me'];
if (WEAK_JWT_SECRETS.includes(String(JWT_SECRET).trim())) {
    console.error('🔴 CRÍTICO: JWT_SECRET usa un valor débil público. Cualquiera puede falsificar tokens.');
    console.error('   Solución inmediata: ejecuta "npm run postinstall" o genera uno con: openssl rand -hex 48');
    console.error('   y colócalo en .env → JWT_SECRET=<valor>. Luego reinicia (las sesiones se invalidan).');
}

// v12.44.846 (auditoría 2026-11-25, H7): el bloque de arriba solo avisaba y la app arrancaba igual
// con un JWT_SECRET débil. HS256 firma con ese valor: quien lo conozca falsifica tokens de cualquier
// usuario (ADMIN incluido). Ahora "débil" es: placeholder conocido (la lista de arriba más los
// mismos patrones que ya rota scripts/bootstrap-env.js, sin distinguir mayúsculas), longitud menor
// que JWT_SECRET_MIN_LENGTH o un único carácter repetido.
//   - NODE_ENV=production  → se aborta el arranque (process.exit(1)).
//   - cualquier otro entorno → solo avisa (desarrollo y tests siguen arrancando).
//   - ALLOW_WEAK_JWT_SECRET=true → arranca aunque sea débil; solo para salir del paso.
// El valor del secreto nunca se imprime.
const JWT_MIN_LENGTH_RAW = String(process.env.JWT_SECRET_MIN_LENGTH || '').trim();
const JWT_MIN_LENGTH_PARSED = JWT_MIN_LENGTH_RAW === '' ? 32 : Number(JWT_MIN_LENGTH_RAW);
const JWT_SECRET_MIN_LENGTH = Number.isInteger(JWT_MIN_LENGTH_PARSED) && JWT_MIN_LENGTH_PARSED >= 0 ? JWT_MIN_LENGTH_PARSED : 32;
if (JWT_MIN_LENGTH_RAW !== '' && !/^\d+$/.test(JWT_MIN_LENGTH_RAW)) {
    console.warn(`🟠 [JWT] JWT_SECRET_MIN_LENGTH="${JWT_MIN_LENGTH_RAW}" no es un entero ≥ 0; se usa 32.`);
}

const WEAK_JWT_SECRET_PATTERNS = [
    /^genera_una_clave/i, // placeholder de .env.example y README
    /^tu_clave/i,         // install.sh
    /^changeme$/i,
    /^change[-_]?me$/i,
    /^secret$/i
];

const JWT_SECRET_TRIMMED = String(JWT_SECRET).trim();
const JWT_WEAK_REASONS = [];
if (WEAK_JWT_SECRET_PATTERNS.some((re) => re.test(JWT_SECRET_TRIMMED))) JWT_WEAK_REASONS.push('es un valor de ejemplo público (placeholder)');
if (JWT_SECRET_MIN_LENGTH > 0 && JWT_SECRET_TRIMMED.length < JWT_SECRET_MIN_LENGTH) JWT_WEAK_REASONS.push('mide menos de ' + JWT_SECRET_MIN_LENGTH + ' caracteres');
if (/^(.)\1+$/.test(JWT_SECRET_TRIMMED)) JWT_WEAK_REASONS.push('es un solo carácter repetido');

if (JWT_WEAK_REASONS.length > 0) {
    const JWT_WEAK_ALLOWED = /^(1|true|yes|on)$/i.test(String(process.env.ALLOW_WEAK_JWT_SECRET || '').trim());
    const JWT_WEAK_FIX = 'Genera uno nuevo con "openssl rand -hex 48", ponlo en .env como JWT_SECRET=<valor> y reinicia (al rotarlo se cierran todas las sesiones abiertas).';
    if (process.env.NODE_ENV === 'production' && !JWT_WEAK_ALLOWED) {
        console.error('🔴 FATAL: JWT_SECRET débil (' + JWT_WEAK_REASONS.join('; ') + ').');
        console.error('   Con ese valor cualquiera puede firmar tokens de cualquier usuario, ADMIN incluido.');
        console.error('   La aplicación NO arranca en producción (NODE_ENV=production).');
        console.error('   Solución: ' + JWT_WEAK_FIX);
        console.error('   Salida de emergencia (NO recomendada): ALLOW_WEAK_JWT_SECRET=true arranca igual con el secreto débil.');
        process.exit(1);
    }
    if (JWT_WEAK_ALLOWED) {
        console.error('🟠 [JWT] JWT_SECRET débil (' + JWT_WEAK_REASONS.join('; ') + ') PERMITIDO explícitamente por ALLOW_WEAK_JWT_SECRET. Rota el secreto y retira esa variable cuanto antes.');
    } else {
        console.warn('🟠 [JWT] JWT_SECRET débil (' + JWT_WEAK_REASONS.join('; ') + '). En producción (NODE_ENV=production) el arranque se aborta. ' + JWT_WEAK_FIX);
    }
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
 * Verifica un token JWT y consulta la blacklist
 * @returns {Object|null} Payload decodificado o null si es inválido/blacklisted
 */
function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        if (decoded && decoded.jti && isTokenBlacklisted(decoded.jti)) {
            return null;
        }
        // v12.44.846 (auditoría 2026-11-25, revocación JWT): un token firmado y no blacklistado
        // seguía valiendo después de que el usuario resetease o cambiase su clave. Ahora también
        // se rechaza si nació antes de users.token_valid_after (fail-closed si la BD no responde).
        if (isTokenRevokedByPasswordChange(decoded)) {
            return null;
        }
        return decoded;
    } catch (err) {
        return null;
    }
}

/**
 * v12.44.846 (auditoría 2026-11-25, revocación JWT): instante ISO 8601, con precisión de 1 segundo
 * (la misma que el `iat` del JWT), desde el que los tokens de un usuario son válidos.
 * Un token emitido en el mismo segundo que el cambio de clave NO se rechaza: `iat` no permite
 * ordenar dentro de un mismo segundo y primar aquí cerraría la sesión recién abierta tras el login.
 * @returns {string} ISO 8601 truncado al segundo
 */
function tokenValidAfterNow() {
    return new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
}

/**
 * v12.44.846 (auditoría 2026-11-25, revocación JWT): revoca todos los tokens emitidos hasta ahora
 * para el usuario; los que se emitan después siguen valiendo. Se llama al resetear o cambiar la clave.
 * Lanza si la BD no está disponible o la escritura falla: quien cambia una clave no debe creer que
 * sus sesiones se cerraron si no ocurrió (la ruta responde 500).
 * @param {string} userId
 * @returns {number} filas actualizadas
 */
function revokeUserTokens(userId) {
    const db = getDb();
    if (!db) throw new Error('[JWT] BD no disponible: no se pudieron revocar los tokens del usuario ' + userId);
    return db.prepare("UPDATE users SET token_valid_after = ? WHERE id = ?").run(tokenValidAfterNow(), String(userId)).changes;
}

/**
 * v12.44.846 (auditoría 2026-11-25, revocación JWT): ¿el token nació antes del último cambio de
 * clave de su usuario (users.token_valid_after)? Fail-closed: sin BD, con el valor guardado
 * ilegible o sin `iat` que permita probar que el token es posterior, se considera revocado.
 * Única excepción: columna inexistente (esquema sin migrar) — ahí no puede haber revocaciones registradas.
 * Tokens sin userId no tienen usuario contra el que comprobar (no cambia su comportamiento).
 * @param {object} decoded - payload ya verificado por jwt.verify
 * @returns {boolean} true si el token debe rechazarse
 */
function isTokenRevokedByPasswordChange(decoded) {
    if (!decoded || typeof decoded !== 'object' || !decoded.userId) return false;
    const db = getDb();
    if (!db) {
        console.error('[JWT] BD no disponible: no se puede comprobar token_valid_after del usuario ' + decoded.userId + '; token tratado como revocado (fail-closed)');
        return true;
    }
    try {
        const row = db.prepare("SELECT token_valid_after FROM users WHERE id = ?").get(String(decoded.userId));
        // Sin usuario o sin cambios de clave registrados: nada que revocar
        if (!row || !row.token_valid_after) return false;
        const validAfterMs = Date.parse(row.token_valid_after);
        if (!Number.isFinite(validAfterMs)) {
            console.error('[JWT] token_valid_after ilegible para el usuario ' + decoded.userId + '; token tratado como revocado (fail-closed)');
            return true;
        }
        const iatMs = typeof decoded.iat === 'number' && Number.isFinite(decoded.iat) ? decoded.iat * 1000 : NaN;
        if (!Number.isFinite(iatMs)) {
            console.error('[JWT] token sin iat válido para el usuario ' + decoded.userId + '; token tratado como revocado (fail-closed)');
            return true;
        }
        return iatMs < validAfterMs;
    } catch (e) {
        // Esquema sin migrar (la columna no existe en esta BD): no puede haber revocaciones
        // registradas, no hay nada que exigir. Se avisa en cada comprobación, pero NO se deja a todo
        // el mundo sin poder entrar por un ALTER que no llegó a aplicarse.
        if (/no such (column|table)/i.test(String(e && e.message))) {
            console.error('[JWT] Falta users.token_valid_after en la BD (migración de esquema no aplicada): la revocación de tokens por cambio de clave NO está activa');
            return false;
        }
        console.error('[JWT] Error comprobando token_valid_after del usuario ' + decoded.userId + '; token tratado como revocado (fail-closed):', e.message);
        return true;
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
    // v12.44.846 (auditoría 2026-11-25, H7): era fail-open (sin BD o con error de consulta devolvía
    // `false` y el token pasaba como válido). Ahora fail-closed: si no se puede consultar la lista
    // de revocados, el token se considera revocado y el fallo queda registrado.
    if (!db) {
        console.error('[JWT] BD no disponible: no se puede comprobar la blacklist; token tratado como revocado (fail-closed)');
        return true;
    }
    
    try {
        const row = db.prepare("SELECT 1 FROM token_blacklist WHERE token_jti = ?").get(jti);
        return !!row;
    } catch (e) {
        console.error('[JWT] Error consultando la blacklist; token tratado como revocado (fail-closed):', e.message);
        return true;
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

// v12.44.846 (auditoría 2026-11-25, revocación JWT): helpers nuevos para las rutas que cambian claves
module.exports = {
    generateToken, verifyToken, decodeToken, blacklistToken, isTokenBlacklisted, cleanBlacklist, JWT_SECRET,
    tokenValidAfterNow, revokeUserTokens, isTokenRevokedByPasswordChange
};
