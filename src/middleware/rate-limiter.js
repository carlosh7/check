const rateLimit = require('express-rate-limit');
const { db } = require('../../database');

function skipLocal(req) {
    const ip = req.ip || '';
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' ||
        ip.startsWith('172.') || ip.startsWith('192.168.') || ip.startsWith('10.') || !ip;
}

function getClientKey(req) {
    // Use user ID if authenticated, fallback to IP + user-agent
    var userId = req.userId || (req.user && req.user.id) || (req.auth && req.auth.userId);
    if (userId) return 'user:' + userId;
    var ip = req.ip || req.connection.remoteAddress || 'unknown';
    var ua = req.headers['user-agent'] || '';
    return 'ip:' + ip + '|' + ua.substring(0, 30);
}

function createLimiter(opts) {
    var config = {
        windowMs: opts.windowMs || 15 * 60 * 1000,
        max: opts.max || 100,
        skip: skipLocal,
        message: opts.message || { error: 'Demasiadas peticiones. Espera unos segundos.' },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: opts.keyGenerator || getClientKey,
        ...opts.extra
    };
    return rateLimit(config);
}

const limiters = {
    general: createLimiter({ max: 10000, message: { error: 'Demasiadas peticiones' } }),
    auth: createLimiter({ max: 50, message: { error: 'Demasiados intentos de login' } }),
    guests: createLimiter({ max: 500, message: { error: 'Demasiadas consultas de invitados' } }),
    uploads: createLimiter({ max: 30, message: { error: 'Demasiadas cargas de archivos' } }),
    email: createLimiter({ max: 100, message: { error: 'Demasiadas peticiones de email' } }),
    webhooks_out: createLimiter({ max: 200, message: { error: 'Demasiadas peticiones de webhooks' } }),
    stats: createLimiter({ max: 300, message: { error: 'Demasiadas consultas de estadisticas' } }),
    deploy: createLimiter({ max: 20, message: { error: 'Demasiadas peticiones de deploy' } }),
    compliance: createLimiter({ max: 100, message: { error: 'Demasiadas peticiones de compliance' } }),
    raffles: createLimiter({ max: 200, message: { error: 'Demasiadas peticiones de sorteos' } }),
    proposals: createLimiter({ max: 100, message: { error: 'Demasiadas peticiones de propuestas' } }),
    automation: createLimiter({ max: 100, message: { error: 'Demasiadas peticiones de automatizacion' } }),
    settings: createLimiter({ max: 100, message: { error: 'Demasiadas peticiones de configuracion' } }),
    surveys: createLimiter({ max: 200, message: { error: 'Demasiadas peticiones de encuestas' } }),
    polls: createLimiter({ max: 200, message: { error: 'Demasiadas peticiones de gamificación' } }),
    sessions: createLimiter({ max: 200, message: { error: 'Demasiadas peticiones de sesiones' } }),
    venues: createLimiter({ max: 100, message: { error: 'Demasiadas peticiones de sedes' } }),
    chatbot: createLimiter({ max: 50, message: { error: 'Demasiadas peticiones al chatbot' } }),
    apikeys: createLimiter({ max: 50, message: { error: 'Demasiadas peticiones de API keys' } }),

    apiKeyLimit: createLimiter({
        max: 1000,
        message: { error: 'Demasiadas peticiones via API key' },
        keyGenerator: (req) => req.headers['x-api-key'] || req.ip
    }),

    // Granular limiters for specific endpoints
    authLimiter: createLimiter({
        windowMs: 60 * 1000,
        max: 5,
        message: { error: 'Demasiados intentos de autenticación. Espera 1 minuto.' }
    }),
    importLimiter: createLimiter({
        windowMs: 60 * 1000,
        max: 3,
        message: { error: 'Demasiadas operaciones de importación. Espera 1 minuto.' }
    }),
    emailLimiter: createLimiter({
        windowMs: 60 * 1000,
        max: 10,
        message: { error: 'Demasiados envíos de email. Espera 1 minuto.' }
    }),
    webhookLimiter: createLimiter({
        windowMs: 60 * 1000,
        max: 20,
        message: { error: 'Demasiadas peticiones de webhooks. Espera 1 minuto.' }
    })
};

function getRateLimitStatus() {
    const entries = Object.entries(limiters).map(([name, limiter]) => ({
        name,
        max: limiter.max,
        windowMs: limiter.windowMs
    }));
    return { limiters: entries, skipLocal: true };
}

module.exports = { limiters, getRateLimitStatus, createLimiter };
