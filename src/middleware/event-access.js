/**
 * Control de acceso por evento (v12.44.848 — auditoría 2026-11-25, hallazgo S11).
 *
 * Uso, siempre después del middleware de autenticación:
 *   router.get('/events/:eventId/x', authMiddleware(['ADMIN', 'PRODUCTOR']), requireEventAccess(), handler)
 *
 * ADMIN pasa siempre. El resto necesita ser dueño del evento, estar asignado (user_events) o
 * pertenecer al grupo del evento — la misma regla que el listado de eventos del usuario.
 */
const { castId, hasEventAccess } = require('../utils/helpers');

function requireEventAccess(paramName = 'eventId') {
    return function(req, res, next) {
        if (req.userRole === 'ADMIN') return next();
        const eventId = castId('events', req.params[paramName]);
        if (!eventId) return res.status(400).json({ error: 'ID de evento inválido' });
        if (!hasEventAccess(req.userId, eventId, req.userRole)) {
            return res.status(403).json({ error: 'No tienes acceso a este evento' });
        }
        next();
    };
}

module.exports = { requireEventAccess };
