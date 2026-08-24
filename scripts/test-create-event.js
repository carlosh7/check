// test-create-event.js — Flujo real: login → +Evento → llenar → guardar
const { chromium } = require('playwright');
const path = require('path');
(async () => {
    const BASE = 'http://localhost:3000';
    const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const net = [];
    const errors = [];
    page.on('response', r => { if (r.url().includes('/api/')) net.push(`${r.request().method()} ${r.url().replace(BASE, '')} → ${r.status()}`); });
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 300)));

    // Login real por formulario
    await page.goto(BASE + '/');
    await page.fill('#login-email', 'admin@example.com');
    await page.fill('#login-password', 'changeme123');
    await page.click('#login-btn');
    await page.waitForSelector('#app-container', { timeout: 15000 });
    console.log('✓ login → app-container visible');

    // Abrir modal de crear evento
    await page.click('#btn-new-event-full');
    await page.waitForTimeout(500);
    const modalVisible = await page.evaluate(() => !document.getElementById('modal-event')?.classList.contains('hidden'));
    console.log('✓ modal-event visible:', modalVisible);

    // Llenar el formulario
    await page.fill('#ev-name', 'Evento Test E2E');
    await page.fill('#ev-date', '2026-12-20T19:00');
    await page.fill('#ev-location', 'Auditorio Central');
    await page.fill('#ev-desc', 'Creado desde test automatizado');
    const payloadProbe = [];
    page.on('request', r => { if (r.url().endsWith('/api/events') && r.method() === 'POST') payloadProbe.push(r.postData()); });

    await page.click('#new-event-form button[type="submit"]');
    await page.waitForTimeout(2500);

    console.log('--- red API ---');
    net.slice(-6).forEach(n => console.log(' ', n));
    if (payloadProbe[0]) console.log('--- POST body ---\n ', payloadProbe[0].slice(0, 300));
    console.log('--- errores consola ---');
    errors.slice(0, 8).forEach(e => console.log(' ', e));
    if (!errors.length) console.log('  (ninguno)');

    // ¿Apareció en la lista?
    const listed = await page.evaluate(() => document.body.innerText.includes('Evento Test E2E'));
    console.log('✓ evento listado tras crear:', listed);
    await page.screenshot({ path: '/tmp/opencode/audit/after-create.png' });
    await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
