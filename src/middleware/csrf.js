/**
 * Middleware de protección CSRF para API REST
 * 
 * Para APIs basadas en JWT, la protección CSRF tradicional no aplica igual.
 * Este middleware implementa:
 * 1. Verificación de Origin header en requests cross-origin
 * 2. Bloqueo de requests sin origin ni referer en ciertos endpoints
 */

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8080').split(',');

// Endpoints que requieren verificación CSRF (state-changing)
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const CSRF_PROTECTED_PATHS = [
    '/api/users', '/api/events', '/api/guests', '/api/groups', '/api/clients',
    '/api/settings', '/api/email', '/api/webhooks'
];

function isCSRFProtectedPath(reqPath) {
    return CSRF_PROTECTED_PATHS.some(p => reqPath.startsWith(p));
}

function csrfMiddleware(req, res, next) {
    // Solo proteger métodos que modifican estado
    if (!CSRF_PROTECTED_METHODS.includes(req.method)) {
        return next();
    }
    
    // Solo proteger paths sensibles
    if (!isCSRFProtectedPath(req.path)) {
        return next();
    }
    
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    
    // Requests desde el mismo origen (same-origin) siempre permitidos
    if (!origin) {
        // Sin origin header - podría ser same-origin request
        // Verificar referer como backup
        if (referer) {
            try {
                const refererUrl = new URL(referer);
                const refererOrigin = refererUrl.origin;
                if (ALLOWED_ORIGINS.includes(refererOrigin)) {
                    return next();
                }
            } catch (e) {
                // URL inválida, rechazar
                return res.status(403).json({ 
                    error: 'CSRF protection: Invalid referer',
                    code: 'INVALID_REFERRER'
                });
            }
        }
        // Same-origin request sin headers especiales - permitir
        return next();
    }
    
    // Request con Origin header - verificar que esté en whitelist
    if (ALLOWED_ORIGINS.includes(origin)) {
        return next();
    }
    
    // Origin no permitido - posible ataque CSRF
    console.warn(`[CSRF] Blocked request from untrusted origin: ${origin}`);
    return res.status(403).json({ 
        error: 'Origen no permitido',
        code: 'CSRF_ORIGIN_BLOCKED'
    });
}

// Headers de seguridad adicionales
function securityHeaders(req, res, next) {
    // Prevenir clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevenir XSS del navegador
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevenir MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy (reducir capacidades del navegador)
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Deshabilitar caching de respuestas API (para datos sensibles)
    if (req.path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
    }
    
    next();
}

module.exports = { csrfMiddleware, securityHeaders, ALLOWED_ORIGINS };