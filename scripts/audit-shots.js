// audit-shots.js — Capturas autenticadas de todas las secciones (auditoría visual)
// Uso: node scripts/audit-shots.js [urlBase]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    const BASE = process.argv[2] || 'http://localhost:3000';
    const OUT = '/tmp/opencode/audit';
    fs.mkdirSync(OUT, { recursive: true });

    // Token real generado por el servidor local
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    process.env.DATA_PATH = process.env.DATA_PATH || './data';
    const { generateToken } = require(path.join(__dirname, '..', 'src/security/jwt'));
    const { db } = require(path.join(__dirname, '..', 'database'));
    const u = db.prepare("SELECT id, username, role FROM users WHERE role='ADMIN' LIMIT 1").get();
    const ev = db.prepare('SELECT id FROM events LIMIT 1').get();
    const token = generateToken({ userId: u.id, username: u.username, role: u.role });

    const browser = await chromium.launch({
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-gpu']
    });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 160)));

    // Sembrar sesión
    await page.goto(BASE + '/dev-view.html');
    await page.evaluate(([t, uid, un, eid]) => {
        const U = { token: t, userId: uid, username: un, role: 'ADMIN', display_name: 'Admin' };
        localStorage.setItem('user', JSON.stringify(U));
        localStorage.setItem('token', t);
        if (eid) localStorage.setItem('selected_event_id', eid);
    }, [token, u.id, u.username, ev ? ev.id : '']);

    const shots = [
        ['my-events', null],
        ['admin', 'admin'],
        ['event-config', 'event-config'],
        ['system', 'system'],
    ];

    for (const [name, view] of shots) {
        await page.goto(BASE + '/');
        await page.waitForTimeout(400);
        if (view) {
            await page.evaluate(v => {
                sessionStorage.setItem('check_current_view', JSON.stringify({ view: v, timestamp: Date.now() }));
            }, view);
            await page.reload({ waitUntil: 'networkidle' });
        } else {
            await page.reload({ waitUntil: 'networkidle' });
        }
        await page.waitForTimeout(1800);
        await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
        const hasShell = await page.evaluate(() => !!document.getElementById('app-container'));
        console.log(`✓ ${name} — app-container: ${hasShell}`);
    }

    // Tabs de event-config (requieren evento seleccionado)
    const tabs = ['staff', 'agenda', 'surveys', 'coupons', 'sponsors', 'reg-fields', 'intelligence', 'certificates'];
    for (const tab of tabs) {
        try {
            await page.goto(BASE + '/');
            await page.waitForTimeout(500);
            await page.evaluate(v => {
                sessionStorage.setItem('check_current_view', JSON.stringify({ view: 'event-config', eventTab: v, eventTabType: 'config', timestamp: Date.now() }));
            }, tab);
            await page.reload({ waitUntil: 'networkidle' });
            await page.waitForTimeout(1500);
            // Click directo en el tab por si la restauración no lo activa
            await page.evaluate(t => { if (window.App) App.switchConfigTab(t); }, tab);
            await page.waitForTimeout(900);
            await page.screenshot({ path: `${OUT}/config-${tab}.png` });
            console.log(`✓ config-${tab}`);
        } catch (e) { console.log(`✗ config-${tab}: ${String(e).slice(0, 80)}`); }
    }

    // Tabs de system
    const sysTabs = ['users', 'email', 'push-adv', 'api-keys', 'crm-sync', 'bi', 'venues', 'webhooks'];
    for (const tab of sysTabs) {
        try {
            await page.goto(BASE + '/');
            await page.waitForTimeout(500);
            await page.evaluate(v => {
                sessionStorage.setItem('check_current_view', JSON.stringify({ view: 'system', systemTab: v, timestamp: Date.now() }));
            }, tab);
            await page.reload({ waitUntil: 'networkidle' });
            await page.waitForTimeout(1200);
            await page.evaluate(t => { if (window.App) App.switchSystemTab(t); }, tab);
            await page.waitForTimeout(800);
            await page.screenshot({ path: `${OUT}/sys-${tab}.png` });
            console.log(`✓ sys-${tab}`);
        } catch (e) { console.log(`✗ sys-${tab}: ${String(e).slice(0, 80)}`); }
    }

    fs.writeFileSync(`${OUT}/console-errors.txt`, errors.join('\n') || 'sin errores de consola');
    console.log(`\nErrores de consola: ${errors.length} → ${OUT}/console-errors.txt`);
    await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
