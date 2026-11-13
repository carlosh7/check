/**
 * Promociones — Tragamonedas (P4 — paridad AppSorteos — v12.44.834)
 *
 * Juego promocional con captura de leads: cada visitante deja su email, jala la
 * palanca de la máquina UNA vez y los 3 rodillos caen en la combinación del premio
 * elegido por el servidor. El anfitrión obtiene los leads y estadísticas.
 *
 * Seguridad configurable (paridad AppSorteos): máx. participaciones por email,
 * whitelist de emails, límite por dispositivo/IP.
 * Probabilidades: "limitar chances" (peso % por combinación) y "limitar cantidades"
 * (stock por premio) — SÍ aplica probabilidad porque NO es un sorteo entre personas,
 * es un juego individual.
 *
 * Símbolos: cada premio lleva su combinación de 3 símbolos (symbols_json, ej.
 * ["🍒","🍒","7️⃣"]). El servidor devuelve la combinación del premio elegido y la
 * animación del cliente hace "girar" los rodillos hasta caer en ella.
 *
 * Enlace compartido (política del dueño, igual que fortuna/raspa/trivia): las
 * tragamonedas publicadas se EDITAN y controlan sin clave desde el enlace; auditado.
 *
 * @openapi
 * tags:
 *   - name: Slots
 *     description: Tragamonedas promocional (leads + premios por combinación de símbolos)
 *
 * /api/slots/events/{eventId}/slots:
 *   get:  { summary: Listar tragamonedas del evento, security: [{ BearerAuth: [] }] }
 *   post: { summary: Crear tragamonedas con plantilla por defecto, security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }] }
 * /api/slots/{id}:
 *   get:    { summary: Tragamonedas completa con premios, security: [{ BearerAuth: [] }] }
 *   put:    { summary: Actualizar (reemplaza premios si se envían), security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }] }
 *   delete: { summary: Eliminar, security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }] }
 * /api/slots/{id}/leads:      { summary: Participantes (leads), security: [{ BearerAuth: [] }] }
 * /api/slots/{id}/export-csv: { summary: Leads en CSV con BOM, security: [{ BearerAuth: [] }] }
 * /api/slots/{id}/qr:         { summary: QR del enlace de juego }
 * /api/slots/{id}/public-editor: { summary: Datos completos para el editor vía enlace (solo publicadas) }
 * /api/slots/{id}/public-config: { summary: Guardar desde el enlace (solo publicadas, auditado) }
 * /api/slots/{id}/public:    { summary: Datos de juego público (etiquetas, sin valores ni combinaciones) }
 * /api/slots/{id}/play:      { summary: Registrar lead + jalar palanca (devuelve los símbolos del premio) }
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { logAction } = require('../security/audit');

const logger = require("../utils/logger");
const router = express.Router();

// ── helpers ──

function parseJsonSafe(str, fallback) {
    // JSON.parse(null) devuelve null (válido) — normalizar a fallback
    if (str == null) return fallback;
    try { const v = JSON.parse(str); return v || fallback; } catch (e) { return fallback; }
}

// combinación por defecto cuando un premio llega sin símbolos (editor y servidor)
const DEFAULT_SYMBOLS = ['🍒', '🍋', '🔔'];

// normalizar la combinación: exactamente 3 símbolos, texto, sin vacíos
function normalizeSymbols(symbols) {
    let arr = Array.isArray(symbols) ? symbols : [];
    arr = arr.map(function(s) { return String(s == null ? '' : s).trim().slice(0, 12); }).filter(Boolean).slice(0, 3);
    while (arr.length < 3) arr.push(DEFAULT_SYMBOLS[arr.length] || '🍒');
    return arr;
}

function getSlot(id) {
    return db.prepare("SELECT * FROM slots WHERE id = ?").get(id);
}

function getPrizes(slotId) {
    return db.prepare("SELECT * FROM slot_prizes WHERE slot_id = ? ORDER BY order_index ASC").all(slotId);
}

// plantilla por defecto (paridad AppSorteos: trae combinaciones de ejemplo)
function defaultConfig() {
    return {
        language: 'es',
        texts: {
            title: '¡Pon a prueba tu suerte jalando la palanca!',
            description: '- Ingresa tu email para jugar.\n- Tienes un solo tirón.\n- ¡Buena suerte!',
            button: 'Jalar Palanca',
            winTitle: '¡Jackpot! ¡Has ganado!',
            winDesc: 'Te contactaremos por email con instrucciones para entregarte tu premio. ¡Gracias por participar!',
            loseTitle: '¡Oh! La palanca no te acompañó',
            loseDesc: 'Lo sentimos, esta vez no fue la combinación ganadora. ¡Gracias por participar!'
        },
        design: {
            bg_color: '#7c2d12',
            text_color: '#ffffff',
            button_color: '#f59e0b',
            machine_color: '#f59e0b',
            machine_style: 'rounded', // rounded | semi | square → border-radius 24px / 12px / 0px
            reel_bg: '#fffbeb',
            text_color_machine: '#7c2d12',
            duration: 6
        },
        form: { email: true, name: false, apellido: false, phone: false, consent_text: '' },
        security: { max_per_email: 1, allowed_emails: [], device_limit: 'off', device_max: 1 },
        limit_chances: false,
        limit_quantities: false,
        play_sounds: true,
        share_buttons: true,
        certificate: false,
        play_again_mode: 'auto',
        play_again_every: 3
    };
}

function defaultPrizes() {
    return [
        { type: 'cupon', label: '20% de descuento', value: 'SAVE20', symbols: ['7️⃣', '7️⃣', '7️⃣'] },
        { type: 'sin_premio', label: '¡Casi! Faltó poco', value: '', symbols: ['🍒', '🍒', '🍋'] },
        { type: 'premio', label: 'Premio sorpresa', value: '', symbols: ['💎', '💎', '💎'] },
        { type: 'sin_premio', label: '¡Suerte la próxima!', value: '', symbols: ['🍋', '🍒', '🔔'] },
        { type: 'cupon', label: 'Envío gratis', value: 'ENVIOGRATIS', symbols: ['🔔', '🔔', '🔔'] },
        { type: 'sin_premio', label: '¡Casi casi!', value: '', symbols: ['🍋', '🍋', '🍒'] }
    ];
}

function sanitizePrizes(prizes) {
    if (!Array.isArray(prizes) || prizes.length < 2) return 'La tragamonedas necesita al menos 2 combinaciones';
    if (prizes.length > 30) return 'Máximo 30 premios';
    for (const p of prizes) {
        if (!['sin_premio', 'premio', 'cupon', 'enlace'].includes(p.type)) return 'Tipo de premio inválido';
        if (!p.label || !String(p.label).trim()) return 'Toda combinación necesita un texto';
        if (String(p.label).length > 60) return 'Los textos de premio no pueden superar 60 caracteres';
        if ((p.type === 'cupon' || p.type === 'enlace') && !String(p.value || '').trim()) {
            return 'Los cupones y enlaces necesitan su valor';
        }
        if (p.symbols !== undefined && p.symbols !== null && !Array.isArray(p.symbols)) return 'Símbolos inválidos';
        if (p.quantity != null && (isNaN(parseInt(p.quantity)) || parseInt(p.quantity) < 0)) return 'Cantidad inválida';
        if (p.chance != null && (isNaN(parseFloat(p.chance)) || parseFloat(p.chance) < 0 || parseFloat(p.chance) > 100)) return 'Chance inválida (0-100)';
    }
    return null;
}

function notifyViews(id) {
    db.prepare("UPDATE slots SET views = views + 1 WHERE id = ?").run(id);
    return db.prepare("SELECT views FROM slots WHERE id = ?").get(id).views;
}

// selección ponderada de premio (paridad AppSorteos: chances + cantidades)
function pickPrize(prizes, config) {
    let pool = prizes.filter(function(p) {
        if (config.limit_quantities && p.quantity != null && parseInt(p.quantity) <= 0) return false;
        return true;
    });
    if (!pool.length) return null;
    const weights = pool.map(function(p) {
        if (config.limit_chances && p.chance != null && parseFloat(p.chance) > 0) return parseFloat(p.chance);
        return 1;
    });
    const total = weights.reduce(function(a, b) { return a + b; }, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) return { prize: pool[i], indexInPool: i };
    }
    return { prize: pool[pool.length - 1], indexInPool: pool.length - 1 };
}

// ── CRUD (anfitrión, JWT) ──

router.get('/events/:eventId/slots', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const list = db.prepare("SELECT * FROM slots WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId);
        list.forEach(function(s) {
            if (s.config_json) try { s.config = JSON.parse(s.config_json); } catch (e) {}
            s.prizeCount = db.prepare("SELECT COUNT(*) as c FROM slot_prizes WHERE slot_id = ?").get(s.id).c;
            const plays = db.prepare("SELECT COUNT(*) as c FROM slot_plays WHERE slot_id = ?").get(s.id);
            s.stats = { plays: plays ? plays.c : 0, views: s.views || 0 };
        });
        res.json(list);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events/:eventId/slots', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { name } = req.body || {};
        if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nombre requerido' });
        if (String(name).length > 200) return res.status(400).json({ error: 'Nombre demasiado largo' });
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO slots (id, event_id, name, config_json, status, views, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', 0, ?, ?)").run(
            id, req.params.eventId, String(name).trim(), JSON.stringify(defaultConfig()), now, now
        );
        const insert = db.prepare("INSERT INTO slot_prizes (id, slot_id, type, label, value, symbols_json, quantity, chance, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)");
        defaultPrizes().forEach(function(p, i) {
            insert.run(uuidv4(), id, p.type, p.label, p.value || null, JSON.stringify(normalizeSymbols(p.symbols)), i, now);
        });
        try { logAction(req, 'SLOT_CREATE', { slotId: id, name: String(name).trim() }); } catch (e) {}
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const s = getSlot(req.params.id);
        if (!s) return res.status(404).json({ error: 'Tragamonedas no encontrada' });
        if (s.config_json) try { s.config = JSON.parse(s.config_json); } catch (e) {}
        s.prizes = getPrizes(s.id).map(function(p, i) {
            return { id: p.id, type: p.type, label: p.label, value: p.value, symbols: parseJsonSafe(p.symbols_json, DEFAULT_SYMBOLS.slice()), quantity: p.quantity, chance: p.chance, orderIndex: i };
        });
        res.json(s);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const s = getSlot(req.params.id);
        if (!s) return res.status(404).json({ error: 'Tragamonedas no encontrada' });
        const { name, config, status, prizes } = req.body || {};
        if (name !== undefined && (!String(name).trim() || String(name).length > 200)) {
            return res.status(400).json({ error: 'Nombre inválido' });
        }
        if (status !== undefined && !['draft', 'published'].includes(status)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }
        db.prepare("UPDATE slots SET name = COALESCE(?, name), config_json = COALESCE(?, config_json), status = COALESCE(?, status), updated_at = ? WHERE id = ?").run(
            name ? String(name).trim() : null,
            config ? JSON.stringify(config) : null,
            status || null,
            new Date().toISOString(), s.id
        );
        let err = null;
        if (Array.isArray(prizes)) {
            err = sanitizePrizes(prizes);
            if (!err) {
                const tx = db.transaction(function() {
                    db.prepare("DELETE FROM slot_prizes WHERE slot_id = ?").run(s.id);
                    const insert = db.prepare("INSERT INTO slot_prizes (id, slot_id, type, label, value, symbols_json, quantity, chance, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    prizes.forEach(function(p, i) {
                        insert.run(uuidv4(), s.id, p.type, String(p.label).trim(), p.value ? String(p.value).trim() : null,
                            JSON.stringify(normalizeSymbols(p.symbols)),
                            p.quantity != null ? parseInt(p.quantity) : null,
                            p.chance != null ? parseFloat(p.chance) : null,
                            i, new Date().toISOString());
                    });
                });
                tx();
            }
        }
        if (err) return res.status(400).json({ error: err });
        try { logAction(req, 'SLOT_UPDATE', { slotId: s.id, prizes: Array.isArray(prizes) ? prizes.length : undefined }); } catch (e) {}
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const s = getSlot(req.params.id);
        if (!s) return res.status(404).json({ error: 'Tragamonedas no encontrada' });
        const tx = db.transaction(function() {
            db.prepare("DELETE FROM slot_plays WHERE slot_id = ?").run(s.id);
            db.prepare("DELETE FROM slot_prizes WHERE slot_id = ?").run(s.id);
            db.prepare("DELETE FROM slots WHERE id = ?").run(s.id);
        });
        tx();
        try { logAction(req, 'SLOT_DELETE', { slotId: s.id }); } catch (e) {}
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Leads y CSV ──

router.get('/:id/leads', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const s = getSlot(req.params.id);
        if (!s) return res.status(404).json({ error: 'Tragamonedas no encontrada' });
        const plays = db.prepare("SELECT id, email, name, apellido, phone, symbols_json, prize_label, prize_type, prize_value, created_at FROM slot_plays WHERE slot_id = ? ORDER BY created_at DESC").all(s.id);
        res.json(plays.map(function(p) {
            return Object.assign({}, p, { symbols: parseJsonSafe(p.symbols_json, []) });
        }));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/export-csv', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const s = getSlot(req.params.id);
        if (!s) return res.status(404).json({ error: 'Tragamonedas no encontrada' });
        const plays = db.prepare("SELECT email, name, apellido, phone, symbols_json, prize_label, prize_type, prize_value, created_at FROM slot_plays WHERE slot_id = ? ORDER BY created_at ASC").all(s.id);
        const esc = function(v) { const sv = v == null ? '' : String(v); return /[",;\n]/.test(sv) ? '"' + sv.replace(/"/g, '""') + '"' : sv; };
        const combo = function(str) { const a = parseJsonSafe(str, []); return Array.isArray(a) ? a.join(' ') : ''; };
        let csv = '\uFEFFemail,nombre,apellido,telefono,combinacion,premio,tipo,valor,fecha\n';
        plays.forEach(function(p) {
            csv += esc(p.email) + ',' + esc(p.name) + ',' + esc(p.apellido) + ',' + esc(p.phone) + ',' + esc(combo(p.symbols_json)) + ',' + esc(p.prize_label) + ',' + esc(p.prize_type) + ',' + esc(p.prize_value) + ',' + esc(p.created_at) + '\n';
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=tragamonedas_leads.csv');
        res.send(csv);
    } catch (err) {
        logger.error('[SLOT] CSV error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── QR del enlace de juego (self-hosted, paridad fortuna) ──

router.get('/:id/qr', async (req, res) => {
    try {
        const s = getSlot(req.params.id);
        if (!s) return res.status(404).json({ error: 'Tragamonedas no encontrada' });
        const event = db.prepare("SELECT name FROM events WHERE id = ?").get(s.event_id);
        const slug = ((event && event.name) || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.headers['x-forwarded-host'] || req.get('host') || '';
        const url = proto + '://' + host + '/' + slug + '/tragamonedas/' + s.id + '/jugar';
        const size = Math.min(Math.max(parseInt(req.query.size) || 300, 120), 800);
        const buf = await require('qrcode').toBuffer(url, { width: size, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' } });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(buf);
    } catch (err) {
        logger.error('[SLOT] QR error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Enlace compartido (política del dueño: publicadas editables sin clave, auditado) ──

router.get('/:id/public-editor', (req, res) => {
    try {
        const s = getSlot(req.params.id);
        if (!s) return res.status(404).json({ error: 'Tragamonedas no encontrada' });
        if (s.status !== 'published') return res.status(403).json({ error: 'Solo las tragamonedas publicadas se abren desde el enlace' });
        const event = db.prepare("SELECT id, name FROM events WHERE id = ?").get(s.event_id);
        res.json({
            id: s.id, event_id: s.event_id, event_name: event ? event.name : 'Evento',
            name: s.name, status: s.status, config: parseJsonSafe(s.config_json, {}),
            prizes: getPrizes(s.id).map(function(p, i) {
                return { id: p.id, type: p.type, label: p.label, value: p.value, symbols: parseJsonSafe(p.symbols_json, DEFAULT_SYMBOLS.slice()), quantity: p.quantity, chance: p.chance, orderIndex: i };
            }),
            views: s.views || 0
        });
    } catch (err) {
        logger.error('[SLOT] Public editor error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id/public-config', (req, res) => {
    try {
        const s = getSlot(req.params.id);
        if (!s) return res.status(404).json({ error: 'Tragamonedas no encontrada' });
        if (s.status !== 'published') {
            return res.status(403).json({ error: 'Solo las tragamonedas publicadas aceptan cambios desde el enlace' });
        }
        const { config, prizes } = req.body || {};
        if (config !== undefined) {
            if (typeof config !== 'object' || config === null || Array.isArray(config)) {
                return res.status(400).json({ error: 'config inválida' });
            }
            const json = JSON.stringify(config);
            if (json.length > 100000) return res.status(400).json({ error: 'Configuración demasiado grande' });
            db.prepare("UPDATE slots SET config_json = ?, updated_at = ? WHERE id = ?").run(json, new Date().toISOString(), s.id);
        }
        if (prizes !== undefined) {
            const err = sanitizePrizes(prizes);
            if (err) return res.status(400).json({ error: err });
            const tx = db.transaction(function() {
                db.prepare("DELETE FROM slot_prizes WHERE slot_id = ?").run(s.id);
                const insert = db.prepare("INSERT INTO slot_prizes (id, slot_id, type, label, value, symbols_json, quantity, chance, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                prizes.forEach(function(p, i) {
                    insert.run(uuidv4(), s.id, p.type, String(p.label).trim(), p.value ? String(p.value).trim() : null,
                        JSON.stringify(normalizeSymbols(p.symbols)),
                        p.quantity != null ? parseInt(p.quantity) : null,
                        p.chance != null ? parseFloat(p.chance) : null,
                        i, new Date().toISOString());
                });
            });
            tx();
        }
        try { logAction(req, 'SLOT_PUBLIC_SAVE', { slotId: s.id, prizes: Array.isArray(prizes) ? prizes.length : undefined }); } catch (e) {}
        res.json({ success: true });
    } catch (err) {
        logger.error('[SLOT] Public save error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Público: datos de juego (etiquetas, NUNCA los valores ni las combinaciones ocultas) ──

router.get('/:id/public', (req, res) => {
    try {
        const s = getSlot(req.params.id);
        if (!s) return res.status(404).json({ error: 'Tragamonedas no encontrada' });
        if (s.status !== 'published') return res.status(403).json({ error: 'Esta promoción no está activa' });
        const views = notifyViews(s.id);
        const config = parseJsonSafe(s.config_json, {});
        const prizes = getPrizes(s.id);
        res.json({
            id: s.id,
            name: s.name,
            views: views,
            texts: config.texts || {},
            design: config.design || {},
            form: Object.assign({ email: true }, config.form || {}),
            security: { max_per_email: (config.security && config.security.max_per_email != null) ? config.security.max_per_email : 1 },
            play_sounds: config.play_sounds !== false,
            share_buttons: config.share_buttons === true,
            certificate: config.certificate === true,
            play_again: { mode: config.play_again_mode || 'auto', every: config.play_again_every || 3 },
            segments: prizes.map(function(p, i) { return { index: i, label: p.label }; })
        });
    } catch (err) {
        logger.error('[SLOT] Public error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Público: registrar lead + jalar la palanca (una llamada atómica) ──

router.post('/:id/play', (req, res) => {
    try {
        const s = getSlot(req.params.id);
        if (!s) return res.status(404).json({ error: 'Tragamonedas no encontrada' });
        if (s.status !== 'published') return res.status(403).json({ error: 'Esta promoción no está activa' });
        const config = parseJsonSafe(s.config_json, {});
        const sec = config.security || {};
        const email = String((req.body && req.body.email) || '').trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Ingresa un email válido' });
        // whitelist (paridad AppSorteos "Emails permitidos")
        const whitelist = (sec.allowed_emails || []).map(function(e) { return String(e).trim().toLowerCase(); }).filter(Boolean);
        if (whitelist.length && whitelist.indexOf(email) === -1) return res.status(403).json({ error: 'Este email no está en la lista de permitidos' });
        // máx. participaciones por email
        const maxEmail = sec.max_per_email != null ? parseInt(sec.max_per_email) : 1;
        const yaEmail = db.prepare("SELECT COUNT(*) as c FROM slot_plays WHERE slot_id = ? AND lower(email) = ?").get(s.id, email).c;
        if (yaEmail >= maxEmail) return res.status(403).json({ error: 'Ya participaste con este email' });
        // límite por dispositivo / IP
        const deviceId = String((req.body && req.body.deviceId) || '').slice(0, 64);
        const ip = req.ip || '';
        const dLimit = sec.device_limit || 'off';
        if (dLimit === 'browser' || dLimit === 'ip') {
            const dMax = sec.device_max != null ? parseInt(sec.device_max) : 1;
            const keyCol = dLimit === 'ip' ? 'ip' : 'device_id';
            const keyValue = dLimit === 'ip' ? ip : deviceId;
            if (keyValue) {
                const yaDev = db.prepare("SELECT COUNT(*) as c FROM slot_plays WHERE slot_id = ? AND " + keyCol + " = ?").get(s.id, keyValue).c;
                if (yaDev >= dMax) return res.status(403).json({ error: 'Ya participaste desde este dispositivo' });
            }
        }
        const prizes = getPrizes(s.id);
        if (!prizes.length) return res.status(400).json({ error: 'La tragamonedas no tiene combinaciones' });
        const picked = pickPrize(prizes, config);
        if (!picked) return res.status(400).json({ error: 'No quedan premios disponibles' });
        const prize = picked.prize;
        const symbols = normalizeSymbols(parseJsonSafe(prize.symbols_json, DEFAULT_SYMBOLS.slice()));
        const playId = uuidv4();
        const now = new Date().toISOString();
        const tx = db.transaction(function() {
            db.prepare("INSERT INTO slot_plays (id, slot_id, email, name, apellido, phone, custom_json, symbols_json, prize_label, prize_type, prize_value, ip, device_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
                playId, s.id, email,
                String((req.body && req.body.name) || '').slice(0, 120) || null,
                String((req.body && req.body.apellido) || '').slice(0, 120) || null,
                String((req.body && req.body.phone) || '').slice(0, 40) || null,
                (req.body && req.body.consent) ? JSON.stringify({ consent: true }) : null,
                JSON.stringify(symbols),
                prize.label, prize.type,
                prize.type === 'cupon' || prize.type === 'enlace' ? (prize.value || null) : null,
                ip, deviceId || null, now
            );
            // limitar cantidades: descontar stock del premio ganado
            if (config.limit_quantities && prize.quantity != null) {
                db.prepare("UPDATE slot_prizes SET quantity = quantity - 1 WHERE id = ? AND quantity > 0").run(prize.id);
            }
        });
        tx();
        const win = prize.type !== 'sin_premio';
        // LOS SÍMBOLOS SON LA COMBINACIÓN DEL PREMIO: la animación del cliente los
        // hace "girar" y caer exactamente en esta combinación
        res.json({
            success: true,
            playId: playId,
            symbols: symbols,
            prize: {
                label: prize.label,
                type: prize.type,
                win: win,
                value: (prize.type === 'cupon' || prize.type === 'enlace') ? (prize.value || null) : null
            }
        });
    } catch (err) {
        logger.error('[SLOT] Play error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Público: comprobante PDF de una jugada ──

// jsPDF usa fuentes estándar WinAnsi: los emojis NO se renderizan (salen mojibake).
// El comprobante muestra la combinación con nombres legibles + codepoint de reserva.
function symbolName(sym) {
    const map = {
        '🍒': 'cereza', '🍋': 'limon', '🔔': 'campana', '💎': 'diamante', '7️⃣': 'siete',
        '🍇': 'uva', '🍉': 'sandia', '🍓': 'fresa', '⭐': 'estrella', '🌟': 'estrella',
        '✨': 'destello', '🎁': 'regalo', '💰': 'dinero', '🪙': 'moneda', '👑': 'corona',
        '🍀': 'trebol', '☘️': 'trebol', '🔥': 'fuego', '⚡': 'rayo', '🃏': 'comodin',
        '🏆': 'trofeo', '🎯': 'diana', '🎰': 'tragamonedas', '❤️': 'corazon', 'coin': 'moneda'
    };
    if (map[sym]) return map[sym];
    try {
        const cp = String(sym).codePointAt(0).toString(16).toUpperCase();
        return 'simbolo U+' + cp;
    } catch (e) { return 'simbolo'; }
}

router.get('/:id/certificate', (req, res) => {
    try {
        const s = getSlot(req.params.id);
        if (!s) return res.status(404).json({ error: 'Tragamonedas no encontrada' });
        const playId = String(req.query.play || '').trim();
        const play = db.prepare("SELECT * FROM slot_plays WHERE slot_id = ? AND id = ?").get(s.id, playId);
        if (!play) return res.status(404).json({ error: 'Jugada no encontrada' });
        const evento = db.prepare("SELECT name FROM events WHERE id = ?").get(s.event_id);
        const symbols = parseJsonSafe(play.symbols_json, DEFAULT_SYMBOLS.slice());
        const comboTxt = (Array.isArray(symbols) && symbols.length ? symbols : DEFAULT_SYMBOLS.slice()).map(symbolName).join(' - ');
        const { jsPDF } = require('jspdf');
        const doc = new jsPDF();
        doc.setFontSize(20); doc.setTextColor(124, 45, 18);
        doc.text('Comprobante de Tragamonedas', 14, 28);
        doc.setFontSize(12); doc.setTextColor(60);
        doc.text('Promocion: ' + s.name, 14, 40);
        doc.text('Evento: ' + (evento ? evento.name : 'N/A'), 14, 48);
        doc.setFontSize(11); doc.setTextColor(80);
        doc.text('Participante: ' + play.email, 14, 60);
        if (play.name) doc.text('Nombre: ' + play.name + (play.apellido ? ' ' + play.apellido : ''), 14, 68);
        doc.text('Combinacion: ' + comboTxt, 14, play.name ? 76 : 68);
        doc.text('Resultado: ' + play.prize_label + ' (' + play.prize_type + ')', 14, play.name ? 84 : 76);
        const yCod = play.name ? 92 : 84;
        doc.setFontSize(13); doc.setTextColor(124, 45, 18);
        doc.text('Codigo: ' + play.id.slice(0, 8).toUpperCase(), 14, yCod);
        doc.setFontSize(9); doc.setTextColor(150);
        doc.text('Fecha: ' + (play.created_at || '').replace('T', ' ').slice(0, 19), 14, yCod + 10);
        doc.text('Powered by Check Pro', 14, 290);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=comprobante_' + play.id.slice(0, 8) + '.pdf');
        res.send(Buffer.from(doc.output('arraybuffer')));
    } catch (err) {
        logger.error('[SLOT] Certificate error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
