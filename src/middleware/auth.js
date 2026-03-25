/**
 * Middleware de autenticación
 * ⚠️ SEGURIDAD: Solo JWT soportado desde v12.3
 * Legacy x-user-id header DEPRECADO - será eliminado en próxima versión
 */

const { verifyToken } = require('../security/jwt');

let db;
const dbPath = require('path').resolve(__dirname, '../../database.js');
try {
    const mod = require(dbPath);
    db = mod.db;
} catch (e) {
    const Database = require('better-sqlite3');
    db = new Database(require('path').resolve(__dirname, '../../check_app.db'));
}

function authMiddleware(roles = []) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        
        // DEPRECATED: x-user-id header - eliminado por seguridad
        // Un atacante puede impersonar cualquier usuario enviando este header
        const userIdHeader = req.headers['x-user-id'];
        if (userIdHeader) {
            console.warn(`[DEPRECATED] Legacy auth x-user-id usado por IP: ${req.ip}. Por favor actualice a JWT.`);
            // Por ahora permitimos pero con warning - en v12.4 rechazar completamente
            // return res.status(410).json({ error: 'Legacy auth eliminado. Usa JWT.' });
        }

        let userId = null;

        // SOLO JWT - única forma de autenticación válida
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = verifyToken(token);
            if (decoded) {
                userId = decoded.userId;
            }
        }

        if (!userId) {
            return res.status(401).json({ error: 'Token requerido. Usa Authorization: Bearer <token>' });
        }

        try {
            const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
            if (!user) {
                return res.status(401).json({ error: 'Token inválido' });
            }

            if (user.status !== 'APPROVED') {
                return res.status(403).json({ error: 'Cuenta no aprobada' });
            }

            if (roles.length > 0 && !roles.includes(user.role)) {
                return res.status(403).json({ error: 'Acceso denegado' });
            }

            req.userId = user.id;
            req.userRole = user.role;
            req.user = user;
            req.userGroupId = user.group_id;
            next();
        } catch (e) {
            console.log('[AUTH ERROR]', e.message);
            return res.status(401).json({ error: 'Error de autenticación' });
        }
    };
}

module.exports = { authMiddleware };
