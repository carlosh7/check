#!/usr/bin/env node
/**
 * coverage-api.js — Auditoría de cobertura Backend ↔ Frontend
 * 1) Extrae endpoints reales del backend (rutas × montajes)
 * 2) Extrae llamadas HTTP del frontend (fetchAPI/fetch/ApiService)
 * 3) Cruza y genera docs/COBERTURA_FE_BE.md
 * Uso: node scripts/coverage-api.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ─── 1. ENDPOINTS BACKEND ───
const idxSrc = fs.readFileSync(path.join(ROOT, 'src/routes/index.js'), 'utf8');
const mounts = [];
for (const m of idxSrc.matchAll(/app\.use\('([^']+)',\s*(?:\(\)\s*=>\s*)?([a-zA-Z]+Routes)\)/g)) {
    mounts.push({ mount: m[1], varName: m[2] });
}
// varName → archivo
const routeFiles = fs.readdirSync(path.join(ROOT, 'src/routes')).filter(f => f.endsWith('.routes.js'));
const varToFile = {};
for (const f of routeFiles) {
    const varName = f.replace(/\.routes\.js$/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Routes';
    varToFile[varName] = f;
}
// Casos especiales con nombres distintos
const idxVars = [...idxSrc.matchAll(/const\s+([A-Za-z]+Routes)\s*=\s*require\('\.\/([^']+)\)/g)];
for (const [, v, f] of idxVars) varToFile[v] = f.split('/').pop();

const endpoints = []; // { method, path, file }
for (const { mount, varName } of mounts) {
    const file = varToFile[varName];
    if (!file) continue;
    const src = fs.readFileSync(path.join(ROOT, 'src/routes', file), 'utf8');
    for (const m of src.matchAll(/router\.(get|post|put|delete|patch)\(\s*[`'"]([^`'"]+)/g)) {
        let p = m[2];
        if (mount !== '/' && !p.startsWith(mount)) p = (mount.replace(/\/$/, '') + p);
        if (mount === '/' && !p.startsWith('/api') && !p.startsWith('/api/')) { /* rutas como /api/api-keys ya absolutas */ }
        endpoints.push({ method: m[1].toUpperCase(), path: p.replace(/\/+$/, '') || '/', file });
    }
}
// Rutas inline de server.js
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
for (const m of serverSrc.matchAll(/app\.(get|post|put|delete|patch)\(\s*[`'"]([^`'"]+)/g)) {
    endpoints.push({ method: m[1].toUpperCase(), path: m[2], file: 'server.js (inline)' });
}

// ─── 2. LLAMADAS FRONTEND ───
function collect(dir, acc = []) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) collect(p, acc);
        else if (/\.(js|html)$/.test(f.name)) acc.push(p);
    }
    return acc;
}
const feFiles = collect(path.join(ROOT, 'public'));
feFiles.push(path.join(ROOT, 'index.html'));
const feCalls = new Set();
for (const f of feFiles) {
    const src = fs.readFileSync(f, 'utf8');
    // fetchAPI('/x') · fetchAPI(`/x/${y}`)  (el helper añade /api)
    for (const m of src.matchAll(/fetchAPI\(\s*[`'"](\/[^`'"]+)/g)) feCalls.add(m[1].replace(/\$\{[^}]+\}/g, '*'));
    // fetch('/api/x') · fetch(`/api/x`)
    for (const m of src.matchAll(/fetch\(\s*[`'"](\/api\/[^`'"]+|\/api\/)/g)) feCalls.add(m[1].replace(/\$\{[^}]+\}/g, '*'));
    // socket emit no cuenta como HTTP
}
const feNorm = [...feCalls]
    .map(c => c.split('?')[0].replace(/\/+$/, '') || '/')
    .map(c => c.startsWith('/api') ? c : '/api' + c);

function segmentsMatch(ep, c) {
    const a = ep.split('?')[0].split('/').filter(Boolean);
    const b = c.split('?')[0].split('/').filter(Boolean);
    const n = Math.max(a.length, b.length);
    let fixed = 0;
    for (let i = 0; i < n; i++) {
        const x = a[i], y = b[i];
        if (x === undefined || y === undefined) continue;
        if (x.includes(':') || y.includes('*') || x === y) { fixed++; continue; }
        return false;
    }
    return fixed >= Math.min(a.length, b.length) - 0;
}
function matchFe(epPath) {
    return feNorm.find(c => segmentsMatch(epPath, c));
}

// ─── 3. CRUCE ───
const covered = [];
const uncovered = [];
for (const ep of endpoints) {
    // ignorar documentación swagger y health
    if (ep.path.startsWith('/api-docs')) continue;
    (matchFe(ep.path) ? covered : uncovered).push(ep);
}

// Agrupar por módulo (primer segmento tras /api)
function moduleOf(p) {
    const parts = p.replace(/^\//, '').split('/');
    return parts[0] === 'api' ? (parts[1] || 'raíz') : (parts[0] || 'raíz');
}
const byModule = {};
for (const ep of endpoints) {
    const mod = moduleOf(ep.path);
    byModule[mod] = byModule[mod] || { total: 0, covered: 0, uncovered: [] };
    byModule[mod].total++;
    if (matchFe(ep.path)) byModule[mod].covered++;
    else byModule[mod].uncovered.push(`${ep.method} ${ep.path}`);
}

const total = endpoints.length;
const cov = covered.length;
const pct = Math.round((cov / total) * 100);

let md = `# Cobertura Backend ↔ Frontend — Check Pro v12.44.789

Generado automáticamente por \`scripts/coverage-api.js\` · ${new Date().toISOString().slice(0, 10)}

## Resumen
- **Endpoints backend:** ${total}
- **Con uso desde el frontend:** ${cov} (${pct}%)
- **Sin UI conectada:** ${total - cov} (${100 - pct}%)

> Nota: un endpoint "sin UI" no es necesariamente un error — hay endpoints
> para webhooks externos (Stripe/GitHub), API pública v1 (consumo externo),
> y flujos server-to-server. Se listan para revisión deliberada.

## Cobertura por módulo
| Módulo | Endpoints | Con UI | Sin UI | % |
|--------|-----------|--------|--------|---|
`;
for (const mod of Object.keys(byModule).sort((a, b) => byModule[b].total - byModule[a].total)) {
    const m = byModule[mod];
    md += `| ${mod} | ${m.total} | ${m.covered} | ${m.uncovered.length} | ${Math.round(m.covered / m.total * 100)}% |\n`;
}
md += `\n## Endpoints sin UI (por módulo)\n`;
for (const mod of Object.keys(byModule).sort()) {
    if (!byModule[mod].uncovered.length) continue;
    md += `\n### ${mod}\n`;
    byModule[mod].uncovered.forEach(u => md += `- \`${u}\`\n`);
}
fs.writeFileSync(path.join(ROOT, 'docs/COBERTURA_FE_BE.md'), md);

console.log(`Endpoints backend: ${total} · con UI: ${cov} (${pct}%) · sin UI: ${total - cov}`);
console.log('Informe: docs/COBERTURA_FE_BE.md');

// Llamadas FE que no matchean NINGÚN endpoint (posibles rotas)
const epPaths = endpoints.map(e => e.path.replace(/:[^/]+/g, '*'));
const epBases = endpoints.map(e => e.path.replace(/:[^/]+/g, '*').split('?')[0].replace(/\/+$/, ''));
const broken = feNorm.filter(c => {
    if (c === '/api' || c === '/api/') return false;
    const cBase = c.replace(/\*/g, '*');
    return !epBases.some(ep => {
        const segE = ep.split('/'), segC = cBase.split('/');
        if (Math.abs(segE.length - segC.length) > 1) return false;
        // coincidencia por prefijo de segmentos fijos (ignora * de ambos lados)
        const n = Math.min(segE.length, segC.length);
        let hit = 0;
        for (let i = 0; i < n; i++) {
            if (segE[i] === '*' || segC[i] === '*' || segE[i] === segC[i]) hit++;
            else if (i <= 1) return false; // primer segmento distinto → otro módulo
        }
        return hit >= n - 1;
    });
});
console.log(`Llamadas FE sin endpoint backend (posibles rotas): ${broken.length}`);
if (broken.length) broken.slice(0, 15).forEach(b => console.log('  ?', b));
