/**
 * DelegatedEvents — Delegación global de eventos + aplicador de estilos (v12.44.811)
 *
 * Sustituye TODOS los atributos on*= y style= inline (estáticos y generados),
 * lo que permite cerrar script-src-attr y style-src-attr en la CSP.
 *
 * Convención:
 *   data-act="call"  data-call="método"  data-a1..a3="arg"
 *        → llama App[método](a1, a2, a3) (o window[método] en páginas públicas).
 *   Acciones integradas:
 *     hide / show          data-target="id"
 *     sidebarToggle        (abre/cierra el drawer + overlay)
 *     sidebarClose         (cierra drawer + overlay)
 *     clickTarget          data-target="id" (inputs file programáticos)
 *     clearCall            data-target="id1,id2" data-call="m1,m2" (limpia y llama)
 *     submitForm           data-call="saveX" (preventDefault + llamada)
 *     onEnter              data-call="m" (solo tecla Enter)
 *     block                (preventDefault puro — antes onsubmit="return false")
 *     lang                 data-a1="es|en"
 *     openLanding          (landing del evento actual)
 *     thenCall             data-call="m1" data-then="m2:arg" (m1(); App.m2(arg))
 *
 * Estilos: data-style="css" se aplica vía CSSOM (el.style.cssText), que no está
 * sujeto a style-src. Un MutationObserver procesa los nodos que se añadan.
 */

const HANDLED = ['click', 'change', 'input', 'submit', 'keydown', 'focus', 'blur'];

function resolve(method) {
    const app = window.App;
    if (app && typeof app[method] === 'function') return app[method].bind(app);
    if (typeof window[method] === 'function') return window[method];
    console.warn('[DELEG] Método no encontrado:', method);
    return null;
}

// Tokens de args (evaluados contra el elemento o App — sin eval):
//   @this / @this.value / @this.checked   propiedad del elemento
//   @app:clave        → App.clave (referencias a objetos, p.ej. selecciones)
//   @float:def        → parseFloat(el.value) || def
//   @int:def          → parseInt(el.value) || def
//   @check:T:F        → el.checked ? T : F
// literales 'true'/'false'/números se re-convierten a su tipo
function expandArg(a, node) {
    if (typeof a !== 'string') return a;
    if (a === 'true') return true;
    if (a === 'false') return false;
    if (/^-\d+$/.test(a)) return parseInt(a, 10);
    if (/^-?\d+\.\d+$/.test(a)) return parseFloat(a);
    if (a.startsWith('@this')) {
        const rest = a.slice(5);
        return rest ? node[rest.slice(1)] : node;
    }
    if (a.startsWith('@app:')) return window.App ? window.App[a.slice(5)] : undefined;
    if (a === '@groupIds') {
        const sel = window.App?.state?.selectedGroups;
        return (sel && sel.length > 0) ? sel : Array.from(document.querySelectorAll('.group-checkbox:checked')).map(cb => cb.dataset.groupId);
    }
    if (a.startsWith('@fn:')) return typeof window[a.slice(4)] === 'function' ? window[a.slice(4)]() : undefined;
    if (a.startsWith('@float:')) return parseFloat(node.value) || parseFloat(a.slice(7));
    if (a.startsWith('@int:')) return parseInt(node.value, 10) || parseInt(a.slice(5), 10);
    if (a.startsWith('@check:')) {
        const [t, f] = a.slice(7).split(':');
        return node.checked ? (isNaN(t) ? t : Number(t)) : (isNaN(f) ? f : Number(f));
    }
    return a;
}

