#!/usr/bin/env node
/**
 * gen-utilities.js — Genera public/css/modules/utilities.css
 * a partir del vocabulario REAL de clases usado en los HTML del proyecto.
 * Escala de espaciado tipo Tailwind (base 4px). Idempotente.
 */
const fs = require('fs');
const path = require('path');

const roots = [
    path.join(__dirname, '..', 'public/html'),
    path.join(__dirname, '..', 'index.html')
];
function collect(dir, acc) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) collect(p, acc);
        else if (f.name.endsWith('.html')) acc.push(p);
    }
    return acc;
}
const files = roots.flatMap(r => fs.statSync(r).isDirectory() ? collect(r, []) : [r]);
const used = new Set();
for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).forEach(c => c && used.add(c));
}
// Clases dinámicas creadas desde JS (render de tablas/toasts)
for (const f of fs.readdirSync(path.join(__dirname, '..', 'public/js'), { recursive: false })) {}
const jsDir = path.join(__dirname, '..', 'public/js');
function collectJs(dir, acc) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory() && !p.includes('node_modules')) collectJs(p, acc);
        else if (f.name.endsWith('.js')) acc.push(p);
    }
    return acc;
}
for (const f of collectJs(jsDir, [])) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/class=\\?"([^"\\]*)/g)) m[1].split(/\s+/).forEach(c => c && used.add(c));
    for (const m of src.matchAll(/'(flex|hidden|block|w-full|text-[a-z0-9-]+|bg-[a-z0-9\-\/\[\]\.]+|mt-[0-9]+|mb-[0-9]+|p-[0-9]+|px-[0-9]+|py-[0-9]+|gap-[0-9]+|rounded[a-z0-9-]*|font-[a-z]+|uppercase|truncate|opacity-[0-9]+)'/g)) used.add(m[1]);
}

