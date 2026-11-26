/**
 * Token de portal (v12.44.846 — auditoría 2026-11-25, hallazgo S12).
 *
 * El portal del asistente y el networking usaban `qr_token` como identidad pública. Pero qr_token es la
 * credencial del check-in: quien la conocía podía marcar asistencia por otro. Este token es un valor
 * derivado por asistente que NO sirve para check-in.
 *
 * Formato: `<guestId>.<firma>` — la firma es HMAC-SHA256(guestId) con PORTAL_TOKEN_SECRET (o JWT_SECRET
 * si no se define). Se verifica sin tocar la base de datos y no se puede falsificar sin el secreto.
 */
const crypto = require('crypto');

function secret() {
    const s = process.env.PORTAL_TOKEN_SECRET || process.env.JWT_SECRET;
    if (!s) throw new Error('Falta PORTAL_TOKEN_SECRET o JWT_SECRET para emitir tokens de portal');
    return s;
}

function sign(guestId) {
    return crypto.createHmac('sha256', secret()).update('portal:' + guestId).digest('hex').slice(0, 32);
}

function portalTokenFor(guestId) {
    if (!guestId) return null;
    return String(guestId) + '.' + sign(String(guestId));
}

function safeEqual(a, b) {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Devuelve el guestId del token si la firma es válida (y coincide con expectedGuestId, si se pide); si no, null.
function verifyPortalToken(token, expectedGuestId = null) {
    if (typeof token !== 'string' || token.length === 0 || token.length > 200) return null;
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;
    const guestId = token.slice(0, dot);
    try {
        if (!safeEqual(token.slice(dot + 1), sign(guestId))) return null;
    } catch (_) {
        return null;
    }
    if (expectedGuestId !== null && !safeEqual(guestId, expectedGuestId)) return null;
    return guestId;
}

module.exports = { portalTokenFor, verifyPortalToken };
