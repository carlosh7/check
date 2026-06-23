/**
 * Middleware de autenticación
 * Solo JWT soportado. El header x-user-id ha sido eliminado por seguridad.
 */

const { verifyToken } = require('../security/jwt');
const logger = require('../utils/logger');

let db;
const dbPath = require('path').resolve(__dirname, '../../database.js');
try {
    const mod = require(dbPath);
    db = mod.db;
    logger.info('[AUTH] DB loaded from database.js');
} catch (e) {
    logger.debug('[AUTH] Fallback to direct DB connection, error: ' + e.message);
    const Database = require('better-sqlite3');
    // Buscar en múltiples ubicaciones posibles
    const possiblePaths = [
        require('path').resolve(__dirname, '../../data/check_app.db'),
        require('path').resolve(__dirname, '../../check_app.db'),
        require('path').resolve(process.cwd(), 'data/check_app.db'),
        require('path').resolve(process.cwd(), 'check_app.db')
    ];
    let dbFile = null;
    for (const p of possiblePaths) {
        try {
            require('fs').accessSync(p);
            dbFile = p;
            break;
        } catch {}
    }
    if (dbFile) {
        db = new Database(dbFile);
        logger.info('[AUTH] DB loaded from: ' + dbFile);
    } else {
        logger.error('[AUTH] Database file not found in any location');
    }
}

function authMiddleware(roles = []) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;

        let userId = null;

        // JWT desde header Authorization o query param (para descargas directas)
        let token = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if (req.query.token) {
            token = req.query.token;
        }
        if (token) {
            const decoded = verifyToken(token);
            if (decoded) {
                userId = decoded.userId;
            }
        }

        if (!userId) {
            return res.status(401).json({ error: 'Token requerido. Usa Authorization: Bearer <token>' });
        }

        try {
            logger.debug('[AUTH DEBUG] Buscando usuario con ID: ' + userId);
            const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
            logger.debug('[AUTH DEBUG] Usuario encontrado: ' + (user ? user.username : 'NO ENCONTRADO'));
            if (!user) {
                return res.status(401).json({ error: 'Token inválido' });
            }

            if (user.status !== 'APPROVED') {
                return res.status(403).json({ error: 'Cuenta no aprobada' });
            }

            if (roles.length > 0 && !roles.includes(user.role)) {
                logger.warn('[AUTH] Rol del usuario: ' + user.role + ' Roles permitidos: ' + roles.join(', '));
                return res.status(403).json({ error: 'Acceso denegado' });
            }

            req.userId = user.id;
            req.userRole = user.role;
            req.user = user;
            req.userGroupId = user.group_id;
            next();
        } catch (e) {
            logger.error('[AUTH ERROR] ' + e.message);
            return res.status(401).json({ error: 'Error de autenticación' });
        }
    };
}

module.exports = { authMiddleware };
