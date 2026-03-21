/**
 * Middleware de autenticación
 */

const { db } = require('../database');

function authMiddleware(roles = []) {
    return (req, res, next) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Token requerido' });
        }
        
        try {
            const user = db.prepare("SELECT * FROM users WHERE id = ?").get(token);
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
            next();
        } catch (e) {
            return res.status(401).json({ error: 'Error de autenticación' });
        }
    };
}

module.exports = { authMiddleware };
