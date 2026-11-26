const rateLimit = require('express-rate-limit');
const net = require('net');
const { db } = require('../../database');

// LEGACY — sustituida en v12.44.846 por skipExempt(). Se conserva sin cambios y SIN conectar
// (regla de no borrado). Eximía a rangos privados según req.ip, que se falsifica con
// X-Forwarded-For cuando se llega directo al puerto (trust proxy = 1 salto).
function skipLocal(req) {
    const ip = req.ip || '';
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' ||
        ip.startsWith('172.') || ip.startsWith('192.168.') || ip.startsWith('10.') || !ip;
}

// LEGACY — sustituida en v12.44.846 por getClientBucketKey(). Se conserva sin cambios y SIN
// conectar (regla de no borrado). Mezclaba el User-Agent en la clave anónima: bastaba rotarlo
// para reiniciar el contador.
function getClientKey(req) {
    // Use user ID if authenticated, fallback to IP + user-agent
    const userId = req.userId || (req.user && req.user.id) || (req.auth && req.auth.userId);
    if (userId) return 'user:' + userId;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || '';
    return 'ip:' + ip + '|' + ua.substring(0, 30);
}

// v12.44.846 (auditoría 2026-11-25, S10a): exenciones configurables y a prueba de cabeceras.
// RATE_LIMIT_EXEMPT_CIDRS = lista de CIDRs separada por comas (también vale una IP suelta).
//   - Vacía por defecto: NADIE queda exento (antes 127.0.0.1, ::1 y todo lo privado se saltaba el límite).
//   - Se compara contra la dirección del socket (req.socket.remoteAddress), nunca contra req.ip:
//     el cliente no puede cambiarla con X-Forwarded-For.
//   - NO añadir la dirección del proxy inverso (p. ej. la red de Docker): detrás de él TODAS las
//     peticiones llegan desde esa dirección y quedarían todas exentas.
//   - Una entrada mal escrita se ignora con aviso: eximir de menos es la dirección segura.
function loadExemptCidrs(raw) {
    const list = new net.BlockList();
    const entries = [];
    const invalid = [];
    String(raw || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((entry) => {
        const parts = entry.split('/');
        const ip = parts[0];
        const family = net.isIP(ip);
        const maxBits = family === 6 ? 128 : 32;
        const bits = parts.length === 2 ? Number(parts[1]) : maxBits;
        const wellFormed = (family === 4 || family === 6) && parts.length <= 2 &&
            Number.isInteger(bits) && bits >= 0 && bits <= maxBits;
        if (wellFormed) {
            try {
                list.addSubnet(ip, bits, family === 6 ? 'ipv6' : 'ipv4');
                entries.push(ip + '/' + bits);
                return;
            } catch (_) { /* cae abajo como inválida */ }
        }
        invalid.push(entry);
    });
    if (invalid.length > 0) {
        console.error('[RATE-LIMIT] RATE_LIMIT_EXEMPT_CIDRS: entradas inválidas IGNORADAS (no eximen a nadie): ' + invalid.join(', '));
    }
    if (entries.some((c) => c.endsWith('/0'))) {
        console.warn('🟠 [RATE-LIMIT] RATE_LIMIT_EXEMPT_CIDRS contiene una red /0: TODO el tráfico de esa familia queda exento y el límite deja de aplicar.');
    }
    return { list, entries };
}
const EXEMPT = loadExemptCidrs(process.env.RATE_LIMIT_EXEMPT_CIDRS);

function getSocketIp(req) {
    return (req.socket && req.socket.remoteAddress) || '';
}

function isExemptIp(ip) {
    const family = net.isIP(String(ip || ''));
    if (family === 4) return EXEMPT.list.check(ip, 'ipv4');
    if (family === 6) {
        if (EXEMPT.list.check(ip, 'ipv6')) return true;
        // ::ffff:a.b.c.d (IPv4 mapeada, lo habitual en un listener dual) se prueba también como IPv4
        const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
        return !!mapped && EXEMPT.list.check(mapped[1], 'ipv4');
    }
    return false;
}

function skipExempt(req) {
    try {
        return isExemptIp(getSocketIp(req));
    } catch (_) {
        return false; // si falla la evaluación, NO se salta el límite
    }
}

// v12.44.846 (auditoría 2026-11-25, S10a): clave del cubo sin datos que el cliente pueda rotar.
//   - Con sesión: user:<id> — req.userId solo lo fija authMiddleware tras verificar el JWT.
//   - Sin sesión: SOLO la IP (req.ip, la que resuelve Express según `trust proxy`; detrás del
//     proxy inverso la dirección del socket es la del proxy y todos compartirían un solo cubo).
function getClientBucketKey(req) {
    const userId = req.userId || (req.user && req.user.id) || (req.auth && req.auth.userId);
    if (userId) return 'user:' + userId;
    return 'ip:' + (req.ip || (req.socket && req.socket.remoteAddress) || 'unknown');
}

function createLimiter(opts) {
    const config = {
        windowMs: opts.windowMs || 15 * 60 * 1000,
        max: opts.max || 100,
        // v12.44.846 (auditoría 2026-11-25, S10a): era `skip: skipLocal` (rangos privados según req.ip,
        // falsificable con X-Forwarded-For). Ahora solo exime los CIDRs de RATE_LIMIT_EXEMPT_CIDRS,
        // comparados contra la dirección del socket.
        skip: skipExempt,
        message: opts.message || { error: 'Demasiadas peticiones. Espera unos segundos.' },
        standardHeaders: true,
        legacyHeaders: false,
        // v12.44.846 (auditoría 2026-11-25, S10a): era `getClientKey`, que sumaba el User-Agent a la
        // clave anónima (rotarlo reiniciaba el contador).
        keyGenerator: opts.keyGenerator || getClientBucketKey,
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
    // v12.44.846 (auditoría 2026-11-25, S10a): el informe decía `skipLocal: true` en duro, lo cual
    // ya no es cierto. Ahora refleja la realidad: la exención local está apagada y se listan los
    // CIDRs exentos configurados (vacío = nadie).
    return { limiters: entries, skipLocal: false, exemptCidrs: EXEMPT.entries.slice() };
}

module.exports = { limiters, getRateLimitStatus, createLimiter };
