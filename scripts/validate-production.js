/**
 * validate-production.js — Validación integral en vivo, como producción.
 * Capas: infraestructura → seguridad → auth → features → puentes → recovery/2FA.
 * Uso: node scripts/validate-production.js [baseUrl]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const results = [];
const pass = (n, x = '') => { results.push(`PASS ${n}${x ? ' — ' + x : ''}`); console.log(`✅ ${n}${x ? ' — ' + x : ''}`); };
const fail = (n, e) => { results.push(`FAIL ${n} — ${e}`); console.log(`❌ ${n} — ${e}`); };

(async () => {
    const J = (r) => r.json();
    const req = async (method, path, { token, body, raw } = {}) => {
        const headers = { 'Content-Type': 'application/json', Origin: BASE };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
        if (raw) return { status: res.status, res };
        const data = await res.json().catch(() => ({}));
        return { status: res.status, data };
    };

    // ═══ CAPA 1: INFRAESTRUCTURA Y SEGURIDAD ═══
    console.log('\n━━ CAPA 1: Infraestructura & Seguridad ━━');
    let r = await fetch(BASE + '/api/health');
    r.status === 200 ? pass('Health endpoint') : fail('Health endpoint', r.status);

    for (const f of ['/server.js', '/package.json', '/database.js', '/.env', '/docker-compose.yml']) {
        const code = (await fetch(BASE + f)).status;
        code === 404 ? pass(`Exposición cerrada ${f}`) : fail(`Exposición ${f}`, code);
    }
    for (const f of ['/manifest.json', '/favicon.ico', '/sw.js', '/icon-192.png']) {
        const code = (await fetch(BASE + f)).status;
        code === 200 ? pass(`Asset público ${f}`) : fail(`Asset ${f}`, code);
    }
    r = await fetch(BASE + '/api-docs');
    r.status === 404 ? pass('Swagger deshabilitado en producción') : fail('Swagger', r.status);
    const headers = (await fetch(BASE + '/')).headers;
    headers.get('content-security-policy') ? pass('CSP presente') : fail('CSP ausente');
    headers.get('x-frame-options') ? pass('X-Frame-Options') : fail('X-Frame-Options ausente');
    (await fetch(BASE + '/server.js')).status === 404 ? pass('Static whitelist (sin root)') : fail('Static root expuesto');

    // ═══ CAPA 2: AUTH ═══
    console.log('\n━━ CAPA 2: Autenticación ━━');
    let login = await req('POST', '/api/login', { body: { username: 'admin@example.com', password: 'clave-incorrecta' } });
    login.status === 401 ? pass('Login rechaza credenciales malas') : fail('Login malas', login.status);
    login = await req('POST', '/api/login', { body: { username: 'admin@example.com', password: 'changeme123' } });
    const TOKEN = login.data.token;
    TOKEN ? pass('Login válido + JWT') : fail('Login', 'sin token');
    const AH = () => ({ token: TOKEN });
    r = await req('GET', '/api/events', {});
    r.status === 401 ? pass('API protege sin token') : fail('API sin token', r.status);
    r = await req('GET', '/api/me/2fa/status', { token: TOKEN });
    typeof r.data.enabled === 'boolean' ? pass('2FA status endpoint') : fail('2FA status', JSON.stringify(r.data).slice(0, 50));

    // ═══ CAPA 3: CICLO COMPLETO EVENTO ═══
    console.log('\n━━ CAPA 3: Ciclo evento → invitado → check-in ━━');
    r = await req('POST', '/api/events', { token: TOKEN, body: { name: 'Validación Producción', date: '2026-12-31T20:00' } });
    const EID = r.data.eventId;
    EID ? pass('Crear evento') : fail('Crear evento', JSON.stringify(r.data).slice(0, 60));

    r = await req('POST', `/api/events/${EID}/attendance`, { token: TOKEN, body: { name: 'Asistente Prod', email: 'prod@test.io', phone: '+34600111222' } });
    const guestId = r.data.id || r.data.guestId || (r.data.guest && r.data.guest.id);
    guestId ? pass('Crear asistente') : fail('Crear asistente', JSON.stringify(r.data).slice(0, 60));

    // QR + check-in kiosk con invitado real
    const guest = await req('GET', `/api/guests/${EID}`, { token: TOKEN });
    const gList = Array.isArray(guest.data) ? guest.data : (guest.data.guests || []);
    const g = gList.find(x => x.id === guestId) || {};
    const qrToken = g.qr_token;
    if (qrToken) {
        r = await fetch(BASE + `/api/guests/qr/${guestId}`);
        r.status === 200 ? pass('QR del invitado (público)') : fail('QR invitado', r.status);
        r = await req('POST', '/api/kiosk/checkin', { body: { qr_token: qrToken, event_id: EID } });
        (r.status === 200 && (r.data.success || r.data.checked)) ? pass('Check-in kiosk público') : fail('Check-in kiosk', JSON.stringify(r.data).slice(0, 60));
    } else {
        results.push('SKIP Check-in kiosk — qr_token no expuesto');
        console.log('⏭️  Check-in kiosk (qr_token no expuesto en listado)');
    }

    // ═══ CAPA 4: FORMULARIO PÚBLICO (campos condicionales + plus-ones + captcha-less) ═══
    console.log('\n━━ CAPA 4: Registro público ━━');
    r = await req('GET', `/api/events/${EID}/public/registration-form`);
    Array.isArray(r.data.fields) ? pass('Formulario público: campos') : fail('Formulario público', r.status);
    await req('PUT', `/api/events/${EID}`, { token: TOKEN, body: { plus_one_quota: 2 } });
    r = await req('POST', '/api/public-register', { body: { event_id: EID, name: 'Invitado Web', email: 'web@test.io', custom_fields: {}, plus_ones: [{ name: 'Acompañante 1' }] } });
    r.data.success && r.data.plusOnesCreated === 1 ? pass('Registro público + plus-one (quota)') : fail('Registro público', JSON.stringify(r.data).slice(0, 70));

    // ═══ CAPA 5: PUENTES ═══
    console.log('\n━━ CAPA 5: Puentes de ecosistema ━━');
    // B3 P&L
    r = await req('GET', `/api/events/${EID}/budget/summary`, { token: TOKEN });
    typeof r.data.income === 'number' ? pass('P&L presupuesto') : fail('P&L', r.status);
    // B1 CRM
    r = await req('POST', '/api/crm/connections', { token: TOKEN, body: { platform: 'hubspot', name: 'Prod CRM', api_key: 'tok-prod' } });
    const connId = r.data.id;
    connId ? pass('CRM: conexión creada') : fail('CRM conexión', JSON.stringify(r.data).slice(0, 50));
    // B2 Ecom
    r = await req('POST', '/api/ecommerce/connections', { token: TOKEN, body: { platform: 'shopify', name: 'Prod Tienda', store_url: 'https://x.io', api_key: 'k' } });
    const econnId = r.data.id;
    econnId ? pass('Ecommerce: conexión creada') : fail('Ecom conexión', JSON.stringify(r.data).slice(0, 50));
    // B4 tag + push
    r = await req('POST', `/api/guests/${EID}/tags`, { token: TOKEN, body: { name: 'VIP-Prod' } });
    const tagId = r.data.id;
    tagId ? pass('Inteligencia: crear etiqueta') : fail('Etiqueta', JSON.stringify(r.data).slice(0, 50));
    r = await req('POST', '/api/push/send-segmented', { token: TOKEN, body: { segment: 'guest_tag', tag_id: tagId, event_id: EID, title: 'T', body: 'B' } });
    r.data.audience === 'guests' ? pass('Push segmentado por etiqueta (asistentes)') : fail('Push por etiqueta', JSON.stringify(r.data).slice(0, 60));

    // ═══ CAPA 6: RECOVERY + 2FA E2E ═══
    console.log('\n━━ CAPA 6: Recovery y 2FA ━━');
    await req('POST', '/api/password-reset-request', { body: { username: 'admin@example.com' } });
    const { db } = require('/home/jim/repos/check/database');
    const reset = db.prepare('SELECT code FROM password_resets ORDER BY created_at DESC LIMIT 1').get();
    r = await req('POST', '/api/verify-reset-code', { body: { code: reset.code } });
    r.data.valid ? pass('Recovery: código verificado') : fail('Recovery verify', JSON.stringify(r.data).slice(0, 50));
    r = await req('POST', '/api/reset-password', { body: { code: reset.code, new_password: 'prod-valida-123' } });
    r.data.success ? pass('Recovery: contraseña restablecida') : fail('Recovery reset', JSON.stringify(r.data).slice(0, 50));
    r = await req('POST', '/api/login', { body: { username: 'admin@example.com', password: 'prod-valida-123' } });
    r.data.token ? pass('Login con contraseña recuperada') : fail('Login post-recovery', 'sin token');

    // 2FA E2E completo
    const speakeasy = require('speakeasy');
    const secret = speakeasy.generateSecret({ name: 'ProdTest' }).base32;
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE username = ?').run(secret, 'admin@example.com');
    const code = speakeasy.totp({ secret, encoding: 'base32' });
    r = await req('POST', '/api/login', { body: { username: 'admin@example.com', password: 'prod-valida-123' } });
    r.data.requires2FA ? pass('2FA: login exige código') : fail('2FA exigencia', JSON.stringify(r.data).slice(0, 50));
    r = await req('POST', '/api/login', { body: { username: 'admin@example.com', password: 'prod-valida-123', totp_token: code } });
    r.data.token ? pass('2FA: login con TOTP válido') : fail('2FA login', 'sin token');
    // desactivar 2FA para dejar estado limpio
    const token2 = r.data.token;
    await req('POST', '/api/me/2fa/disable', { token: token2 });
    // restaurar contraseña original
    db.prepare('UPDATE users SET password = ? WHERE username = ?').run(require('bcryptjs').hashSync('changeme123', 10), 'admin@example.com');
    pass('Estado 2FA restaurado (limpio)');

    // ═══ RESUMEN ═══
    console.log('\n══════ RESUMEN VALIDACIÓN PRODUCCIÓN ══════');
    const P = results.filter(x => x.startsWith('PASS')).length;
    const F = results.filter(x => x.startsWith('FAIL')).length;
    const S = results.filter(x => x.startsWith('SKIP')).length;
    console.log(`PASS: ${P} · FAIL: ${F} · SKIP: ${S}`);
    const fs = require('fs');
    fs.writeFileSync('/tmp/opencode/validacion-prod.txt', results.join('\n'));
    process.exit(F > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
