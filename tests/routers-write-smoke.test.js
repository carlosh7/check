/**
 * Smoke test de ESCRITURA en routers (v12.44.850 — auditoría 2026-11-25, I8).
 *
 * Complemento de routers-smoke.test.js (solo lecturas): llama TODAS las rutas POST/PUT/DELETE/PATCH
 * de todos los routers con cuerpo vacío, con token de ADMIN y sin él. Con cuerpo vacío las rutas
 * bien construidas responden 400/401/403/404 — nunca 500. Un 500 aquí es un error real (el tipo de
 * fallo más repetido de la auditoría: crashes SQL garantizados).
 *
 * Excluidas: rutas con efectos reales incluso con entrada inválida o que invalidarían el propio
 * token de prueba (ver EXCLUDED_WRITE). Solo se usa la BD de pruebas local.
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

// Rutas con efectos reales aunque el cuerpo sea inválido, o que toc contraseñas/llaves/tokens:
// no se llaman en la prueba.
const EXCLUDED_WRITE = [
    /\/deploy(\/|$)/, /\/setup(\/|$)/, /\/auth\//, /\/logout(\/|$)/, /\/sync(\/|$)/, /\/sync\//,
    /\/settings(\/|$)/,                       // purga, aprobación masiva, claves de terceros
    /\/vapid-keys(\/|$)/,                     // regeneraría las llaves de notificaciones
    /\/system\/backup(\/|$)/,                 // crearía respaldos reales
    /\/approve-all-users(\/|$)/,              // aprobaría cuentas PENDING
    /\/callback(\/|$)/, /\/telemetry(\/|$)/, /\/version\/check/,
    /\/plugins\/(install|uninstall)(\/|$)/,   // instalan/desinstalan con efectos en BD
    /\/delete-account(\/|$)/                  // pide contraseña; por prudencia fuera
];

function mountPrefixes() {
    const src = fs.readFileSync(path.join(ROUTES_DIR, 'index.js'), 'utf8');
    const map = {};
    const re = /app\.use\(\s*'([^']*)'\s*,\s*([A-Za-z0-9_]+)(?:\.router)?\s*\)/g;
    let m;
    while ((m = re.exec(src))) map[m[2]] = m[1];
    return map;
}

function prefixFor(file, prefixes, src) {
    const base = file.replace('.js', '');
    const re = new RegExp("const\\s+(\\w+)\\s*=\\s*require\\('\\./" + base + "'\\)");
    const m = re.exec(src);
    return m && prefixes[m[1]] ? prefixes[m[1]] : '';
}

function collectRoutes(router, prefix, out, methodFilter) {
    for (const layer of router.stack || []) {
        if (layer.route) {
            const methods = Object.keys(layer.route.methods || {}).filter(function(m) { return methodFilter.includes(m); });
            if (methods.length === 0) continue;
            const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
            for (const p of paths) for (const m of methods) out.push({ method: m.toUpperCase(), path: prefix + p });
        } else if (layer.handle && Array.isArray(layer.handle.stack)) {
            collectRoutes(layer.handle, prefix + (typeof layer.path === 'string' ? layer.path : ''), out, methodFilter);
        }
    }
    return out;
}

function toUrl(pattern) {
    return '/' + pattern.replace(/:\w+/g, UUID).replace(/\?$/g, '').replace(/\*$/g, 'x').replace(/^\/+/, '');
}

describe('Smoke test de escritura en routers (v12.44.850)', () => {
    const files = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.routes.js')).sort();
    const src = fs.readFileSync(path.join(ROUTES_DIR, 'index.js'), 'utf8');
    const prefixes = mountPrefixes();
    const admin = db.prepare("SELECT id, username, role FROM users WHERE role = 'ADMIN' AND status = 'APPROVED' LIMIT 1").get();
    const adminToken = generateToken({ userId: admin.id, username: admin.username, role: admin.role });
    const loaded = files.map(function(f) {
        const mod = require(path.join(ROUTES_DIR, f));
        return { file: f, router: mod.router || mod, prefix: prefixFor(f, prefixes, src) };
    });
    const WRITE_METHODS = ['post', 'put', 'patch', 'delete'];

    test('ninguna ruta de escritura responde 500 con cuerpo vacío (con token de ADMIN)', async () => {
        const failures = [];
        let called = 0;
        for (const { file, router, prefix } of loaded) {
            const app = express();
            app.use(express.json());
            app.use(prefix || '/', router);
            const routes = collectRoutes(router, prefix || '/', [], WRITE_METHODS)
                .filter(r => !EXCLUDED_WRITE.some(re => re.test(r.path)));
            for (const r of routes) {
                called++;
                const url = toUrl(r.path);
                try {
                    const res = await request(app)[r.method.toLowerCase()](url)
                        .set('Authorization', 'Bearer ' + adminToken)
                        .send({})
                        .timeout({ response: 8000, deadline: 15000 });
                    if (res.status >= 500) failures.push(file + ' ' + r.method + ' ' + url + ' -> ' + res.status + ' ' + String(res.text || '').replace(/\s+/g, ' ').slice(0, 90));
                } catch (e) {
                    failures.push(file + ' ' + r.method + ' ' + url + ' -> EXCEPCIÓN ' + String(e.message || e).slice(0, 90));
                }
            }
        }
        if (failures.length) console.log('\nEscrituras probadas: ' + called + '\nFALLOS (' + failures.length + '):\n' + failures.join('\n'));
        expect(failures).toEqual([]);
    }, 300000);

    test('ninguna ruta de escritura responde 500 sin token', async () => {
        const failures = [];
        for (const { file, router, prefix } of loaded) {
            const app = express();
            app.use(express.json());
            app.use(prefix || '/', router);
            const routes = collectRoutes(router, prefix || '/', [], WRITE_METHODS)
                .filter(r => !EXCLUDED_WRITE.some(re => re.test(r.path)));
            for (const r of routes) {
                const url = toUrl(r.path);
                try {
                    const res = await request(app)[r.method.toLowerCase()](url).send({})
                        .timeout({ response: 8000, deadline: 15000 });
                    if (res.status >= 500) failures.push(file + ' ' + r.method + ' ' + url + ' -> ' + res.status);
                } catch (e) {
                    failures.push(file + ' ' + r.method + ' ' + url + ' -> EXCEPCIÓN ' + String(e.message || e).slice(0, 90));
                }
            }
        }
        if (failures.length) console.log('\nFALLOS sin token (' + failures.length + '):\n' + failures.join('\n'));
        expect(failures).toEqual([]);
    }, 300000);
});
