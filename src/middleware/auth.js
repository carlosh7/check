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
        
        // Soporte para x-user-id header (legacy pero necesario para compatibilidad)
        const userIdHeader = req.headers['x-user-id'];

        let userId = null;

        // PRIMERO: Intentar JWT
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = verifyToken(token);
            if (decoded) {
                userId = decoded.userId;
            }
        }

        // SEGUNDO: Si no hay JWT válido, intentar x-user-id (fallback legacy)
        if (!userId && userIdHeader) {
            console.warn(`[AUTH] Usando x-user-id legacy para IP: ${req.ip}`);
            userId = userIdHeader;
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