const SP = { '0':'0px','0\\.5':'2px','1':'4px','1\\.5':'6px','2':'8px','2\\.5':'10px','3':'12px','4':'16px','5':'20px','6':'24px','8':'32px','10':'40px','12':'48px','16':'64px','20':'80px','24':'96px','999999':'999999px' };
const sp = v => SP[v.replace('\\.','\\.')] ?? SP[v] ?? (parseFloat(v) != null ? (parseFloat(v) * 0.25) + 'rem' : null);
const COLORS_TEXT = {
    'white':'var(--text-primary)','black':'#000',
    'slate-300':'#cbd5e1','slate-400':'#94a3b8','slate-500':'#64748b','slate-600':'#475569','slate-800':'#1e293b',
    'red-400':'#f87171','red-500':'#ef4444','green-400':'#4ade80','green-500':'#22c55e','amber-400':'#fbbf24',
    'blue-400':'#60a5fa','blue-500':'#3b82f6','cyan-400':'#22d3ee','emerald-400':'#34d399','emerald-500':'#10b981','orange-400':'#fb923c','purple-400':'#c084fc','purple-500':'#a855f7','violet-400':'#a78bfa','gray-300':'#d1d5db','gray-400':'#9ca3af','primary':'var(--primary)','muted':'var(--text-muted)',
    '[var(--text-secondary)]':'var(--text-secondary)','[var(--text-main)]':'var(--text-primary)',
    '[var(--text-muted)]':'var(--text-muted)','[var(--primary)]':'var(--primary)','[var(--accent)]':'var(--accent)',
    '[var(--error)]':'var(--error)','[var(--success)]':'var(--success)','[var(--warning)]':'var(--warning)'
};
const COLORS_BG = {
    'white':'#ffffff','black':'#000','transparent':'transparent',
    'black-20':'rgba(0,0,0,0.2)','black-40':'rgba(0,0,0,0.4)','black-60':'rgba(0,0,0,0.6)','black-70':'rgba(0,0,0,0.7)',
    'white-5':'rgba(255,255,255,0.05)','white-10':'rgba(255,255,255,0.1)',
    'slate-700':'#334155','slate-800':'#1e293b','slate-900':'#0f172a','slate-100':'#f1f5f9',
    'red-10':'rgba(239,68,68,0.1)','red-500':'#ef4444','red-500\\/10':'rgba(239,68,68,0.1)',
    'green-10':'rgba(34,197,94,0.1)','green-500':'#22c55e','green-500\\/10':'rgba(34,197,94,0.1)',
    'blue-10':'rgba(59,130,246,0.1)','blue-600':'#2563eb','blue-500':'#3b82f6',
    'amber-20':'rgba(245,158,11,0.2)','amber-500':'#f59e0b','gray-800':'#1f2937','gray-900':'#111827',
    'primary':'var(--primary)','[var(--primary)]':'var(--primary)','[var(--bg-card)]':'var(--bg-card)',
    '[var(--bg-hover)]':'var(--bg-hover)','[var(--bg-secondary)]':'var(--bg-secondary)','[var(--bg-primary)]':'var(--bg-app)'
};
const COLORS_BORDER = {
    'white':'rgba(255,255,255,0.6)','white-5':'rgba(255,255,255,0.05)','white\\/10':'rgba(255,255,255,0.1)',
    'slate-700':'#334155','slate-600':'#475569','gray-700':'#374151','blue-20':'rgba(59,130,246,0.2)',
    'green-20':'rgba(34,197,94,0.2)','[var(--primary)]':'var(--primary)','[var(--border)]':'var(--border)','amber-500':'#f59e0b','green-500':'#22c55e','red-500':'#ef4444','transparent':'transparent','slate-700\/50':'rgba(51,65,85,0.5)','white\/5':'rgba(255,255,255,0.05)','white\/10':'rgba(255,255,255,0.1)','red-20':'rgba(239,68,68,0.2)','red-30':'rgba(239,68,68,0.3)','red-50':'rgba(239,68,68,0.5)','[var(--primary)]\/10':'rgba(99,102,241,0.1)','[var(--primary)]\/20':'rgba(99,102,241,0.2)'
};
const esc = c => c.replace(/[.:\/\[\]()%]/g, m => '\\' + m);
const out = [];
const emit = (cls, decls, variant) => {
    const sel = variant ? `.${esc(cls)}:${variant}` : `.${esc(cls)}`;
    const clean = decls.replace(/!important/g, ''); // solo las clases con prefijo ! llevan important
    const d = IMP ? clean.replace(/;/g, ' !important;') : clean;
    if (MEDIA) out.push(`@media (min-width: ${MEDIA}) { ${sel} { ${d} } }`);
    else out.push(`${sel} { ${d} }`);
};

