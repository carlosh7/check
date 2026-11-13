/**
 * Promociones — Raspa y Gana (P2 — paridad AppSorteos — v12.44.834)
 *
 * Juego promocional con captura de leads: cada visitante deja su email, raspa UNA
 * tarjeta dorada y descubre su premio/cupón. El anfitrión obtiene los leads y estadísticas.
 *
 * Seguridad configurable (paridad AppSorteos): máx. participaciones por email,
 * whitelist de emails, límite por dispositivo/IP.
 * Probabilidades: "limitar chances" (peso % por premio) y "limitar cantidades"
 * (stock por premio) — el servidor elige el premio ANTES de mostrar la tarjeta
 * (misma política que la ruleta: la app manda, el navegador no decide nada).
 *
 * Enlace compartido (política del dueño, igual que ruleta/fortuna): las promociones
 * publicadas se EDITAN y controlan sin clave desde el enlace; auditado.
 *
 * @openapi
 * tags:
 *   - name: Raspas
 *     description: Raspa y Gana promocional (leads + premios por tarjeta)
 *
 * /api/raspas/events/{eventId}/raspas:
 *   get:  { summary: Listar raspas del evento, security: [{ BearerAuth: [] }] }
 *   post: { summary: Crear raspa con plantilla por defecto, security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }] }
 * /api/raspas/{id}:
 *   get:    { summary: Raspa completa con premios, security: [{ BearerAuth: [] }] }
 *   put:    { summary: Actualizar (reemplaza premios si se envían), security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }] }
 *   delete: { summary: Eliminar, security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }] }
 * /api/raspas/{id}/leads:      { summary: Participantes (leads), security: [{ BearerAuth: [] }] }
 * /api/raspas/{id}/export-csv: { summary: Leads en CSV con BOM, security: [{ BearerAuth: [] }] }
 * /api/raspas/{id}/qr:         { summary: QR del enlace de juego }
 * /api/raspas/{id}/public-editor: { summary: Datos completos para el editor vía enlace (solo publicadas) }
 * /api/raspas/{id}/public-config: { summary: Guardar desde el enlace (solo publicadas, auditado) }
 * /api/raspas/{id}/public:    { summary: Datos de juego público (etiquetas de premios, sin valores) }
 * /api/raspas/{id}/play:      { summary: Registrar lead + raspar (devuelve el premio) }
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

function getRaspa(id) {
    return db.prepare("SELECT * FROM raspas WHERE id = ?").get(id);
}

function getPrizes(raspaId) {
    return db.prepare("SELECT * FROM raspa_prizes WHERE raspa_id = ? ORDER BY order_index ASC").all(raspaId);
}

// plantilla por defecto (paridad AppSorteos: trae premios de ejemplo)
function defaultConfig() {
    return {
        language: 'es',
        texts: {
            title: '¡Raspa y gana premios!',
            description: '- Ingresa tu email para jugar.\n- Puedes raspar una vez.\n- ¡Buena suerte!',
            button: 'Probar Suerte',
            winTitle: 'Felicitaciones, ¡has ganado!',
            winDesc: 'Te contactaremos por email con instrucciones para entregarte tu premio. ¡Gracias por participar!',
            loseTitle: '¡Oh! Parece que has perdido',
            loseDesc: 'Lo sentimos, no has tenido suerte. ¡Gracias por participar!'
        },
        design: {
            bg_color: '#6d28d9',
            text_color: '#ffffff',
            button_color: '#f59e0b',
            raspadita_color: '#d4a017',
            raspadita_texto: 'Raspa y Gana',
            text_color_raspa: '#7c2d12',
            card_color: '#f59e0b'
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
        { type: 'cupon', label: '20% de descuento', value: 'SAVE20' },
        { type: 'sin_premio', label: '¡Sigue intentando!', value: '' },
        { type: 'premio', label: 'Premio sorpresa', value: '' },
        { type: 'sin_premio', label: '¡Casi casi!', value: '' },
        { type: 'cupon', label: 'Envío gratis', value: 'ENVIOGRATIS' },
        { type: 'sin_premio', label: '¡Suerte la próxima!', value: '' }
    ];
}

function sanitizePrizes(prizes) {
    if (!Array.isArray(prizes) || prizes.length < 2) return 'El juego necesita al menos 2 premios';
    if (prizes.length > 30) return 'Máximo 30 premios';
    for (const p of prizes) {
        if (!['sin_premio', 'premio', 'cupon', 'enlace'].includes(p.type)) return 'Tipo de premio inválido';
        if (!p.label || !String(p.label).trim()) return 'Toda tarjeta necesita un texto de premio';
        if (String(p.label).length > 60) return 'Los textos de premio no pueden superar 60 caracteres';
        if ((p.type === 'cupon' || p.type === 'enlace') && !String(p.value || '').trim()) {
            return 'Los cupones y enlaces necesitan su valor';
        }
        if (p.quantity != null && (isNaN(parseInt(p.quantity)) || parseInt(p.quantity) < 0)) return 'Cantidad inválida';
        if (p.chance != null && (isNaN(parseFloat(p.chance)) || parseFloat(p.chance) < 0 || parseFloat(p.chance) > 100)) return 'Chance inválida (0-100)';
    }
    return null;
}

function notifyViews(id) {
    db.prepare("UPDATE raspas SET views = views + 1 WHERE id = ?").run(id);
    return db.prepare("SELECT views FROM raspas WHERE id = ?").get(id).views;
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

router.get('/events/:eventId/raspas', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const list = db.prepare("SELECT * FROM raspas WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId);
        list.forEach(function(f) {
            if (f.config_json) try { f.config = JSON.parse(f.config_json); } catch (e) {}
            f.prizeCount = db.prepare("SELECT COUNT(*) as c FROM raspa_prizes WHERE raspa_id = ?").get(f.id).c;
            const plays = db.prepare("SELECT COUNT(*) as c FROM raspa_plays WHERE raspa_id = ?").get(f.id);
            f.stats = { plays: plays ? plays.c : 0, views: f.views || 0 };
        });
        res.json(list);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events/:eventId/raspas', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { name } = req.body || {};
        if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nombre requerido' });
        if (String(name).length > 200) return res.status(400).json({ error: 'Nombre demasiado largo' });
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO raspas (id, event_id, name, config_json, status, views, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', 0, ?, ?)").run(
            id, req.params.eventId, String(name).trim(), JSON.stringify(defaultConfig()), now, now
        );
        const insert = db.prepare("INSERT INTO raspa_prizes (id, raspa_id, type, label, value, quantity, chance, order_index, created_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)");
        defaultPrizes().forEach(function(p, i) {
            insert.run(uuidv4(), id, p.type, p.label, p.value || null, i, now);
        });
        try { logAction(req, 'RASPA_CREATE', { raspaId: id, name: String(name).trim() }); } catch (e) {}
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const f = getRaspa(req.params.id);
        if (!f) return res.status(404).json({ error: 'Raspa y Gana no encontrado' });
        if (f.config_json) try { f.config = JSON.parse(f.config_json); } catch (e) {}
        f.prizes = getPrizes(f.id).map(function(p, i) {
            return { id: p.id, type: p.type, label: p.label, value: p.value, quantity: p.quantity, chance: p.chance, orderIndex: i };
        });
        res.json(f);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const f = getRaspa(req.params.id);
        if (!f) return res.status(404).json({ error: 'Raspa y Gana no encontrado' });
        const { name, config, status, prizes } = req.body || {};
        if (name !== undefined && (!String(name).trim() || String(name).length > 200)) {
            return res.status(400).json({ error: 'Nombre inválido' });
        }
        if (status !== undefined && !['draft', 'published'].includes(status)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }
        db.prepare("UPDATE raspas SET name = COALESCE(?, name), config_json = COALESCE(?, config_json), status = COALESCE(?, status), updated_at = ? WHERE id = ?").run(
            name ? String(name).trim() : null,
            config ? JSON.stringify(config) : null,
            status || null,
            new Date().toISOString(), f.id
        );
        let err = null;
        if (Array.isArray(prizes)) {
            err = sanitizePrizes(prizes);
            if (!err) {
                const tx = db.transaction(function() {
                    db.prepare("DELETE FROM raspa_prizes WHERE raspa_id = ?").run(f.id);
                    const insert = db.prepare("INSERT INTO raspa_prizes (id, raspa_id, type, label, value, quantity, chance, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    prizes.forEach(function(p, i) {
                        insert.run(uuidv4(), f.id, p.type, String(p.label).trim(), p.value ? String(p.value).trim() : null,
                            p.quantity != null ? parseInt(p.quantity) : null,
                            p.chance != null ? parseFloat(p.chance) : null,
                            i, new Date().toISOString());
                    });
                });
                tx();
            }
        }
        if (err) return res.status(400).json({ error: err });
        try { logAction(req, 'RASPA_UPDATE', { raspaId: f.id, prizes: Array.isArray(prizes) ? prizes.length : undefined }); } catch (e) {}
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const f = getRaspa(req.params.id);
        if (!f) return res.status(404).json({ error: 'Raspa y Gana no encontrado' });
        const tx = db.transaction(function() {
            db.prepare("DELETE FROM raspa_plays WHERE raspa_id = ?").run(f.id);
            db.prepare("DELETE FROM raspa_prizes WHERE raspa_id = ?").run(f.id);
            db.prepare("DELETE FROM raspas WHERE id = ?").run(f.id);
        });
        tx();
        try { logAction(req, 'RASPA_DELETE', { raspaId: f.id }); } catch (e) {}
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Leads y CSV ──

router.get('/:id/leads', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const f = getRaspa(req.params.id);
        if (!f) return res.status(404).json({ error: 'Raspa y Gana no encontrado' });
        const plays = db.prepare("SELECT id, email, name, apellido, phone, prize_label, prize_type, prize_value, created_at FROM raspa_plays WHERE raspa_id = ? ORDER BY created_at DESC").all(f.id);
        res.json(plays);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/export-csv', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const f = getRaspa(req.params.id);
        if (!f) return res.status(404).json({ error: 'Raspa y Gana no encontrado' });
        const plays = db.prepare("SELECT email, name, apellido, phone, prize_label, prize_type, prize_value, created_at FROM raspa_plays WHERE raspa_id = ? ORDER BY created_at ASC").all(f.id);
        const esc = function(v) { const s = v == null ? '' : String(v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        let csv = '\uFEFFemail,nombre,apellido,telefono,premio,tipo,valor,fecha\n';
        plays.forEach(function(p) {
            csv += esc(p.email) + ',' + esc(p.name) + ',' + esc(p.apellido) + ',' + esc(p.phone) + ',' + esc(p.prize_label) + ',' + esc(p.prize_type) + ',' + esc(p.prize_value) + ',' + esc(p.created_at) + '\n';
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=raspa_leads.csv');
        res.send(csv);
    } catch (err) {
        logger.error('[RASPA] CSV error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── QR del enlace de juego (self-hosted, paridad ruleta) ──

router.get('/:id/qr', async (req, res) => {
    try {
        const f = getRaspa(req.params.id);
        if (!f) return res.status(404).json({ error: 'Raspa y Gana no encontrado' });
        const event = db.prepare("SELECT name FROM events WHERE id = ?").get(f.event_id);
        const slug = ((event && event.name) || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.headers['x-forwarded-host'] || req.get('host') || '';
        const url = proto + '://' + host + '/' + slug + '/raspa/' + f.id + '/jugar';
        const size = Math.min(Math.max(parseInt(req.query.size) || 300, 120), 800);
        const buf = await require('qrcode').toBuffer(url, { width: size, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' } });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(buf);
    } catch (err) {
        logger.error('[RASPA] QR error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Enlace compartido (política del dueño: publicadas editables sin clave, auditado) ──

router.get('/:id/public-editor', (req, res) => {
    try {
        const f = getRaspa(req.params.id);
        if (!f) return res.status(404).json({ error: 'Raspa y Gana no encontrado' });
        if (f.status !== 'published') return res.status(403).json({ error: 'Solo las promociones publicadas se abren desde el enlace' });
        const event = db.prepare("SELECT id, name FROM events WHERE id = ?").get(f.event_id);
        res.json({
            id: f.id, event_id: f.event_id, event_name: event ? event.name : 'Evento',
            name: f.name, status: f.status, config: parseJsonSafe(f.config_json, {}),
            prizes: getPrizes(f.id).map(function(p, i) {
                return { id: p.id, type: p.type, label: p.label, value: p.value, quantity: p.quantity, chance: p.chance, orderIndex: i };
            }),
            views: f.views || 0
        });
    } catch (err) {
        logger.error('[RASPA] Public editor error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id/public-config', (req, res) => {
    try {
        const f = getRaspa(req.params.id);
        if (!f) return res.status(404).json({ error: 'Raspa y Gana no encontrado' });
        if (f.status !== 'published') {
            return res.status(403).json({ error: 'Solo las promociones publicadas aceptan cambios desde el enlace' });
        }
        const { config, prizes } = req.body || {};
        if (config !== undefined) {
            if (typeof config !== 'object' || config === null || Array.isArray(config)) {
                return res.status(400).json({ error: 'config inválida' });
            }
            const json = JSON.stringify(config);
            if (json.length > 100000) return res.status(400).json({ error: 'Configuración demasiado grande' });
            db.prepare("UPDATE raspas SET config_json = ?, updated_at = ? WHERE id = ?").run(json, new Date().toISOString(), f.id);
        }
        if (prizes !== undefined) {
            const err = sanitizePrizes(prizes);
            if (err) return res.status(400).json({ error: err });
            const tx = db.transaction(function() {
                db.prepare("DELETE FROM raspa_prizes WHERE raspa_id = ?").run(f.id);
                const insert = db.prepare("INSERT INTO raspa_prizes (id, raspa_id, type, label, value, quantity, chance, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                prizes.forEach(function(p, i) {
                    insert.run(uuidv4(), f.id, p.type, String(p.label).trim(), p.value ? String(p.value).trim() : null,
                        p.quantity != null ? parseInt(p.quantity) : null,
                        p.chance != null ? parseFloat(p.chance) : null,
                        i, new Date().toISOString());
                });
            });
            tx();
        }
        try { logAction(req, 'RASPA_PUBLIC_SAVE', { raspaId: f.id, prizes: Array.isArray(prizes) ? prizes.length : undefined }); } catch (e) {}
        res.json({ success: true });
    } catch (err) {
        logger.error('[RASPA] Public save error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Público: datos de juego (etiquetas de premios, NUNCA los valores ocultos) ──

router.get('/:id/public', (req, res) => {
    try {
        const f = getRaspa(req.params.id);
        if (!f) return res.status(404).json({ error: 'Raspa y Gana no encontrado' });
        if (f.status !== 'published') return res.status(403).json({ error: 'Esta promoción no está activa' });
        const views = notifyViews(f.id);
        const config = parseJsonSafe(f.config_json, {});
        const prizes = getPrizes(f.id);
        res.json({
            id: f.id,
            name: f.name,
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
        logger.error('[RASPA] Public error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Público: registrar lead + raspar (una llamada atómica; el servidor elige el premio) ──

router.post('/:id/play', (req, res) => {
    try {
        const f = getRaspa(req.params.id);
        if (!f) return res.status(404).json({ error: 'Raspa y Gana no encontrado' });
        if (f.status !== 'published') return res.status(403).json({ error: 'Esta promoción no está activa' });
        const config = parseJsonSafe(f.config_json, {});
        const sec = config.security || {};
        const email = String((req.body && req.body.email) || '').trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Ingresa un email válido' });
        // whitelist (paridad AppSorteos "Emails permitidos")
        const whitelist = (sec.allowed_emails || []).map(function(e) { return String(e).trim().toLowerCase(); }).filter(Boolean);
        if (whitelist.length && whitelist.indexOf(email) === -1) return res.status(403).json({ error: 'Este email no está en la lista de permitidos' });
        // máx. participaciones por email
        const maxEmail = sec.max_per_email != null ? parseInt(sec.max_per_email) : 1;
        const yaEmail = db.prepare("SELECT COUNT(*) as c FROM raspa_plays WHERE raspa_id = ? AND lower(email) = ?").get(f.id, email).c;
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
                const yaDev = db.prepare("SELECT COUNT(*) as c FROM raspa_plays WHERE raspa_id = ? AND " + keyCol + " = ?").get(f.id, keyValue).c;
                if (yaDev >= dMax) return res.status(403).json({ error: 'Ya participaste desde este dispositivo' });
            }
        }
        const prizes = getPrizes(f.id);
        if (!prizes.length) return res.status(400).json({ error: 'El juego no tiene premios' });
        const picked = pickPrize(prizes, config);
        if (!picked) return res.status(400).json({ error: 'No quedan premios disponibles' });
        const prize = picked.prize;
        const playId = uuidv4();
        const now = new Date().toISOString();
        const tx = db.transaction(function() {
            db.prepare("INSERT INTO raspa_plays (id, raspa_id, email, name, apellido, phone, custom_json, prize_label, prize_type, prize_value, ip, device_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
                playId, f.id, email,
                String((req.body && req.body.name) || '').slice(0, 120) || null,
                String((req.body && req.body.apellido) || '').slice(0, 120) || null,
                String((req.body && req.body.phone) || '').slice(0, 40) || null,
                (req.body && req.body.consent) ? JSON.stringify({ consent: true }) : null,
                prize.label, prize.type,
                prize.type === 'cupon' || prize.type === 'enlace' ? (prize.value || null) : null,
                ip, deviceId || null, now
            );
            // limitar cantidades: descontar stock del premio ganado
            if (config.limit_quantities && prize.quantity != null) {
                db.prepare("UPDATE raspa_prizes SET quantity = quantity - 1 WHERE id = ? AND quantity > 0").run(prize.id);
            }
        });
        tx();
        // índice del premio ganador (posición entre TODOS los premios)
        const segmentIndex = prizes.findIndex(function(p) { return p.id === prize.id; });
        const win = prize.type !== 'sin_premio';
        res.json({
            success: true,
            playId: playId,
            segmentIndex: segmentIndex,
            prize: {
                label: prize.label,
                type: prize.type,
                win: win,
                value: (prize.type === 'cupon' || prize.type === 'enlace') ? (prize.value || null) : null
            }
        });
    } catch (err) {
        logger.error('[RASPA] Play error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Público: comprobante PDF de una jugada ──

router.get('/:id/certificate', (req, res) => {
    try {
        const f = getRaspa(req.params.id);
        if (!f) return res.status(404).json({ error: 'Raspa y Gana no encontrado' });
        const playId = String(req.query.play || '').trim();
        const play = db.prepare("SELECT * FROM raspa_plays WHERE raspa_id = ? AND id = ?").get(f.id, playId);
        if (!play) return res.status(404).json({ error: 'Jugada no encontrada' });
        const evento = db.prepare("SELECT name FROM events WHERE id = ?").get(f.event_id);
        const { jsPDF } = require('jspdf');
        const doc = new jsPDF();
        doc.setFontSize(20); doc.setTextColor(109, 40, 217);
        doc.text('Comprobante de Participacion', 14, 28);
        doc.setFontSize(12); doc.setTextColor(60);
        doc.text('Promocion: ' + f.name, 14, 40);
        doc.text('Evento: ' + (evento ? evento.name : 'N/A'), 14, 48);
        doc.setFontSize(11); doc.setTextColor(80);
        doc.text('Participante: ' + play.email, 14, 60);
        if (play.name) doc.text('Nombre: ' + play.name + (play.apellido ? ' ' + play.apellido : ''), 14, 68);
        doc.text('Resultado: ' + play.prize_label + ' (' + play.prize_type + ')', 14, play.name ? 76 : 68);
        const yCod = play.name ? 84 : 76;
        doc.setFontSize(13); doc.setTextColor(109, 40, 217);
        doc.text('Codigo: ' + play.id.slice(0, 8).toUpperCase(), 14, yCod);
        doc.setFontSize(9); doc.setTextColor(150);
        doc.text('Fecha: ' + (play.created_at || '').replace('T', ' ').slice(0, 19), 14, yCod + 10);
        doc.text('Powered by Check Pro', 14, 290);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=comprobante_' + play.id.slice(0, 8) + '.pdf');
        res.send(Buffer.from(doc.output('arraybuffer')));
    } catch (err) {
        logger.error('[RASPA] Certificate error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
