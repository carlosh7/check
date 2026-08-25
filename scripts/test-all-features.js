// test-all-features.js — Batería E2E por grupos: A=core/evento · B=config-tabs · C=sistema
// Uso: node scripts/test-all-features.js [ALL|A|B|C]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = '/tmp/opencode/e2e';
fs.mkdirSync(OUT, { recursive: true });
const GROUP = (process.argv[2] || 'ALL').toUpperCase();
const ADMIN_USER = process.env.E2E_USER || 'admin@example.com';
const ADMIN_PASS = process.env.E2E_PASS || 'changeme123';
const results = [];
const consoleErrors = [];
const apiErrors = [];
const ok = (n, x = '') => { results.push(`PASS ${n}${x ? ' — ' + x : ''}`); console.log(`✅ ${n}${x ? ' — ' + x : ''}`); };
const fail = (n, e) => { results.push(`FAIL ${n} — ${e}`); console.log(`❌ ${n} — ${e}`); };
const skip = (n, e) => { results.push(`SKIP ${n} — ${e}`); console.log(`⏭️  ${n} — ${e}`); };

(async () => {
    const BASE = 'http://localhost:3000';
    const HEADLESS = !process.env.XVFB; // XVFB=1 → renderer con GUI bajo Xvfb (estable)
    const browser = await chromium.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: HEADLESS,
        args: HEADLESS ? ['--no-sandbox'] : ['--no-sandbox', '--disable-gpu']
    });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    let page;

    async function freshLogin() {
        page = await ctx.newPage();
        // Headless sin GPU: el compositor crashea con backdrop-filter/animaciones de Swal
        await page.addInitScript(() => {
            const st = document.createElement('style');
            st.textContent = '.swal2-container,.swal2-popup,.swal2-backdrop-show{backdrop-filter:none!important;animation:none!important;transition:none!important}';
            document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
        });
        page.setDefaultTimeout(12000);
        page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 150)); });
        page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 200)));
        page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400 && !r.url().includes('/api/health')) apiErrors.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`); });
        await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
        await page.fill('#login-email', ADMIN_USER);
        await page.fill('#login-password', ADMIN_PASS);
        await page.click('#login-btn');
        await page.waitForSelector('#app-container', { timeout: 20000 });
    }
    async function selectEvent() {
        await page.evaluate(() => {
            const link = Array.from(document.querySelectorAll('a[onclick*="openEvent"]')).find(a => a.innerText.includes('Evento Batería Total'));
            if (link) link.click();
        });
        await page.waitForTimeout(1600);
    }
    async function closeModals() {
        await page.evaluate(() => {
            document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
            document.querySelectorAll('.swal2-container').forEach(c => c.remove());
        });
    }
    const eventId = async () => page.evaluate(() => window.App?.state?.event?.id || null);
    // Reintento solo ante muerte del renderer (crash intermitente del headless con DOM gigante)
    const withRetry = async (name, fn) => {
        for (let a = 1; a <= 2; a++) {
            try { await fn(); return; }
            catch (e) {
                if (a === 2 || !String(e.message).includes('closed')) { fail(name, e.message); return; }
                console.log(`♻️  renderer murió en ${name} — reintento`);
                await freshLogin(); await selectEvent();
            }
        }
    };

    // ════════ GRUPO A ════════
    if (GROUP === 'ALL' || GROUP === 'A') {
        try {
            await freshLogin();
            ok('Login con formulario');
        } catch (e) { fail('Login', e.message); return await browser.close(); }

        await withRetry('Crear evento', async () => {
        await page.click('#btn-new-event-full');
        await page.fill('#ev-name', 'Evento Batería Total');
        await page.fill('#ev-date', '2026-12-24T20:00');
        await page.click('#new-event-form button[type="submit"]');
        await page.waitForTimeout(2200);
        const listed = await page.evaluate(() => document.body.innerText.includes('Evento Batería Total'));
        listed ? ok('Crear evento desde UI') : fail('Crear evento', 'no listado');
        await selectEvent();
        (await eventId()) ? ok('Seleccionar evento (openEvent)') : fail('Seleccionar evento', 'state.event vacío');
        });

        await withRetry('Navegación my-events', async () => {
        await page.evaluate(() => window.App?.navigate('my-events'));
        await page.waitForTimeout(700);
        const v = await page.evaluate(() => !document.getElementById('view-my-events')?.classList.contains('hidden'));
        v ? ok('Navegación → my-events') : fail('Navegación my-events', 'no visible');
        });

        await withRetry('Navegación admin', async () => {
        await selectEvent();
        await page.evaluate(() => window.App?.navigate('admin'));
        await page.waitForTimeout(900);
        const v = await page.evaluate(() => !document.getElementById('view-admin')?.classList.contains('hidden'));
        v ? ok('Navegación → admin (con evento)') : fail('Navegación admin', 'no visible');
        });

        await withRetry('Crear asistente', async () => {
        await page.evaluate(() => window.App.openAddAssistantModal());
        await page.waitForTimeout(500);
        await page.fill('#add-attendance-name', 'Asistente E2E');
        await page.fill('#add-attendance-email', 'e2e@asistente.io');
        const posts = [];
        const h = r => { if (r.request().method() === 'POST' && r.url().includes('/attendance')) posts.push(r.status()); };
        page.on('response', h);
        await page.evaluate(() => App.saveAddAttendance());
        await page.waitForTimeout(2200);
        page.off('response', h);
        await page.evaluate(() => window.App?.loadGuests?.());
        await page.waitForTimeout(1000);
        const inList = await page.evaluate(() => document.getElementById('attendance-tbody')?.innerText.includes('Asistente E2E'));
        (posts.some(s => s < 300) && inList) ? ok('Crear asistente desde UI') : fail('Crear asistente', `POST=${posts.join(',')||'∅'} visible=${inList}`);
        });

        await withRetry('Encuestas', async () => {
        await closeModals();
        await page.evaluate(() => window.App?.navigate('event-config'));
        await page.waitForTimeout(1200);
        await page.evaluate(() => App.switchConfigTab('surveys'));
        await page.waitForTimeout(600);
        await page.evaluate(() => App.openSurveyBuilder());
        await page.waitForTimeout(500);
        await page.fill('#survey-builder-title', 'Encuesta E2E');
        await page.evaluate(() => App.saveSurveyTemplate());
        await page.waitForTimeout(2000);
        await page.evaluate(() => App.switchConfigTab('surveys'));
        await page.waitForTimeout(1200);
        const viaApi = await page.evaluate(async () => {
            const eId = window.App?.state?.event?.id;
            if (!eId) return 'sin-evento';
            const tpl = await window.App.fetchAPI('/events/' + eId + '/templates');
            return Array.isArray(tpl) && tpl.some(t => t.title === 'Encuesta E2E') ? 'ok' : 'no-en-bd';
        });
        const inDom = await page.evaluate(() => (document.getElementById('survey-templates-list')?.innerText || '').includes('Encuesta E2E'));
        (viaApi === 'ok') ? ok('Encuestas: crear plantilla (builder)' + (inDom ? '' : ' — API OK')) : fail('Encuestas: plantilla', 'API=' + viaApi);
        });
    }

    // ════════ GRUPO B ════════
    if (GROUP === 'ALL' || GROUP === 'B') {
        await freshLogin();
        await selectEvent();

        await withRetry('Cupones', async () => {
        await closeModals();
        await page.evaluate(() => App.switchConfigTab('coupons'));
        await page.waitForTimeout(800);
        await page.evaluate(() => App.openCouponModal());
        await page.waitForTimeout(400);
        await page.fill('#coupon-code', 'E2E10');
        await page.fill('#coupon-value', '10');
        await page.evaluate(() => document.querySelector('#modal-coupon form')?.requestSubmit());
        await page.waitForTimeout(1800);
        const inTable = await page.evaluate(() => document.getElementById('coupons-tbody')?.innerText.includes('E2E10'));
        const closed = await page.evaluate(() => document.getElementById('modal-coupon')?.classList.contains('hidden'));
        inTable ? ok('Cupones: crear cupón' + (closed ? '' : ' (⚠ modal no cerró)')) : fail('Cupones', `tabla=${inTable} cerrado=${closed}`);
        });

        await withRetry('Sponsors', async () => {
        await closeModals();
        await page.evaluate(() => App.switchConfigTab('sponsors'));
        await page.waitForTimeout(700);
        await page.evaluate(() => App.openSponsorModal());
        await page.waitForTimeout(500);
        await page.fill('#_sp-name', 'Patrocinador E2E');
        await page.click('.swal2-confirm');
        await page.waitForTimeout(1800);
        const inTable = await page.evaluate(() => document.getElementById('sponsors-tbody')?.innerText.includes('Patrocinador E2E'));
        inTable ? ok('Sponsors: crear patrocinador') : fail('Sponsors', 'no aparece en tabla');
        });

        await withRetry('Formulario: campo', async () => {
        await closeModals();
        await page.evaluate(() => App.switchConfigTab('reg-fields'));
        await page.waitForTimeout(700);
        await page.evaluate(() => App.openRegFieldModal());
        await page.waitForTimeout(500);
        await page.fill('#_rf-label', 'Empresa E2E');
        await page.click('.swal2-confirm');
        await page.waitForTimeout(1800);
        const inTable = await page.evaluate(() => document.getElementById('regfields-tbody')?.innerText.includes('Empresa E2E'));
        inTable ? ok('Formulario: campo personalizado') : fail('Formulario: campo', 'no aparece');
        });
    }

    // ════════ GRUPO C ════════
    if (GROUP === 'ALL' || GROUP === 'C') {
        await freshLogin();

        await withRetry('API Keys', async () => {
        await page.evaluate(() => window.App?.navigate('system'));
        await page.waitForTimeout(900);
        await page.evaluate(() => App.switchSystemTab('api-keys'));
        await page.waitForTimeout(600);
        const ak = await page.evaluate(async () => {
            const r = await window.App.fetchAPI('/api-keys', { method: 'POST', body: JSON.stringify({ name: 'key-e2e', scopes: ['events:read'] }) });
            await window.App.loadApiKeys();
            return r;
        });
        await page.waitForTimeout(700);
        const listed = await page.evaluate(() => document.getElementById('apikeys-tbody')?.innerText.includes('key-e2e'));
        (ak?.key?.startsWith('ck_') && listed) ? ok('API Keys: crear ck_… + listado') : fail('API Keys', `api=${JSON.stringify(ak).slice(0,60)} render=${listed}`);
        });

        await withRetry('Push: plantilla', async () => {
        await closeModals();
        await page.evaluate(() => App.switchSystemTab('push-adv'));
        await page.waitForTimeout(700);
        await page.fill('#push-tpl-name', 'e2e');
        await page.fill('#push-tpl-title', 'Recordatorio E2E');
        await page.fill('#push-tpl-body', 'Tu evento comienza pronto');
        await page.evaluate(() => App.createPushTemplate());
        await page.waitForTimeout(1600);
        const listed = await page.evaluate(() => document.getElementById('push-templates-list')?.innerText.includes('Recordatorio E2E'));
        listed ? ok('Push: crear plantilla') : fail('Push: plantilla', 'no aparece');
        });

        await withRetry('Toggle tema', async () => {
        const before = await page.evaluate(() => document.documentElement.className);
        await page.click('#btn-toggle-theme');
        await page.waitForTimeout(400);
        const after = await page.evaluate(() => document.documentElement.className);
        before !== after ? ok('Toggle tema') : fail('Toggle tema', 'sin cambio');
        await page.click('#btn-toggle-theme');
        });

        await withRetry('Logout', async () => {
        await page.click('#btn-logout');
        await page.waitForTimeout(1200);
        const atLogin = await page.evaluate(() => !document.getElementById('view-login')?.classList.contains('hidden'));
        atLogin ? ok('Logout → login') : fail('Logout', 'login no visible');
        });
    }

    console.log('\n══════ RESUMEN ' + GROUP + ' ══════');
    const P = results.filter(r => r.startsWith('PASS')).length;
    const F = results.filter(r => r.startsWith('FAIL')).length;
    const S = results.filter(r => r.startsWith('SKIP')).length;
    console.log(`PASS: ${P} · FAIL: ${F} · SKIP: ${S}`);
    console.log(consoleErrors.length ? `Consola JS: ${consoleErrors.length} errores → ${consoleErrors.slice(0, 6).join(' | ')}` : 'Consola JS: limpia');
    console.log(apiErrors.length ? `API ≥400: ${apiErrors.slice(0, 6).join(' | ')}` : 'API: sin ≥400');
    fs.writeFileSync(`${OUT}/results-${GROUP}.txt`, results.join('\n') + `\n\nCONSOLA:\n${consoleErrors.join('\n')}\n\nAPI:\n${apiErrors.join('\n')}`);
    await browser.close();
    process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
