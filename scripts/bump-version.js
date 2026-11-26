#!/usr/bin/env node
/**
 * bump-version.js — incrementa la versión y actualiza TODAS sus referencias de una vez.
 *
 * Uso:
 *   node scripts/bump-version.js             → sube el último dígito (12.44.845 → 12.44.846)
 *   node scripts/bump-version.js 12.44.900   → fija una versión concreta
 *
 * Nunca asume la versión: siempre la lee de package.json. Actualiza:
 *   - package.json
 *   - public/js/app.js            (constante VERSION e imports con ?v=)
 *   - public/html/app-shell.html  (texto "Check Pro vX" y todos los ?v=)
 *   - index.html                  (todos los ?v= y el texto con la versión anterior)
 *   - public/html/pages/*.html    (etiquetas ?v= de scripts y hojas de estilo)
 *   - src/docs/swagger.js
 *
 * Motivo (auditoría 2026-11-25, G1): con el bump manual quedaban decenas de versiones distintas
 * de ?v= en el mismo archivo. El navegador trataba cada URL como un módulo distinto y cargaba
 * varias copias de State, Toast o Router, además de precargar direcciones que nadie usaba.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgFile = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
const current = String(pkg.version);
const parsed = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
if (!parsed) {
    console.error('Versión con formato inesperado en package.json:', current);
    process.exit(1);
}
const next = process.argv[2] ? String(process.argv[2]) : parsed[1] + '.' + parsed[2] + '.' + (Number(parsed[3]) + 1);
if (!/^\d+\.\d+\.\d+$/.test(next)) {
    console.error('Versión destino no válida (formato X.Y.Z):', next);
    process.exit(1);
}

const ANY = /\d+\.\d+\.\d+/g;
const QUERY = /\?v=\d+\.\d+\.\d+/g;
const rules = [
    ['public/js/app.js', [
        [/^const VERSION = '\d+\.\d+\.\d+';/m, "const VERSION = '" + next + "';"],
        [QUERY, '?v=' + next]
    ]],
    ['public/html/app-shell.html', [
        [QUERY, '?v=' + next],
        [/Check Pro \d+\.\d+\.\d+/g, 'Check Pro ' + next],
        [/Check Pro v\d+\.\d+\.\d+/g, 'Check Pro v' + next]
    ]],
    ['index.html', [
        [QUERY, '?v=' + next],
        [new RegExp(current.replace(/\./g, '\\.'), 'g'), next]
    ]],
    ['src/docs/swagger.js', [
        [/version: '\d+\.\d+\.\d+'/g, "version: '" + next + "'"]
    ]]
];
for (const page of fs.readdirSync(path.join(root, 'public/html/pages')).filter(f => f.endsWith('.html'))) {
    rules.push(['public/html/pages/' + page, [[QUERY, '?v=' + next]]]);
}

let total = 0;
for (const [rel, list] of rules) {
    const file = path.join(root, rel);
    let text = fs.readFileSync(file, 'utf8');
    let count = 0;
    for (const [pattern, replacement] of list) {
        text = text.replace(pattern, function () { count++; return replacement; });
    }
    if (count > 0) fs.writeFileSync(file, text);
    total += count;
    console.log(String(count).padStart(5) + '  ' + rel);
}

fs.writeFileSync(pkgFile, fs.readFileSync(pkgFile, 'utf8').replace('"version": "' + current + '"', '"version": "' + next + '"'));
console.log('Versión ' + current + ' → ' + next + ' (' + total + ' referencias actualizadas)');
