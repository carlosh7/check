/**
 * Middleware de autenticación
 * Soporta dos métodos: x-user-id (frontend) y Authorization: Bearer (modular)
 */

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
        let userId = req.headers['x-user-id'] || req.headers.authorization?.replace('Bearer ', '');
        
        if (!userId) {
            return res.status(401).json({ error: 'Token requerido' });
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
