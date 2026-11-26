/**
 * Smoke test de routers (v12.44.849 — auditoría 2026-11-25, I8)
 *
 * 24 routers no tenían ningún test. Este archivo cubre el fallo más repetido de la auditoría —rutas
 * que respondían 500 siempre por SQL roto, alias o columnas inexistentes— sin escribir 24 suites:
 *
 *   1. Todos los routers de src/routes cargan y son routers de Express.
 *   2. Ninguna ruta GET responde 500 al llamarla con datos de prueba, con token de ADMIN y sin token.
 *
 * Solo se llaman rutas GET (no deben tener efectos) y se excluyen las que sí los tienen (despliegue,
 * instalación inicial, OAuth, sincronizaciones). Un 500 aquí significa un error real: la ruta se
 * rompe incluso para el ADMIN con un id que no existe.
 */
require('dotenv').config();
const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { db } = require('../database');
const { generateToken } = require('../src/security/jwt');

const ROUTES_DIR = path.join(__dirname, '..', 'src', 'routes');
const UUID = '00000000-0000-4000-8000-000000000000';

// Rutas con efectos que un GET no debería disparar pero que existen: no se llaman en la prueba.
const EXCLUDED = [
    /\/deploy(\/|$)/, /\/setup(\/|$)/, /\/auth\/google(\/|$)/, /\/callback(\/|$)/, /\/logout$/,
    /\/sync\//, /\/(start|stop|trigger|run|reset|flush|purge|cleanup|rebuild|seed|migrate)[a-z-]*(\/|$)/,
    /\/telemetry(\/|$)/, /\/api\/version\/check/, /\/ecommerce\/.*\/(sync|import|export)(\/|$)/
];

// Montaje real de cada router (src/routes/index.js): variable -> prefijo.
function mountPrefixes() {
    const src = fs.readFileSync(path.join(ROUTES_DIR, 'index.js'), 'utf8');
    const map = {};
    const re = /app\.use\(\s*'([^']*)'\s*,\s*([A-Za-z0-9_]+)(?:\.router)?\s*\)/g;
    let m;
    while ((m = re.exec(src))) map[m[2]] = m[1];
    return map;
}

// Prefijo de montaje según el nombre con que index.js requiere el archivo.
function prefixFor(file, prefixes) {
    const src = fs.readFileSync(path.join(ROUTES_DIR, 'index.js'), 'utf8');
    const re = new RegExp("const\\s+(\\w+)\\s*=\\s*require\\('\\./" + file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\)");
    const m = re.exec(src);
    return m && prefixes[m[1]] ? prefixes[m[1]] : '';
}

function collectGetRoutes(router, prefix, out) {
    for (const layer of router.stack || []) {
        if (layer.route) {
            if (!layer.route.methods || !layer.route.methods.get) continue;
            const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
            for (const p of paths) out.push(prefix + p);
        } else if (layer.handle && Array.isArray(layer.handle.stack)) {
            collectGetRoutes(layer.handle, prefix + (typeof layer.path === 'string' ? layer.path : ''), out);
        }
    }
    return out;
}

function toUrl(pattern) {
    let url = pattern.replace(/:\w+/g, UUID);
    // sufijos opcionales de Express 5 (:id?) y comodines
    url = url.replace(/\?$/g, '').replace(/\*$/g, 'x');
    return url.startsWith('/') ? url : '/' + url;
}

describe('Smoke test de routers (v12.44.849)', () => {
    const files = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.routes.js')).sort();
    const prefixes = mountPrefixes();
    const admin = db.prepare("SELECT id, username, role FROM users WHERE role = 'ADMIN' AND status = 'APPROVED' LIMIT 1").get();
    const adminToken = generateToken({ userId: admin.id, username: admin.username, role: admin.role });

    test('todos los archivos de rutas cargan y son routers de Express', () => {
        expect(files.length).toBeGreaterThan(40);
        for (const f of files) {
            const mod = require(path.join(ROUTES_DIR, f));
            const router = mod.router || mod;
            expect(typeof router === 'function' && Array.isArray(router.stack)).toBe(true);
        }
    });

    const loaded = files.map(function(f) {
        const mod = require(path.join(ROUTES_DIR, f));
        return { file: f, router: mod.router || mod, prefix: prefixFor(f, prefixes) };
    });

    test('ninguna ruta GET responde 500 (con token de ADMIN)', async () => {
        const failures = [];
        let called = 0;
        for (const { file, router, prefix } of loaded) {
            const app = express();
            app.use(express.json());
            app.use(prefix || '/', router);
            const paths = Array.from(new Set(collectGetRoutes(router, prefix || '', []))).filter(p => !EXCLUDED.some(re => re.test(p)));
            for (const p of paths) {
                const url = toUrl(p);
                called++;
                let status = 0;
                try {
                    const res = await request(app).get(url).set('Authorization', 'Bearer ' + adminToken).timeout({ response: 8000, deadline: 15000 });
                    status = res.status;
                    if (status >= 500) failures.push(file + ' GET ' + url + ' -> ' + status + ' ' + String(res.text || '').replace(/\s+/g, ' ').slice(0, 90));
                } catch (e) {
                    failures.push(file + ' GET ' + url + ' -> EXCEPCIÓN ' + String(e.message || e).slice(0, 90));
                }
            }
        }
        if (failures.length) console.log('\nRutas GET probadas: ' + called + '\nFALLOS (' + failures.length + '):\n' + failures.join('\n'));
        expect(failures).toEqual([]);
    }, 240000);

    test('ninguna ruta GET responde 500 (sin token)', async () => {
        const failures = [];
        for (const { file, router, prefix } of loaded) {
            const app = express();
            app.use(express.json());
            app.use(prefix || '/', router);
            const paths = Array.from(new Set(collectGetRoutes(router, prefix || '', []))).filter(p => !EXCLUDED.some(re => re.test(p)));
            for (const p of paths) {
                const url = toUrl(p);
                try {
                    const res = await request(app).get(url).timeout({ response: 8000, deadline: 15000 });
                    if (res.status >= 500) failures.push(file + ' GET ' + url + ' -> ' + res.status + ' ' + String(res.text || '').replace(/\s+/g, ' ').slice(0, 90));
                } catch (e) {
                    failures.push(file + ' GET ' + url + ' -> EXCEPCIÓN ' + String(e.message || e).slice(0, 90));
                }
            }
        }
        if (failures.length) console.log('\nFALLOS sin token (' + failures.length + '):\n' + failures.join('\n'));
        expect(failures).toEqual([]);
    }, 240000);
});
