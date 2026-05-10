const rateLimit = require('express-rate-limit');
const { db } = require('../../database');

function skipLocal(req) {
    const ip = req.ip || '';
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' ||
        ip.startsWith('172.') || ip.startsWith('192.168.') || ip.startsWith('10.') || !ip;
}

function createLimiter(opts) {
    return rateLimit({
        windowMs: opts.windowMs || 15 * 60 * 1000,
        max: opts.max || 100,
        skip: skipLocal,
        message: opts.message || { error: 'Demasiadas peticiones. Espera unos segundos.' },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: opts.keyGenerator || undefined,
        ...opts.extra
    });
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
    sessions: createLimiter({ max: 200, message: { error: 'Demasiadas peticiones de sesiones' } }),
    venues: createLimiter({ max: 100, message: { error: 'Demasiadas peticiones de sedes' } }),
    chatbot: createLimiter({ max: 50, message: { error: 'Demasiadas peticiones al chatbot' } }),
    apikeys: createLimiter({ max: 50, message: { error: 'Demasiadas peticiones de API keys' } }),

    apiKeyLimit: createLimiter({
        max: 1000,
        message: { error: 'Demasiadas peticiones via API key' },
        keyGenerator: (req) => req.headers['x-api-key'] || req.ip
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