let IMP = ''; let MEDIA = null;
for (const raw of Array.from(used).sort()) {
    let c = raw, variant = null, media = null;
    if (c.startsWith('md:')) { media = '768px'; c = c.slice(3); }
    else if (c.startsWith('lg:')) { media = '1024px'; c = c.slice(3); }
    else if (c.startsWith('sm:')) { media = '640px'; c = c.slice(3); }
    else if (c.startsWith('focus:')) { variant = 'focus'; c = c.slice(6); }
    MEDIA = media;
    if (c.startsWith('hover:')) { variant = 'hover'; c = c.slice(6); }
    if (c.startsWith('!')) { IMP = '1'; c = c.slice(1); } else { IMP = ''; }

    let m;
    if (c === 'hidden') { out.push(`.${esc(raw)} { display: none !important; }`); continue; }
    if (['flex'].includes(c)) { emit(raw, 'display: flex;', variant); continue; }
    if (c === 'inline-flex') { emit(raw, 'display: inline-flex;', variant); continue; }
    if (c === 'grid') { emit(raw, 'display: grid;', variant); continue; }
    if (c === 'block') { emit(raw, 'display: block;', variant); continue; }
    if (c === 'inline-block') { emit(raw, 'display: inline-block;', variant); continue; }
    if ((m = c.match(/^flex-(col|row)(-reverse)?$/))) { emit(raw, `flex-direction: ${m[1] === 'col' ? 'column' : 'row'}${m[2] ? '-reverse' : ''};`, variant); continue; }
    if (c === 'flex-1') { emit(raw, 'flex: 1 1 0%;', variant); continue; }
    if (c === 'flex-none') { emit(raw, 'flex: none;', variant); continue; }
    if (c === 'flex-wrap') { emit(raw, 'flex-wrap: wrap;', variant); continue; }
    if (c === 'flex-shrink-0' || c === 'shrink-0') { emit(raw, 'flex-shrink: 0;', variant); continue; }
    if ((m = c.match(/^items-(center|start|end|stretch|baseline)$/))) { emit(raw, `align-items: ${m[1] === 'start' ? 'flex-start' : m[1] === 'end' ? 'flex-end' : m[1]};`, variant); continue; }
    if ((m = c.match(/^justify-(between|center|start|end|around|evenly)$/))) { const j = {between:'space-between',center:'center',start:'flex-start',end:'flex-end',around:'space-around',evenly:'space-evenly'}[m[1]]; emit(raw, `justify-content: ${j};`, variant); continue; }
    if ((m = c.match(/^gap-(.+)$/))) { const v = sp(m[1]); if (v) emit(raw, `gap: ${v};`, variant); continue; }
    if ((m = c.match(/^(p|px|py|pt|pb|pl|pr)-(.+)$/))) {
        const v = sp(m[2]); if (!v) continue;
        const map = { p:'padding', px:['padding-left','padding-right'], py:['padding-top','padding-bottom'], pt:'padding-top', pb:'padding-bottom', pl:'padding-left', pr:'padding-right' }[m[1]];
        if (Array.isArray(map)) emit(raw, `${map[0]}: ${v}; ${map[1]}: ${v};`, variant);
        else emit(raw, `${map}: ${v};`, variant);
        continue;
    }
    if ((m = c.match(/^(-?)(m|mx|my|mt|mb|ml|mr)-(.+)$/))) {
        const v = sp(m[3]); if (!v) continue; const sign = m[1] ? '-' : '';
        const map = { m:'margin', mx:['margin-left','margin-right'], my:['margin-top','margin-bottom'], mt:'margin-top', mb:'margin-bottom', ml:'margin-left', mr:'margin-right' }[m[2]];
        if (Array.isArray(map)) emit(raw, `${map[0]}: ${sign}${v}; ${map[1]}: ${sign}${v};`, variant);
        else emit(raw, `${map}: ${sign}${v};`, variant);
        continue;
    }
    if ((m = c.match(/^space-(x|y)-(.+)$/))) { const v = sp(m[2]); if (!v) continue;
        emit(raw, m[1] === 'x' ? `& > * + * { margin-left: ${v}; }` : `& > * + * { margin-top: ${v}; }`, variant); continue; }
    if ((m = c.match(/^gap-(x|y)-(.+)$/))) { const v = sp(m[2]); if (!v) continue;
        emit(raw, m[1] === 'x' ? `column-gap: ${v};` : `row-gap: ${v};`, variant); continue; }
    if (c === 'w-full') { emit(raw, 'width: 100%;', variant); continue; }
    if (c === 'w-screen') { emit(raw, 'width: 100vw;', variant); continue; }
    if (c === 'w-auto') { emit(raw, 'width: auto;', variant); continue; }
    if (c === 'h-full') { emit(raw, 'height: 100%;', variant); continue; }
    if (c === 'h-screen') { emit(raw, 'height: 100vh;', variant); continue; }
    if ((m = c.match(/^[wh]-(\d+)$/))) { const v = sp(m[1]); if (v) emit(raw, `${c[0] === 'w' ? 'width' : 'height'}: ${v};`, variant); continue; }
    if (c === 'max-w-full') { emit(raw, 'max-width: 100%;', variant); continue; }
    if ((m = c.match(/^max-w-(xs|sm|md|lg|xl|2xl|3xl|4xl)$/))) { const mv = {xs:'20rem',sm:'24rem',md:'28rem',lg:'32rem',xl:'36rem','2xl':'42rem','3xl':'48rem','4xl':'56rem'}[m[1]]; emit(raw, `max-width: ${mv};`, variant); continue; }
    if ((m = c.match(/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl)$/))) { const tv = {xs:'0.75rem',sm:'0.8125rem',base:'0.875rem',lg:'1rem',xl:'1.125rem','2xl':'1.25rem','3xl':'1.5rem','4xl':'2rem'}[m[1]]; emit(raw, `font-size: ${tv};`, variant); continue; }
    if ((m = c.match(/^text-(\[var\(--[a-z-]+\)\]|[a-z]+-?[0-9a-z]*)$/)) && COLORS_TEXT[m[1]]) { emit(raw, `color: ${COLORS_TEXT[m[1]]}!important;`, variant); continue; }
    if (['text-center','text-left','text-right'].includes(c)) { emit(raw, `text-align: ${c.slice(5)};`, variant); continue; }
    if ((m = c.match(/^font-(bold|black|semibold|medium|normal)$/))) { const fv = {black:900,bold:700,semibold:600,medium:500,normal:400}[m[1]]; emit(raw, `font-weight: ${fv};`, variant); continue; }
    if (c === 'uppercase') { emit(raw, 'text-transform: uppercase;', variant); continue; }
    if (c === 'lowercase') { emit(raw, 'text-transform: lowercase;', variant); continue; }
    if (c === 'capitalize') { emit(raw, 'text-transform: capitalize;', variant); continue; }
    if (c === 'italic') { emit(raw, 'font-style: italic;', variant); continue; }
    if ((m = c.match(/^tracking-(wider|wide|tight|widest)$/))) { const tv = {wider:'0.05em',wide:'0.025em',tight:'-0.025em',widest:'0.1em'}[m[1]]; emit(raw, `letter-spacing: ${tv};`, variant); continue; }
    if ((m = c.match(/^leading-(tight|normal|relaxed)$/))) { const lv = {tight:1.2,normal:1.5,relaxed:1.7}[m[1]]; emit(raw, `line-height: ${lv};`, variant); continue; }
    if ((m = c.match(/^bg-(\[var\(--[a-z-]+\)\]|[a-z]+-?[0-9a-z\/]*)$/)) && COLORS_BG[m[1]]) { emit(raw, `background: ${COLORS_BG[m[1]]}!important;`, variant); continue; }
    if ((m = c.match(/^bg-white\/\[(0?\.[0-9]+)\]$/))) { emit(raw, `background: rgba(255,255,255,${m[1]});`, variant); continue; }
    if ((m = c.match(/^bg-(red|green|blue|amber|primary)-(\d+)\)$/))) { continue; }
    if ((m = c.match(/^bg-\[var\(--primary\)\]\/(10|20|5)$/))) { const o = {'5':0.05,'10':0.1,'20':0.2}[m[1]]; emit(raw, `background: rgba(99,102,241,${o})!important;`, variant); continue; }
    if ((m = c.match(/^bg-(slate-800|white|black)\/(\d+)$/))) {
        const base = {'slate-800':'30,41,59','white':'255,255,255','black':'0,0,0'}[m[1]];
        emit(raw, `background: rgba(${base},${m[2]/100})!important;`, variant); continue; }
    if ((m = c.match(/^text-\[(\d+)px\]$/))) { emit(raw, `font-size: ${m[1]}px!important;`, variant); continue; }
    if ((m = c.match(/^accent-(primary|amber-500|cyan-400|green-500|red-500|\[#0ba5ec\])$/))) {
        const av = {['primary']:'var(--primary)',['amber-500']:'#f59e0b',['cyan-400']:'#22d3ee',['green-500']:'#22c55e',['red-500']:'#ef4444',['[#0ba5ec]']:'#0ba5ec'}[m[1]];
        emit(raw, `accent-color: ${av};`, variant); continue; }
    if ((m = c.match(/^rounded(-sm|-md|-lg|-xl|-2xl|-full)?$/))) { const rv = {'':'var(--radius-md)','-sm':'var(--radius-sm)','-md':'var(--radius-md)','-lg':'var(--radius-lg)','-xl':'var(--radius-xl)','-2xl':'var(--radius-2xl)','-full':'var(--radius-full)'}[m[1]||'']; emit(raw, `border-radius: ${rv};`, variant); continue; }
    if (c === 'border') { emit(raw, 'border: 1px solid var(--border);', variant); continue; }
    if (c === 'border-2') { emit(raw, 'border: 2px solid var(--border);', variant); continue; }
    if (c === 'border-b') { emit(raw, 'border-bottom: 1px solid var(--border);', variant); continue; }
    if (c === 'border-t') { emit(raw, 'border-top: 1px solid var(--border);', variant); continue; }
    if (c === 'border-dashed') { emit(raw, 'border-style: dashed;', variant); continue; }
    if ((m = c.match(/^border-(\[var\(--[a-z-]+\)\]|[a-z]+-?[0-9a-z\/]*)$/)) && COLORS_BORDER[m[1]]) { emit(raw, `border-color: ${COLORS_BORDER[m[1]]}!important;`, variant); continue; }
    if ((m = c.match(/^border-l-(\[#[0-9a-f]+\]|amber-400|green-500|red-500)$/))) {
        const cv = m[1].startsWith('[') ? m[1].slice(1,-1) : {['amber-400']:'#fbbf24',['green-500']:'#22c55e',['red-500']:'#ef4444'}[m[1]];
        emit(raw, `border-left: 4px solid ${cv};`, variant); continue; }
    if ((m = c.match(/^grid-cols-([1-6])$/))) { emit(raw, `grid-template-columns: repeat(${m[1]}, minmax(0, 1fr));`, variant); continue; }
    if (['relative','absolute','fixed','sticky'].includes(c)) { emit(raw, `position: ${c};`, variant); continue; }
    if (c === 'inset-0') { emit(raw, 'top:0; right:0; bottom:0; left:0;', variant); continue; }
    if ((m = c.match(/^(top|left|right|bottom)-(\d+)$/))) { const v = sp(m[2]); if (v) emit(raw, `${m[1]}: ${v};`, variant); continue; }
    if (c === 'top-full') { emit(raw, 'top: 100%;', variant); continue; }
    if ((m = c.match(/^z-(\d+)$/))) { emit(raw, `z-index: ${m[1]};`, variant); continue; }
    if (c === 'overflow-hidden') { emit(raw, 'overflow: hidden;', variant); continue; }
    if (c === 'overflow-auto') { emit(raw, 'overflow: auto;', variant); continue; }
    if (c === 'overflow-y-auto') { emit(raw, 'overflow-y: auto;', variant); continue; }
    if (c === 'overflow-x-auto') { emit(raw, 'overflow-x: auto;', variant); continue; }
    if (c === 'overflow-visible') { emit(raw, 'overflow: visible;', variant); continue; }
    if (c === 'truncate') { emit(raw, 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;', variant); continue; }
    if (c === 'cursor-pointer') { emit(raw, 'cursor: pointer;', variant); continue; }
    if (c === 'cursor-not-allowed') { emit(raw, 'cursor: not-allowed;', variant); continue; }
    if (c === 'mx-auto') { emit(raw, 'margin-left: auto; margin-right: auto;', variant); continue; }
    if (c === 'transition') { emit(raw, 'transition: all var(--duration-normal) var(--ease);', variant); continue; }
    if (c === 'transition-all') { emit(raw, 'transition: all var(--duration-normal) var(--ease);', variant); continue; }
    if ((m = c.match(/^opacity-(\d+)$/))) { emit(raw, `opacity: ${m[1]/100};`, variant); continue; }
    if (c === 'align-middle') { emit(raw, 'vertical-align: middle;', variant); continue; }
    if (c === 'backdrop-blur-sm') { emit(raw, 'backdrop-filter: blur(4px);', variant); continue; }
    if (c === 'backdrop-blur-xl') { emit(raw, 'backdrop-filter: blur(24px);', variant); continue; }
    if (c === 'animate-pulse') { emit(raw, 'animation: pulse 2s infinite;', variant); continue; }
    if (c === 'animate-spin') { emit(raw, 'animation: spin 1s linear infinite;', variant); continue; }
    if (c === 'animate-fade-in') { emit(raw, 'animation: fadeIn 0.3s var(--ease);', variant); continue; }
    if (c === 'min-w-0') { emit(raw, 'min-width: 0;', variant); continue; }
    if (c === 'border-none') { emit(raw, 'border: none;', variant); continue; }
    if (c === 'border-transparent') { emit(raw, 'border-color: transparent;', variant); continue; }
    if ((m = c.match(/^border-l-(\[[^\]]+\]|[a-z0-9-]+\/[0-9]+|[a-z0-9-]+)$/)) && m[1] !== '4') {
        const cv = m[1].startsWith('[') ? m[1].slice(1,-1) : (COLORS_BORDER[m[1]] || ({['amber-400']:'#fbbf24',['green-500']:'#22c55e',['red-500']:'#ef4444'})[m[1]]);
        if (cv) { emit(raw, `border-left: 4px solid ${cv};`, variant); continue; } }
    if (c === 'border-l-4') { emit(raw, 'border-left-width: 4px;', variant); continue; }
    if (c === 'border-l-[#0ba5ec]' || c === 'border-l-[#34a853]') { emit(raw, `border-left: 4px solid ${c.includes('0ba5ec') ? '#0ba5ec' : '#34a853'};`, variant); continue; }
    if ((m = c.match(/^border-(white|slate-700|[a-z]+-?[0-9]*)\/(\d+)$/))) {
        const base = {'white':'255,255,255','slate-700':'51,65,85','red-500':'239,68,68','green-500':'34,197,94','blue-500':'59,130,246'}[m[1]];
        if (base) { emit(raw, `border-color: rgba(${base},${m[2]/100});`, variant); continue; } }
    if ((m = c.match(/^col-span-(full|[1-9]\d?)$/))) { emit(raw, `grid-column: ${m[1] === 'full' ? '1 / -1' : 'span ' + m[1] + ' / span ' + m[1]};`, variant); continue; }
    if ((m = c.match(/^grid-cols-(7|12)$/))) { emit(raw, `grid-template-columns: repeat(${m[1]}, minmax(0, 1fr));`, variant); continue; }
    if ((m = c.match(/^max-h-(\d+)$/))) { emit(raw, `max-height: ${sp(m[1])};`, variant); continue; }
    if ((m = c.match(/^max-h-\[(\d+)vh\]$/))) { emit(raw, `max-height: ${m[1]}vh;`, variant); continue; }
    if ((m = c.match(/^max-h-\[(\d+)px\]$/))) { emit(raw, `max-height: ${m[1]}px;`, variant); continue; }
    if (c === 'min-h-0') { emit(raw, 'min-height: 0;', variant); continue; }
    if ((m = c.match(/^min-h-\[(\d+)px\]$/))) { emit(raw, `min-height: ${m[1]}px;`, variant); continue; }
    if ((m = c.match(/^min-w-\[(\d+)px\]$/))) { emit(raw, `min-width: ${m[1]}px;`, variant); continue; }
    if ((m = c.match(/^m[trblxy]?-\[(\d+)vh\]$/))) {
        const prop = {mt:'margin-top',mb:'margin-bottom',ml:'margin-left',mr:'margin-right',mx:'margin-left',my:'margin-top',m:'margin'}[m[0].slice(0, m[0].indexOf('-'))] || 'margin-top';
        if (m[0].startsWith('mt')) emit(raw, `margin-top: ${m[1]}vh;`, variant);
        else if (m[0].startsWith('mb')) emit(raw, `margin-bottom: ${m[1]}vh;`, variant);
        continue; }
    if (c === 'mt-\[10vh\]' || true) { if ((m = c.match(/^mt-\[(\d+)vh\]$/))) { emit(raw, `margin-top: ${m[1]}vh;`, variant); continue; } }
    if (c === 'w-1/2') { emit(raw, 'width: 50%;', variant); continue; }
    if (c === 'h-1\/2') { emit(raw, 'height: 50%;', variant); continue; }
    if ((m = c.match(/^[wh]-(\d+)\/(\d+)$/))) { emit(raw, `${c[0] === 'w' ? 'width' : 'height'}: ${(m[1]/m[2]*100).toFixed(4)}%;`, variant); continue; }
    if (c === 'top-1/2') { emit(raw, 'top: 50%;', variant); continue; }
    if (c === '-translate-y-1/2') { emit(raw, 'transform: translateY(-50%);', variant); continue; }
    if (c === 'z-\[9999\]') { emit(raw, 'z-index: 9999;', variant); continue; }
    if ((m = c.match(/^tracking-\[([0-9.]+em)\]$/))) { emit(raw, `letter-spacing: ${m[1]};`, variant); continue; }
    if (c === 'text-10') { emit(raw, 'font-size: 10px;', variant); continue; }
    if (c === 'text-5xl') { emit(raw, 'font-size: 3rem;', variant); continue; }
    if (c === 'font-mono') { emit(raw, 'font-family: var(--font-mono);', variant); continue; }
    if (c === 'normal-case') { emit(raw, 'text-transform: none;', variant); continue; }
    if (c === 'break-all') { emit(raw, 'word-break: break-all;', variant); continue; }
    if (c === 'object-cover') { emit(raw, 'object-fit: cover;', variant); continue; }
    if (c === 'transition-colors') { emit(raw, 'transition: color var(--duration-normal) var(--ease), background-color var(--duration-normal) var(--ease), border-color var(--duration-normal) var(--ease);', variant); continue; }
    if ((m = c.match(/^duration-(\d+)$/))) { emit(raw, `transition-duration: ${m[1]}ms;`, variant); continue; }
    if (c === 'ease-out') { emit(raw, 'transition-timing-function: cubic-bezier(0, 0, 0.2, 1);', variant); continue; }
    if ((m = c.match(/^shadow-(sm|xl|2xl)$/))) { const sv = {sm:'var(--shadow-sm)',xl:'var(--shadow-xl)','2xl':'0 25px 50px -12px rgba(0,0,0,0.5)'}[m[1]]; emit(raw, `box-shadow: ${sv};`, variant); continue; }
    if (c === 'divide-y') { emit(raw, '& > * + * { border-top: 1px solid var(--border); }', variant); continue; }
    if (c === 'py-0\\.5' || c === 'py-0.5') { emit(raw, 'padding-top: 2px; padding-bottom: 2px;', variant); continue; }
    if (c === 'w-px') { emit(raw, 'width: 1px;', variant); continue; }
}

const css = `/**
 * utilities.css — generado por scripts/gen-utilities.js (F-UX unificación)
 * Subset de utilidades del vocabulario REAL del markup. No editar a mano:
 * regenerar con: node scripts/gen-utilities.js
 */
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

${out.join('\n')}
`;
fs.writeFileSync(path.join(__dirname, '..', 'public/css/modules/utilities.css'), css);
console.log(`utilities.css generado: ${out.length} reglas de ${used.size} clases analizadas`);
