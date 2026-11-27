#!/usr/bin/env node
/**
 * scripts/audit-page-functions.js — auditor de funciones de las páginas (v12.44.853).
 *
 * Las páginas exponen funciones globales que su HTML invoca por STRING: data-call="fn" / @fn:fn
 * (DelegatedEvents resuelve por window[fn]) y referencias generadas dentro de otras plantillas JS.
 * ESLint no ve esos enlaces y reporta las funciones "sin usar": reportarlas como muertas y
 * borrarlas ROMPE páginas.
 *
 * Este auditor decide con evidencia: para cada función declarada en public/js/pages/*.js cuenta
 * sus menciones como palabra en TODO el frontend (HTML + JS, incluidas cadenas generadoras),
 * fuera de su token de declaración. Cero menciones = función muerta demostrada.
 *
 * Lecciones del diseño (no regress):
 *   - En líneas comprimidas una misma línea declara una función Y llama a otras
 *     (p.ej. `function openQuestionModal(){...fillQuestionModal(...)}`): al excluir la declaración
 *     solo se borra el token `function NAME(`, nunca la línea entera.
 *   - El helper `$` no funciona con límites de palabra (\b): se cuenta con búsqueda literal `$(`.
 *
 * Uso:  node scripts/audit-page-functions.js [--json] [--strict]
 *       --json   informe como JSON (para tests)
 *       --strict exit 1 si hay funciones muertas (bloqueo de CI)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES_DIR = path.join(ROOT, 'public', 'js', 'pages');

function corpusFiles() {
    const out = [];
    const walk = function(dir) {
        for (const f of fs.readdirSync(dir)) {
            const full = path.join(dir, f);
            const st = fs.statSync(full);
            if (st.isDirectory()) { walk(full); continue; }
            if (/\.html$|\.js$/.test(f)) out.push(full);
        }
    };
    walk(path.join(ROOT, 'public'));
    out.push(path.join(ROOT, 'index.html'));
    return out;
}

function collectDeclarations() {
    const result = [];
    for (const f of fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.js')).sort()) {
        const full = path.join(PAGES_DIR, f);
        const lines = fs.readFileSync(full, 'utf8').split('\n');
        lines.forEach(function(line, idx) {
            const m = /^\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/.exec(line);
            if (m) result.push({ file: 'public/js/pages/' + f, name: m[1], line: idx + 1 });
        });
    }
    return result;
}

function analyze() {
    const corpus = corpusFiles().map(function(full) {
        return { rel: path.relative(ROOT, full), text: fs.readFileSync(full, 'utf8') };
    });
    const decls = collectDeclarations();

    const byFile = new Map();
    for (const d of decls) {
        if (!byFile.has(d.file)) byFile.set(d.file, []);
        byFile.get(d.file).push(d);
    }

    // corpus con SOLO el token `function NAME(` de cada declaración eliminado (las llamadas
    // embebidas en la misma línea se conservan)
    const refsByFile = corpus.map(function(c) {
        const declLines = byFile.get(c.rel) || [];
        if (declLines.length === 0) return { rel: c.rel, text: c.text };
        const lines = c.text.split('\n');
        for (const d of declLines) {
            if (lines[d.line - 1] === undefined) continue;
            const reDecl = new RegExp('function\\s+' + d.name.replace(/\$/g, '\\$') + '\\s*\\(');
            lines[d.line - 1] = lines[d.line - 1].replace(reDecl, 'function (');
        }
        return { rel: c.rel, text: lines.join('\n') };
    });

    const report = [];
    const dead = [];
    for (const d of decls) {
        // nombres con caracteres de palabra usan límites \b; el helper $ se cuenta literal `$(`
        const isWordy = d.name !== '$';
        const needle = d.name + '(';
        let mentions = 0;
        const where = [];
        for (const c of refsByFile) {
            let count = 0;
            if (isWordy) {
                const re = new RegExp('\\b' + d.name.replace(/\$/g, '\\$') + '\\b', 'g');
                const m = c.text.match(re);
                count = m ? m.length : 0;
            } else {
                let i = c.text.indexOf(needle);
                while (i >= 0) { count++; i = c.text.indexOf(needle, i + 1); }
            }
            if (count > 0) { mentions += count; where.push(c.rel + ' x' + count); }
        }
        const status = mentions > 0 ? 'VIVA' : 'MUERTA';
        const entry = { file: d.file, line: d.line, name: d.name, status: status, mentions: mentions };
        if (mentions > 0) entry.where = where.slice(0, 4);
        report.push(entry);
        if (mentions === 0) dead.push(d.file + ':' + d.line + ' function ' + d.name + '()');
    }
    return { total: report.length, alive: report.length - dead.length, deadCount: dead.length, deadList: dead, report: report };
}

function main() {
    const asJson = process.argv.includes('--json');
    const result = analyze();
    if (asJson) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    console.log('FUNCIONES DECLARADAS EN PÁGINAS: ' + result.total + ' | vivas: ' + result.alive + ' | muertas demostradas: ' + result.deadCount);
    if (result.deadCount > 0) {
        console.log('\nMUERTAS (cero menciones en todo el frontend):');
        for (const d of result.deadList) console.log('  ' + d);
    }
    if (process.argv.includes('--strict') && result.deadCount > 0) process.exit(1);
}

if (require.main === module) main();
module.exports = { analyze, collectDeclarations };
