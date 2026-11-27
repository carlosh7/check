#!/usr/bin/env node
/**
 * scripts/generate-openapi.js — genera el mapa OpenAPI de TODAS las rutas reales.
 *
 * v12.44.852 (auditoría 2026-11-25, I12): la especificación estaba congelada en 12.44.672 y cubría
 * 15 de ~570 endpoints. Este script recorre los routers montados (mismo mecanismo que los smoke
 * tests) y emite cada ruta como path+método con su etiqueta; src/docs/swagger.js lo mezcla con los
 * endpoints documentados a mano (que conservan prioridad: tienen esquemas y ejemplos).
 *
 * Uso:  node scripts/generate-openapi.js     → escribe src/docs/openapi-generated.json
 */
const fs = require('fs');
const path = require('path');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('dotenv').config();

const ROUTES_DIR = path.join(__dirname, '..', 'src', 'routes');
const OUT = path.join(__dirname, '..', 'src', 'docs', 'openapi-generated.json');
const UUID = '00000000-0000-4000-8000-000000000000';

// Rutas con efectos o credenciales que no se exponen como API estable
const EXCLUDED = [
    /\/deploy(\/|$)/, /\/setup(\/|$)/, /\/auth\/google(\/|$)/, /\/callback(\/|$)/, /\/logout$/,
    /\/sync\//, /\/telemetry(\/|$)/, /\/purge(\/|$)/, /\/approve-all-users(\/|$)/, /\/webhooks\/stripe(\/|$)/
];

const src = fs.readFileSync(path.join(ROUTES_DIR, 'index.js'), 'utf8');
const prefixes = {};
let m;
const re = /app\.use\(\s*'([^']*)'\s*,\s*([A-Za-z0-9_]+)(?:\.router)?\s*\)/g;
while ((m = re.exec(src))) prefixes[m[2]] = m[1];

function collect(router, prefix, out) {
    for (const layer of router.stack || []) {
        if (layer.route) {
            const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
            for (const p of paths) {
                for (const method of Object.keys(layer.route.methods || {})) {
                    out.push({ method: method.toUpperCase(), path: prefix + p });
                }
            }
        } else if (layer.handle && Array.isArray(layer.handle.stack)) {
            collect(layer.handle, prefix + (typeof layer.path === 'string' ? layer.path : ''), out);
        }
    }
    return out;
}

const paths = {};
let total = 0;
for (const f of fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.routes.js')).sort()) {
    const name = f.replace('.routes.js', '');
    const mod = require(path.join(ROUTES_DIR, f));
    const router = mod.router || mod;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mv = new RegExp("const\\s+(\\w+)\\s*=\\s*require\\('\\./" + escaped + "'\\)").exec(src);
    const prefix = mv && prefixes[mv[1]] !== undefined ? prefixes[mv[1]] : '';
    const routes = collect(router, prefix, []).filter(r => !EXCLUDED.some(rx => rx.test(r.path)));
    for (const r of routes) {
        const openapiPath = r.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}').replace(/\?$/g, '').replace(/\*$/g, '');
        const key = '/' + openapiPath.replace(/^\/+/, '');
        paths[key] = paths[key] || {};
        paths[key][r.method.toLowerCase()] = {
            tags: [name],
            summary: r.method + ' ' + key + ' — ver código fuente para el contrato completo',
            responses: { '200': { description: 'Respuesta' } }
        };
        total++;
    }
}

const spec = {
    openapi: '3.0.0',
    info: {
        title: 'Check Pro API — mapa generado',
        version: require(path.join(__dirname, '..', 'package.json')).version,
        description: 'Mapa COMPLETO de rutas generado desde los routers montados (' + total + ' endpoints). Los endpoints con documentación detallada viven en el spec manual (swagger.js), que tiene prioridad.'
    },
    paths
};
fs.writeFileSync(OUT, JSON.stringify(spec, null, 2));
console.log('OK — ' + total + ' endpoints en ' + Object.keys(paths).length + ' paths → src/docs/openapi-generated.json');