function act(node, event) {
    const kind = node.dataset.act;
    if (!kind) return;
    const d = node.dataset;
    const target = (id) => document.getElementById(id);
    const targets = (d.target || '').split(',').map(s => s.trim()).filter(Boolean);

    switch (kind) {
        case 'call': {
            if (d.stop && event) event.stopPropagation();
            const fn = resolve(d.call);
            if (fn) fn(...[d.a1, d.a2, d.a3, d.a4].filter(a => a !== undefined).map(a => expandArg(a, node)));
            break;
        }
        case 'goto': {
            event?.preventDefault();
            window.location.href = '/' + (d.a1 ? '?event=' + d.a1 : '');
            break;
        }
        case 'badgeOpacityInput': {
            const lbl = target(d.target);
            if (lbl) lbl.textContent = Math.round(parseFloat(d.a2) * 100) + '%';
            const fn = resolve('updateBadgeElementProperty');
            if (fn) fn(d.a1, 'opacity', parseFloat(d.a2));
            break;
        }
        case 'parentRemoveShow':
            node.parentElement?.classList.remove('show');
            break;
        case 'reload':
            window.location.reload();
            break;
        case 'removeEl':
            targets.forEach(id => target(id)?.remove());
            break;
        case 'removeClosest':
            node.closest('#' + d.target)?.remove();
            break;
        case 'removeParent':
            node.parentElement?.remove();
            break;
        case 'callEl': {
            // App.método(getElementById(target)[prop || 'value'])
            const el = target(d.target);
            const fn = resolve(d.call);
            if (el && fn) fn(el[d.prop || 'value']);
            break;
        }
        case 'callAttr': {
            // App.método(getElementById(target).getAttribute(attr))
            const el = target(d.target);
            const fn = resolve(d.call);
            if (el && fn) fn(el.getAttribute(d.attr));
            break;
        }
        case 'hide':
            targets.forEach(id => target(id)?.classList.add('hidden'));
            break;
        case 'show':
            targets.forEach(id => target(id)?.classList.remove('hidden'));
            break;
        case 'sidebarToggle': {
            target('global-sidebar')?.classList.toggle('open');
            target('sidebar-overlay')?.classList.toggle('active');
            break;
        }
        case 'sidebarClose': {
            target('global-sidebar')?.classList.remove('open');
            target('sidebar-overlay')?.classList.remove('active');
            break;
        }
        case 'clickTarget':
            targets.forEach(id => target(id)?.click());
            break;
        case 'clearCall': {
            targets.forEach(id => { const el = target(id); if (el) el.value = ''; });
            (d.call || '').split('|').map(s => s.trim()).filter(Boolean).forEach(spec => {
                const [m, ...args] = spec.split(',');
                const fn = resolve(m.trim());
                if (fn) fn(...args.map(a => expandArg(a.trim(), node)));
            });
            break;
        }
        case 'submitForm':
            if (event) event.preventDefault();
            { const fn = resolve(d.call); if (fn) fn(...[d.a1, d.a2].filter(a => a !== undefined).map(a => expandArg(a, node))); }
            break;
        case 'onEnter':
            if (event && event.key === 'Enter') { const fn = resolve(d.call); if (fn) fn(); }
            break;
        case 'block':
            if (event) event.preventDefault();
            break;
        case 'lang':
            if (window.i18n?.setLang) window.i18n.setLang(d.a1);
            break;
        case 'openLanding': {
            const ev = window.App?.state?.event;
            if (ev) window.open('/' + (ev.slug || ev.id) + '/landing', '_blank');
            break;
        }
        case 'thenCall': {
            const fn = resolve(d.call);
            if (fn) fn();
            if (d.then) {
                const [m, arg] = d.then.split(':');
                const fn2 = resolve(m);
                if (fn2) fn2(arg);
            }
            break;
        }
        default:
            console.warn('[DELEG] Acción desconocida:', kind);
    }
}

function handle(event) {
    let node = event.target;
    while (node && node !== document) {
        if (node.dataset && node.dataset.act) {
            // en submit el interés es el form; en el resto, el elemento con data-act
            if (event.type === 'submit' && node.tagName !== 'FORM') { node = node.parentElement; continue; }
            act(node, event);
            return;
        }
        node = node.parentElement;
    }
}

function applyStyle(el) {
    if (!el || !el.dataset || el.dataset.style === undefined) return;
    if (el.dataset.styleApplied) return;
    try {
        el.style.cssText = el.dataset.style;
        el.dataset.styleApplied = '1';
    } catch (e) { console.warn('[DELEG] data-style inválido:', el.dataset.style); }
}

function applyStylesIn(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.dataset && root.dataset.style !== undefined) applyStyle(root);
    root.querySelectorAll('[data-style]').forEach(applyStyle);
}

let observer = null;

function initDelegatedEvents() {
    HANDLED.forEach(ev => document.addEventListener(ev, handle, ev === 'submit' || ev === 'keydown'));

    // estilos existentes al arrancar + los que lleguen por mutación
    applyStylesIn(document);
    observer = new MutationObserver((muts) => {
        for (const m of muts) {
            if (m.type === 'attributes' && m.attributeName === 'data-style') {
                m.target.dataset.styleApplied = '';
                applyStyle(m.target);
            }
            m.addedNodes?.forEach(n => {
                if (n.nodeType === 1) applyStylesIn(n);
            });
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-style'] });
}

// idempotente: se puede llamar desde app.js y desde páginas standalone
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDelegatedEvents, { once: true });
} else {
    initDelegatedEvents();
}

export { initDelegatedEvents };
