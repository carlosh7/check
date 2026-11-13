/**
 * Promociones — Trivia promocional (P3 — paridad AppSorteos — v12.44.834)
 *
 * Juego de preguntas con captura de leads: el visitante se registra (email),
 * responde las preguntas (opcionalmente contra reloj) y recibe una puntuación.
 * Si supera la nota de aprobación puede ganar un premio (p. ej. cupón).
 * El anfitrión obtiene los leads, las puntuaciones y estadísticas.
 *
 * ANTI-TRAMPA: la corrección es SIEMPRE en el servidor. El endpoint público
 * entrega las preguntas SIN correct_index; el cliente solo envía los índices
 * elegidos y /play calcula el score real. Para la retroalimentación en vivo
 * (marcar la correcta / sonidos de acierto-fallo) existe /verify, que confirma
 * UNA respuesta a la vez sin revelar el resto del cuestionario.
 *
 * Seguridad configurable (paridad AppSorteos): máx. participaciones por email,
 * whitelist de emails, límite por dispositivo/IP.
 *
 * Enlace compartido (política del dueño, igual que ruleta/raspa): las trivias
 * publicadas se EDITAN y controlan sin clave desde el enlace; auditado.
 *
 * @openapi
 * tags:
 *   - name: Trivias
 *     description: Trivia promocional (leads + puntuaciones + premio por aprobación)
 *
 * /api/trivias/events/{eventId}/trivias:
 *   get:  { summary: Listar trivias del evento, security: [{ BearerAuth: [] }] }
 *   post: { summary: Crear trivia con plantilla por defecto, security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }] }
 * /api/trivias/{id}:
 *   get:    { summary: Trivia completa con preguntas, security: [{ BearerAuth: [] }] }
 *   put:    { summary: Actualizar (reemplaza preguntas si se envían), security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }] }
 *   delete: { summary: Eliminar en cascada, security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }] }
 * /api/trivias/{id}/questions:
 *   get:  { summary: Listar preguntas, security: [{ BearerAuth: [] }] }
 *   post: { summary: Crear pregunta {question, answers[2-4], correct_index}, security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }] }
 * /api/trivias/{id}/questions/{qid}:   { summary: Eliminar pregunta, security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }] }
 * /api/trivias/{id}/questions/import:  { summary: Importar CSV (pregunta;r1;r2;r3;r4;índice), security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }] }
 * /api/trivias/{id}/leads:             { summary: Participantes con puntuación, security: [{ BearerAuth: [] }] }
 * /api/trivias/{id}/export-csv:        { summary: Leads en CSV con BOM, security: [{ BearerAuth: [] }] }
 * /api/trivias/{id}/qr:                { summary: QR del enlace de juego }
 * /api/trivias/{id}/public-editor:     { summary: Datos completos para el editor vía enlace (solo publicadas) }
 * /api/trivias/{id}/public-config:     { summary: Guardar desde el enlace (solo publicadas, auditado) }
 * /api/trivias/{id}/public:            { summary: Datos de juego público (preguntas SIN correct_index) }
 * /api/trivias/{id}/verify:            { summary: Verificar UNA respuesta en vivo (retroalimentación) }
 * /api/trivias/{id}/play:              { summary: Registrar lead + corregir + premiar }
 * /api/trivias/{id}/certificate:       { summary: Comprobante PDF de una jugada }
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

function getTrivia(id) {
    return db.prepare("SELECT * FROM trivias WHERE id = ?").get(id);
}

function getQuestions(triviaId) {
    return db.prepare("SELECT * FROM trivia_questions WHERE trivia_id = ? ORDER BY order_index ASC, created_at ASC").all(triviaId);
}

// plantilla por defecto (paridad AppSorteos)
function defaultConfig() {
    return {
        language: 'es',
        texts: {
            welcome_title: 'Bienvenido al Quiz',
            welcome_desc: '¡Resuelve las preguntas de este quiz y demuestra cuánto sabes!',
            start_button: 'Comenzar',
            final_title: 'Felicitaciones, ¡has terminado!',
            final_desc: 'Tu puntuación: [score]',
            certificate: 'Descargar comprobante'
        },
        quiz: {
            time_limit: 0, // 0 = sin límite; opciones 10/15/20/30/45/60/90/120
            feedback: 'selected', // 'none' | 'selected' | 'selected_correct'
            indicator: 'none', // 'none' | 'letters' | 'numbers'
            passing_grade: 0, // 0 = sin nota; opciones 30-100
            shuffle_questions: false,
            shuffle_answers: false,
            music: false,
            show_question_numbers: true
        },
        scoring: 'percentage', // 'none' | 'percentage' | 'fraction'
        final_button: 'retry', // 'none' | 'retry' | 'redirect'
        redirect_url: '',
        design: {
            bg_color: '#1e3a5f',
            text_color: '#ffffff',
            button_color: '#0ea5e9',
            accent_color: '#fbbf24'
        },
        form: { email: true, name: false, apellido: false, phone: false, consent_text: '' },
        security: { max_per_email: 1, allowed_emails: [], device_limit: 'off', device_max: 1 },
        share_buttons: true,
        certificate: false,
        prize_on_pass: null // ej. { type: 'cupon', label: '10% OFF', value: 'PASS10' }
    };
}

// validación de preguntas: [{question, answers[2-4], correct_index}] → error o null
function sanitizeQuestions(questions) {
    if (!Array.isArray(questions) || !questions.length) return 'Se necesita al menos 1 pregunta';
    if (questions.length > 200) return 'Máximo 200 preguntas';
    for (const q of questions) {
        if (!q.question || !String(q.question).trim()) return 'Toda pregunta necesita su texto';
        if (String(q.question).length > 300) return 'El texto de la pregunta no puede superar 300 caracteres';
        if (!Array.isArray(q.answers)) return 'Cada pregunta necesita sus respuestas';
        const answers = q.answers.map(function(a) { return String(a || '').trim(); }).filter(Boolean);
        if (answers.length < 2) return 'Cada pregunta necesita al menos 2 respuestas';
        if (answers.length > 4) return 'Máximo 4 respuestas por pregunta';
        if (answers.some(function(a) { return a.length > 120; })) return 'Las respuestas no pueden superar 120 caracteres';
        const ci = parseInt(q.correct_index);
        if (isNaN(ci) || ci < 0 || ci >= answers.length) return 'La respuesta correcta debe ser una de las opciones';
    }
    return null;
}

// parsea el índice correcto tolerando formatos comunes ("3", "D", "respuesta3", 1-based)
function parseCorrectIndex(raw, nAnswers) {
    if (raw == null) return -1;
    let s = String(raw).trim();
    if (!s) return -1;
    // letra A-D (según cantidad de respuestas)
    if (/^[A-Da-d]$/.test(s)) {
        const i = 'abcd'.indexOf(s.toLowerCase());
        return i >= 0 && i < nAnswers ? i : -1;
    }
    const n = parseInt(s, 10);
    if (isNaN(n)) return -1;
    // esperado 0-based (0..nAnswers-1); se tolera 1-based cuando el valor excede el rango
    if (n >= 0 && n < nAnswers) return n;
    if (n === nAnswers) return nAnswers - 1; // p. ej. "4" en un quiz de 4 respuestas → índice 3
    return -1;
}

// import CSV: líneas "pregunta;r1;r2;r3;r4;indice_correcto" (separador ; o ,)
function parseTriviaCsv(csv) {
    const out = [];
    let skipped = 0;
    const lines = String(csv || '').split(/\r?\n/);
    lines.forEach(function(line) {
        const raw = line.trim();
        if (!raw) return;
        const parts = (raw.indexOf(';') !== -1 ? raw.split(';') : raw.split(',')).map(function(p) { return p.trim(); });
        if (parts.length < 3) { skipped++; return; }
        const question = parts[0].replace(/^"|"$/g, '');
        if (!question || /^pregunta$/i.test(question)) { skipped++; return; } // vacía o fila de encabezado
        const rawIdx = parts[parts.length - 1].replace(/^"|"$/g, '');
        const answers = parts.slice(1, -1).map(function(a) { return a.replace(/^"|"$/g, ''); }).filter(Boolean).slice(0, 4);
        if (answers.length < 2) { skipped++; return; }
        const ci = parseCorrectIndex(rawIdx, answers.length);
        if (ci < 0) { skipped++; return; }
        out.push({ question: question, answers: answers, correct_index: ci });
    });
    return { questions: out, skipped: skipped };
}

function notifyViews(id) {
    db.prepare("UPDATE trivias SET views = views + 1 WHERE id = ?").run(id);
    return db.prepare("SELECT views FROM trivias WHERE id = ?").get(id).views;
}

// preguntas para el JUEGO público: SIN correct_index (anti-trampa)
function publicQuestions(rows) {
    return rows.map(function(q, i) {
        let answers = parseJsonSafe(q.answers_json, []);
        return { index: i, question: q.question, answers: answers };
    });
}

// preguntas completas para el editor (con correct_index)
function fullQuestions(rows) {
    return rows.map(function(q, i) {
        return { id: q.id, index: i, question: q.question, answers: parseJsonSafe(q.answers_json, []), correct_index: q.correct_index };
    });
}

// reemplazo transaccional de preguntas (PUT /:id y public-config)
function replaceQuestions(triviaId, questions) {
    const tx = db.transaction(function() {
        db.prepare("DELETE FROM trivia_questions WHERE trivia_id = ?").run(triviaId);
        const insert = db.prepare("INSERT INTO trivia_questions (id, trivia_id, question, answers_json, correct_index, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        const now = new Date().toISOString();
        questions.forEach(function(q, i) {
            const answers = q.answers.map(function(a) { return String(a || '').trim(); }).filter(Boolean);
            insert.run(uuidv4(), triviaId, String(q.question).trim(), JSON.stringify(answers), parseInt(q.correct_index), i, now);
        });
    });
    tx();
}

// ── CRUD (anfitrión, JWT) ──

router.get('/events/:eventId/trivias', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const list = db.prepare("SELECT * FROM trivias WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId);
        list.forEach(function(t) {
            if (t.config_json) try { t.config = JSON.parse(t.config_json); } catch (e) {}
            t.questionCount = db.prepare("SELECT COUNT(*) as c FROM trivia_questions WHERE trivia_id = ?").get(t.id).c;
            const plays = db.prepare("SELECT COUNT(*) as c FROM trivia_plays WHERE trivia_id = ?").get(t.id);
            t.stats = { plays: plays ? plays.c : 0, views: t.views || 0 };
        });
        res.json(list);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events/:eventId/trivias', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { name } = req.body || {};
        if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nombre requerido' });
        if (String(name).length > 200) return res.status(400).json({ error: 'Nombre demasiado largo' });
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO trivias (id, event_id, name, config_json, status, views, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', 0, ?, ?)").run(
            id, req.params.eventId, String(name).trim(), JSON.stringify(defaultConfig()), now, now
        );
        try { logAction(req, 'TRIVIA_CREATE', { triviaId: id, name: String(name).trim() }); } catch (e) {}
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        if (t.config_json) try { t.config = JSON.parse(t.config_json); } catch (e) {}
        t.questions = fullQuestions(getQuestions(t.id));
        res.json(t);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        const { name, config, status, questions } = req.body || {};
        if (name !== undefined && (!String(name).trim() || String(name).length > 200)) {
            return res.status(400).json({ error: 'Nombre inválido' });
        }
        if (status !== undefined && !['draft', 'published'].includes(status)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }
        let err = null;
        if (questions !== undefined) err = sanitizeQuestions(questions);
        if (err) return res.status(400).json({ error: err });
        db.prepare("UPDATE trivias SET name = COALESCE(?, name), config_json = COALESCE(?, config_json), status = COALESCE(?, status), updated_at = ? WHERE id = ?").run(
            name ? String(name).trim() : null,
            config ? JSON.stringify(config) : null,
            status || null,
            new Date().toISOString(), t.id
        );
        if (Array.isArray(questions)) replaceQuestions(t.id, questions);
        try { logAction(req, 'TRIVIA_UPDATE', { triviaId: t.id, questions: Array.isArray(questions) ? questions.length : undefined }); } catch (e) {}
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        const tx = db.transaction(function() {
            db.prepare("DELETE FROM trivia_plays WHERE trivia_id = ?").run(t.id);
            db.prepare("DELETE FROM trivia_questions WHERE trivia_id = ?").run(t.id);
            db.prepare("DELETE FROM trivias WHERE id = ?").run(t.id);
        });
        tx();
        try { logAction(req, 'TRIVIA_DELETE', { triviaId: t.id }); } catch (e) {}
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Gestión de preguntas ──

router.get('/:id/questions', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        res.json(fullQuestions(getQuestions(t.id)));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/questions', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        const { question, answers, correct_index } = req.body || {};
        const err = sanitizeQuestions([{ question: question, answers: answers, correct_index: correct_index }]);
        if (err) return res.status(400).json({ error: err });
        const clean = answers.map(function(a) { return String(a || '').trim(); }).filter(Boolean);
        const count = db.prepare("SELECT COUNT(*) as c FROM trivia_questions WHERE trivia_id = ?").get(t.id).c;
        if (count >= 200) return res.status(400).json({ error: 'Máximo 200 preguntas' });
        const id = uuidv4();
        db.prepare("INSERT INTO trivia_questions (id, trivia_id, question, answers_json, correct_index, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
            id, t.id, String(question).trim(), JSON.stringify(clean), parseInt(correct_index), count, new Date().toISOString()
        );
        db.prepare("UPDATE trivias SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), t.id);
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/questions/:qid', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        const r = db.prepare("DELETE FROM trivia_questions WHERE trivia_id = ? AND id = ?").run(t.id, req.params.qid);
        if (!r.changes) return res.status(404).json({ error: 'Pregunta no encontrada' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/questions/import', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        const csv = (req.body && req.body.csv) || '';
        const parsed = parseTriviaCsv(csv);
        if (!parsed.questions.length) return res.status(400).json({ error: 'No se pudo importar ninguna pregunta (formato: pregunta;r1;r2;r3;r4;índice)' });
        const count = db.prepare("SELECT COUNT(*) as c FROM trivia_questions WHERE trivia_id = ?").get(t.id).c;
        if (count + parsed.questions.length > 200) return res.status(400).json({ error: 'Máximo 200 preguntas' });
        const tx = db.transaction(function() {
            const insert = db.prepare("INSERT INTO trivia_questions (id, trivia_id, question, answers_json, correct_index, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
            const now = new Date().toISOString();
            parsed.questions.forEach(function(q, i) {
                insert.run(uuidv4(), t.id, q.question, JSON.stringify(q.answers), q.correct_index, count + i, now);
            });
        });
        tx();
        db.prepare("UPDATE trivias SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), t.id);
        try { logAction(req, 'TRIVIA_IMPORT', { triviaId: t.id, imported: parsed.questions.length }); } catch (e) {}
        res.json({ success: true, imported: parsed.questions.length, skipped: parsed.skipped });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Leads y CSV ──

router.get('/:id/leads', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        const plays = db.prepare("SELECT id, email, name, apellido, phone, score, total, passed, prize_label, prize_type, prize_value, created_at FROM trivia_plays WHERE trivia_id = ? ORDER BY created_at DESC").all(t.id);
        res.json(plays);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/export-csv', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        const plays = db.prepare("SELECT email, name, apellido, phone, score, total, passed, prize_label, prize_type, prize_value, created_at FROM trivia_plays WHERE trivia_id = ? ORDER BY created_at ASC").all(t.id);
        const esc = function(v) { const s = v == null ? '' : String(v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        let csv = '\uFEFFemail,nombre,apellido,telefono,puntuacion,total,aprobado,premio,tipo,valor,fecha\n';
        plays.forEach(function(p) {
            csv += esc(p.email) + ',' + esc(p.name) + ',' + esc(p.apellido) + ',' + esc(p.phone) + ',' + esc(p.score) + ',' + esc(p.total) + ',' + (p.passed ? 'si' : 'no') + ',' + esc(p.prize_label) + ',' + esc(p.prize_type) + ',' + esc(p.prize_value) + ',' + esc(p.created_at) + '\n';
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=trivia_leads.csv');
        res.send(csv);
    } catch (err) {
        logger.error('[TRIVIA] CSV error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── QR del enlace de juego (self-hosted, paridad ruleta/fortuna) ──

router.get('/:id/qr', async (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        const event = db.prepare("SELECT name FROM events WHERE id = ?").get(t.event_id);
        const slug = ((event && event.name) || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.headers['x-forwarded-host'] || req.get('host') || '';
        const url = proto + '://' + host + '/' + slug + '/trivia/' + t.id + '/jugar';
        const size = Math.min(Math.max(parseInt(req.query.size) || 300, 120), 800);
        const buf = await require('qrcode').toBuffer(url, { width: size, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' } });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(buf);
    } catch (err) {
        logger.error('[TRIVIA] QR error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Enlace compartido (política del dueño: publicadas editables sin clave, auditado) ──

router.get('/:id/public-editor', (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        if (t.status !== 'published') return res.status(403).json({ error: 'Solo las trivias publicadas se abren desde el enlace' });
        const event = db.prepare("SELECT id, name FROM events WHERE id = ?").get(t.event_id);
        res.json({
            id: t.id, event_id: t.event_id, event_name: event ? event.name : 'Evento',
            name: t.name, status: t.status, config: parseJsonSafe(t.config_json, {}),
            questions: fullQuestions(getQuestions(t.id)), // editor por enlace: preguntas COMPLETAS
            views: t.views || 0
        });
    } catch (err) {
        logger.error('[TRIVIA] Public editor error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id/public-config', (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        if (t.status !== 'published') {
            return res.status(403).json({ error: 'Solo las trivias publicadas aceptan cambios desde el enlace' });
        }
        const { config, questions } = req.body || {};
        if (config !== undefined) {
            if (typeof config !== 'object' || config === null || Array.isArray(config)) {
                return res.status(400).json({ error: 'config inválida' });
            }
            const json = JSON.stringify(config);
            if (json.length > 100000) return res.status(400).json({ error: 'Configuración demasiado grande' });
            db.prepare("UPDATE trivias SET config_json = ?, updated_at = ? WHERE id = ?").run(json, new Date().toISOString(), t.id);
        }
        if (questions !== undefined) {
            const err = sanitizeQuestions(questions);
            if (err) return res.status(400).json({ error: err });
            replaceQuestions(t.id, questions);
        }
        try { logAction(req, 'TRIVIA_PUBLIC_SAVE', { triviaId: t.id, questions: Array.isArray(questions) ? questions.length : undefined }); } catch (e) {}
        res.json({ success: true });
    } catch (err) {
        logger.error('[TRIVIA] Public save error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Público: datos de juego (preguntas SIN correct_index — anti-trampa) ──

router.get('/:id/public', (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        if (t.status !== 'published') return res.status(403).json({ error: 'Esta promoción no está activa' });
        const views = notifyViews(t.id);
        const config = parseJsonSafe(t.config_json, {});
        const rows = getQuestions(t.id);
        res.json({
            id: t.id,
            name: t.name,
            views: views,
            texts: config.texts || {},
            quiz: Object.assign({ time_limit: 0, feedback: 'selected', indicator: 'none', passing_grade: 0, shuffle_questions: false, shuffle_answers: false, music: false, show_question_numbers: true }, config.quiz || {}),
            scoring: config.scoring || 'percentage',
            final_button: config.final_button || 'retry',
            redirect_url: config.redirect_url || '',
            design: config.design || {},
            form: Object.assign({ email: true }, config.form || {}),
            security: { max_per_email: (config.security && config.security.max_per_email != null) ? config.security.max_per_email : 1 },
            share_buttons: config.share_buttons === true,
            certificate: config.certificate === true,
            prize_on_pass: (config.prize_on_pass && config.prize_on_pass.label) ? { label: config.prize_on_pass.label, type: config.prize_on_pass.type || 'premio' } : null,
            questions: publicQuestions(rows)
        });
    } catch (err) {
        logger.error('[TRIVIA] Public error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Público: verificar UNA respuesta en vivo (retroalimentación/sonidos sin exponer el cuestionario) ──
// Nota anti-trampa: confirma la respuesta elegida DESPUÉS de elegirla (y devuelve el índice
// correcto para el modo "Seleccionada + correcta"). El score real se calcula SIEMPRE en
// /play con las respuestas enviadas; el listado público nunca incluye correct_index.

router.post('/:id/verify', (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        if (t.status !== 'published') return res.status(403).json({ error: 'Esta promoción no está activa' });
        const rows = getQuestions(t.id);
        const qi = parseInt((req.body && req.body.qi));
        const answer = parseInt((req.body && req.body.answer));
        if (isNaN(qi) || qi < 0 || qi >= rows.length) return res.status(400).json({ error: 'Pregunta inválida' });
        const answers = parseJsonSafe(rows[qi].answers_json, []);
        if (isNaN(answer) || answer < 0 || answer >= answers.length) return res.json({ correct: false, answered: false, correct_index: rows[qi].correct_index });
        res.json({ correct: answer === rows[qi].correct_index, answered: true, correct_index: rows[qi].correct_index });
    } catch (err) {
        logger.error('[TRIVIA] Verify error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Público: registrar lead + corregir en el servidor + premiar ──

router.post('/:id/play', (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        if (t.status !== 'published') return res.status(403).json({ error: 'Esta promoción no está activa' });
        const config = parseJsonSafe(t.config_json, {});
        const sec = config.security || {};
        const email = String((req.body && req.body.email) || '').trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Ingresa un email válido' });
        // whitelist (paridad AppSorteos "Emails permitidos")
        const whitelist = (sec.allowed_emails || []).map(function(e) { return String(e).trim().toLowerCase(); }).filter(Boolean);
        if (whitelist.length && whitelist.indexOf(email) === -1) return res.status(403).json({ error: 'Este email no está en la lista de permitidos' });
        // máx. participaciones por email
        const maxEmail = sec.max_per_email != null ? parseInt(sec.max_per_email) : 1;
        const yaEmail = db.prepare("SELECT COUNT(*) as c FROM trivia_plays WHERE trivia_id = ? AND lower(email) = ?").get(t.id, email).c;
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
                const yaDev = db.prepare("SELECT COUNT(*) as c FROM trivia_plays WHERE trivia_id = ? AND " + keyCol + " = ?").get(t.id, keyValue).c;
                if (yaDev >= dMax) return res.status(403).json({ error: 'Ya participaste desde este dispositivo' });
            }
        }
        const rows = getQuestions(t.id);
        if (!rows.length) return res.status(400).json({ error: 'La trivia no tiene preguntas' });
        // corrección SIEMPRE en el servidor: answers = índices elegidos por pregunta en orden
        let given = (req.body && Array.isArray(req.body.answers)) ? req.body.answers : [];
        let score = 0;
        const total = rows.length;
        for (let i = 0; i < total; i++) {
            const answers = parseJsonSafe(rows[i].answers_json, []);
            const a = parseInt(given[i]);
            if (!isNaN(a) && a >= 0 && a < answers.length && a === rows[i].correct_index) score++;
        }
        const quizCfg = config.quiz || {};
        const grade = quizCfg.passing_grade != null ? parseInt(quizCfg.passing_grade) : 0;
        const passed = grade > 0 ? (score * 100 / total >= grade) : true;
        // premio solo si aprueba y hay premio configurado
        const pop = config.prize_on_pass;
        let prize = null;
        if (passed && pop && pop.label && String(pop.label).trim()) {
            const type = ['premio', 'cupon', 'enlace', 'sin_premio'].includes(pop.type) ? pop.type : 'premio';
            const value = (type === 'cupon' || type === 'enlace') ? String(pop.value || '').trim() || null : null;
            prize = { label: String(pop.label).trim(), type: type, value: value };
        }
        const playId = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO trivia_plays (id, trivia_id, email, name, apellido, phone, custom_json, score, total, passed, prize_label, prize_type, prize_value, ip, device_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
            playId, t.id, email,
            String((req.body && req.body.name) || '').slice(0, 120) || null,
            String((req.body && req.body.apellido) || '').slice(0, 120) || null,
            String((req.body && req.body.phone) || '').slice(0, 40) || null,
            null,
            score, total, passed ? 1 : 0,
            prize ? prize.label : null, prize ? prize.type : null, prize ? prize.value : null,
            ip, deviceId || null, now
        );
        res.json({
            success: true,
            playId: playId,
            score: score,
            total: total,
            passed: passed,
            prize: prize
        });
    } catch (err) {
        logger.error('[TRIVIA] Play error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Público: comprobante PDF de una jugada ──

router.get('/:id/certificate', (req, res) => {
    try {
        const t = getTrivia(req.params.id);
        if (!t) return res.status(404).json({ error: 'Trivia no encontrada' });
        const playId = String(req.query.play || '').trim();
        const play = db.prepare("SELECT * FROM trivia_plays WHERE trivia_id = ? AND id = ?").get(t.id, playId);
        if (!play) return res.status(404).json({ error: 'Jugada no encontrada' });
        const evento = db.prepare("SELECT name FROM events WHERE id = ?").get(t.event_id);
        const { jsPDF } = require('jspdf');
        const doc = new jsPDF();
        doc.setFontSize(20); doc.setTextColor(30, 58, 95);
        doc.text('Comprobante de Trivia', 14, 28);
        doc.setFontSize(12); doc.setTextColor(60);
        doc.text('Promocion: ' + t.name, 14, 40);
        doc.text('Evento: ' + (evento ? evento.name : 'N/A'), 14, 48);
        doc.setFontSize(11); doc.setTextColor(80);
        doc.text('Participante: ' + play.email, 14, 60);
        let y = 60;
        if (play.name) { y += 8; doc.text('Nombre: ' + play.name + (play.apellido ? ' ' + play.apellido : ''), 14, y); }
        y += 8;
        doc.text('Puntuacion: ' + play.score + '/' + play.total + ' (' + Math.round(play.score * 100 / Math.max(play.total, 1)) + '%)', 14, y);
        y += 8;
        doc.text('Resultado: ' + (play.passed ? 'APROBADO' : 'NO APROBADO'), 14, y);
        if (play.prize_label) { y += 8; doc.text('Premio: ' + play.prize_label + (play.prize_value ? ' (' + play.prize_value + ')' : ''), 14, y); }
        y += 12;
        doc.setFontSize(13); doc.setTextColor(30, 58, 95);
        doc.text('Codigo: ' + play.id.slice(0, 8).toUpperCase(), 14, y);
        doc.setFontSize(9); doc.setTextColor(150);
        doc.text('Fecha: ' + (play.created_at || '').replace('T', ' ').slice(0, 19), 14, y + 10);
        doc.text('Powered by Check Pro', 14, 290);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=comprobante_' + play.id.slice(0, 8) + '.pdf');
        res.send(Buffer.from(doc.output('arraybuffer')));
    } catch (err) {
        logger.error('[TRIVIA] Certificate error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
