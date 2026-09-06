/**
 * Visual & CSP Tests (v12.44.804) — cierra P2-2 del AUDIT_REPORT.
 *
 * Modo estático (siempre, sin servidor):
 *   - Ninguna página HTML puede tener <script> inline: la CSP de server.js
 *     ya no permite 'unsafe-inline' en script-src, así que un script inline
 *     nuevo quedaría bloqueado en el navegador y rompería la página en silencio.
 *   - Todo script/stylesheet local referenciado debe existir en disco.
 *
 * Modo live (solo si VISUAL_BASE_URL está definido):
 *   - Playwright carga las páginas clave, recolecta errores de consola/JS y
 *     saca capturas en screenshots/ (mismo espíritu que scripts/visual-check.js).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML_PAGES = [
    'index.html',
    'public/html/app-shell.html',
    'public/html/pages/calendar.html',
    'public/html/pages/kiosk.html',
    'public/html/pages/landing.html',
    'public/html/pages/portal.html',
    'public/html/pages/registro.html',
    'public/html/pages/survey.html',
    'public/html/pages/ticket.html',
    'public/html/pages/wheel.html',
];

function localRefs(html) {
    // Referencias locales a recursos propios (ignora CDNs https:// y data:)
    const refs = [];
    const re = /(?:src|href)=["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(html))) {
        const url = m[1];
        if (!url.startsWith('/')) continue;
        if (url.startsWith('/api/')) continue;
        refs.push(url.split('?')[0]);
    }
    return refs;
}

describe('CSP guard: páginas sin scripts inline (v12.44.804)', () => {
    test.each(HTML_PAGES)('%s no tiene <script> inline', (rel) => {
        const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
        let m;
        while ((m = re.exec(html))) {
            if (/src=/.test(m[1])) continue;
            expect({ file: rel, inlineScript: m[2].trim().slice(0, 80) }).toEqual({
                file: rel,
                inlineScript: '',
            });
        }
    });

    // v12.44.810: styleSrc ya no permite 'unsafe-inline' para ELEMENTOS <style>
    // (los atributos style="" siguen permitidos vía styleSrcAttr). Este guard
    // evita que vuelva a meterse un <style> inline que la CSP bloquearía.
    test.each(HTML_PAGES)('%s no tiene <style> inline (CSP styleSrc estricta)', (rel) => {
        const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        const re = /<style\b([^>]*)>([\s\S]*?)<\/style>/g;
        let m;
        while ((m = re.exec(html))) {
            expect({ file: rel, inlineStyle: m[2].trim().slice(0, 80) }).toEqual({
                file: rel,
                inlineStyle: '',
            });
        }
    });

    test.each(HTML_PAGES)('%s: todos los recursos locales existen', (rel) => {
        const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        for (const ref of localRefs(html)) {
            expect(fs.existsSync(path.join(ROOT, 'public', ref))).toBe(true);
        }
    });
});

describe('Modo live (VISUAL_BASE_URL)', () => {
    const BASE_URL = process.env.VISUAL_BASE_URL;

    (BASE_URL ? test : test.skip)('páginas clave cargan sin errores de JS', async () => {
        const { chromium } = require('playwright');
        let browser;
        try {
            browser = await chromium.launch({ headless: true });
        } catch (e) {
            // Host sin binarios de Playwright (p.ej. Ubuntu 26.04 no soportado por
            // la versión local): el modo live corre en el runner del CI. No romper
            // la suite local — el modo estático ya dio cobertura.
            console.warn('⚠️ Playwright no disponible en este host, modo live omitido:', e.message.split('\n')[0]);
            return;
        }
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

        const jsErrors = [];
        page.on('pageerror', (err) => jsErrors.push('pageerror: ' + err.message));
        page.on('console', (msg) => {
            if (msg.type() === 'error') jsErrors.push('console: ' + msg.text());
        });

        const shotsDir = path.join(ROOT, 'screenshots');
        if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir, { recursive: true });

        const pages = [
            '/', // login SPA
            '/html/pages/registro.html',
            '/html/pages/landing.html',
            '/html/pages/wheel.html',
            '/html/pages/ticket.html',
        ];

        for (const p of pages) {
            const resp = await page.goto(BASE_URL + p, { waitUntil: 'networkidle', timeout: 20000 });
            expect(resp.status()).toBeLessThan(400);
            await page.waitForTimeout(500);
            const safe = p.replace(/[^a-z0-9]+/gi, '_') || 'root';
            await page.screenshot({ path: path.join(shotsDir, 'visual_' + safe + '.png') });
        }

        await browser.close();
        expect(jsErrors).toEqual([]);
    }, 60000);
});
