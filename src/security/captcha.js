/**
 * Enhanced CAPTCHA (v12.44.777)
 * Math-based CAPTCHA with expiration, rate limiting, and challenge variety
 */

const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.JWT_SECRET || 'fallback-key-for-captcha';

// Store recent CAPTCHAs to prevent replay (in-memory, bounded)
const recentCaptchas = new Map();
const CAPTCHA_EXPIRY = 300000; // 5 minutes
const MAX_STORED = 1000;

// Rate limiting: max 5 CAPTCHAs per IP per 10 minutes
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 600000; // 10 minutes
const RATE_LIMIT_MAX = 5;

function generateCaptcha(ip) {
    // Rate limit check
    const now = Date.now();
    const rateKey = ip || 'unknown';
    const rateEntry = rateLimitMap.get(rateKey) || { count: 0, firstAt: now };
    
    if (now - rateEntry.firstAt > RATE_LIMIT_WINDOW) {
        rateEntry.count = 0;
        rateEntry.firstAt = now;
    }
    
    if (rateEntry.count >= RATE_LIMIT_MAX) {
        return { error: 'Demasiadas solicitudes. Espera unos minutos.', token: null };
    }
    
    rateEntry.count++;
    rateLimitMap.set(rateKey, rateEntry);
    
    // Clean old entries periodically
    if (rateLimitMap.size > MAX_STORED) {
        for (const [k, v] of rateLimitMap) {
            if (now - v.firstAt > RATE_LIMIT_WINDOW) rateLimitMap.delete(k);
        }
    }
    
    // Generate math problem (3 levels of difficulty)
    const difficulty = Math.floor(Math.random() * 3);
    let question, answer;
    
    if (difficulty === 0) {
        // Easy: a + b
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        question = `${a} + ${b}`;
        answer = a + b;
    } else if (difficulty === 1) {
        // Medium: a * b
        const a = Math.floor(Math.random() * 9) + 2;
        const b = Math.floor(Math.random() * 9) + 2;
        question = `${a} × ${b}`;
        answer = a * b;
    } else {
        // Hard: a * b + c
        const a = Math.floor(Math.random() * 9) + 2;
        const b = Math.floor(Math.random() * 9) + 2;
        const c = Math.floor(Math.random() * 10) + 1;
        question = `${a} × ${b} + ${c}`;
        answer = a * b + c;
    }
    
    // Create signed token with timestamp
    const payload = { answer, ts: now };
    const signature = crypto.createHmac('sha256', ENCRYPTION_KEY)
        .update(JSON.stringify(payload)).digest('hex');
    const token = Buffer.from(JSON.stringify({ ...payload, sig: signature })).toString('base64');
    
    // Store for replay prevention
    recentCaptchas.set(token, now);
    
    // Clean old captchas
    if (recentCaptchas.size > MAX_STORED) {
        for (const [k, v] of recentCaptchas) {
            if (now - v > CAPTCHA_EXPIRY) recentCaptchas.delete(k);
        }
    }
    
    return { question, token };
}

function verifyCaptcha(token, userAnswer) {
    try {
        if (!token || !userAnswer) return { valid: false, reason: 'missing' };
        
        // Check replay
        if (!recentCaptchas.has(token)) {
            return { valid: false, reason: 'expired_or_used' };
        }
        
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
        
        // Verify signature
        const { sig, ...payload } = decoded;
        const expectedSig = crypto.createHmac('sha256', ENCRYPTION_KEY)
            .update(JSON.stringify(payload)).digest('hex');
        
        if (sig !== expectedSig) {
            return { valid: false, reason: 'invalid_signature' };
        }
        
        // Check expiration
        if (Date.now() - decoded.ts > CAPTCHA_EXPIRY) {
            recentCaptchas.delete(token);
            return { valid: false, reason: 'expired' };
        }
        
        // Check answer
        const userNum = parseInt(userAnswer, 10);
        if (isNaN(userNum)) {
            return { valid: false, reason: 'not_a_number' };
        }
        
        // Remove used token (prevent replay)
        recentCaptchas.delete(token);
        
        return { valid: userNum === decoded.answer };
    } catch (e) {
        return { valid: false, reason: 'parse_error' };
    }
}

module.exports = { generateCaptcha, verifyCaptcha };
