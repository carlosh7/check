// rateLimiter.js - Protección contra abusos y ataques DDoS
const rateLimit = require('express-rate-limit');

// Rate Limiting General (API completa)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200, // Máximo 200 peticiones por IP cada 15 min
    message: { 
        error: 'Demasiadas peticiones. Por favor espera unos minutos antes de intentar nuevamente.',
        retryAfter: '15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate Limiting Estricto (Login y acciones críticas)
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20, // Máximo 20 intentos de login cada 15 min
    message: { 
        error: 'Demasiados intentos. Tu IP ha sido bloqueada temporalmente por seguridad.',
        retryAfter: '15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate Limiting para Check-in (Alta concurrencia)
const checkinLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 60, // Máximo 60 check-ins por minuto por IP
    message: { 
        error: 'Demasiados check-ins simultáneos. Intenta nuevamente en un momento.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { apiLimiter, strictLimiter, checkinLimiter };
