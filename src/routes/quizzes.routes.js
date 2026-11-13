/**
 * Quiz en vivo (K1 — paridad Kahoot — v12.44.829)
 *
 * Rutas del anfitrión (JWT) y públicas del jugador (sin cuenta, solo PIN).
 * Sincronización en vivo: socket.io (room quiz:{sessionId}) + version incremental
 * para reserva por sondeo (polling) — el jugador consulta /public/session/:pin/state.
 *
 * Puntuación paridad Kahoot estándar:
 *   base = 1000 (standard) | 2000 (double) | 0 (none)
 *   correcto  → round(base * (0.5 + 0.5 * tiempoRestante/tiempoTotal))
 *   racha     → bonus min((racha-1)*100, 500) desde la 2ª correcta consecutiva
 *
 * @openapi
 * tags:
 *   - name: Quizzes
 *     description: Quiz en vivo estilo Kahoot (editor, sesiones y jugadores)
 *
 * /api/quizzes/events/{eventId}/quizzes:
 *   get:
 *     tags: [Quizzes]
 *     summary: Listar quizzes del evento
 *     security: [{ BearerAuth: [] }]
 *   post:
 *     tags: [Quizzes]
 *     summary: Crear quiz
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *
 * /api/quizzes/{id}:
 *   get:
 *     tags: [Quizzes]
 *     summary: Quiz completo (con preguntas)
 *     security: [{ BearerAuth: [] }]
 *   put:
 *     tags: [Quizzes]
 *     summary: Actualizar quiz (reemplaza preguntas si se envían)
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *   delete:
 *     tags: [Quizzes]
 *     summary: Eliminar quiz
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *
 * /api/quizzes/{id}/qr:
 *   get:
 *     tags: [Quizzes]
 *     summary: QR del enlace del jugador (pin opcional de la sesión activa)
 *
 * /api/quizzes/{id}/export-csv:
 *   get:
 *     tags: [Quizzes]
 *     summary: Resultados de todas las sesiones en CSV
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR','ORGANIZER'] }]
 *
 * /api/quizzes/{id}/sessions:
 *   post:
 *     tags: [Quizzes]
 *     summary: Abrir sesión de partida (genera PIN de 7 dígitos)
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR'] }]
 *
 * /api/quizzes/sessions/{sid}/host-state:
 *   get:
 *     tags: [Quizzes]
 *     summary: Estado completo del anfitrión (con respuestas correctas)
 *     security: [{ BearerAuth: [] }]
 * /api/quizzes/sessions/{sid}/show-question:
 *   post:
 *     tags: [Quizzes]
 *     summary: Mostrar pregunta N (abre respuestas)
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR','ORGANIZER'] }]
 * /api/quizzes/sessions/{sid}/reveal:
 *   post:
 *     tags: [Quizzes]
 *     summary: Revelar respuesta correcta
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR','ORGANIZER'] }]
 * /api/quizzes/sessions/{sid}/scoreboard:
 *   post:
 *     tags: [Quizzes]
 *     summary: Marcador entre preguntas
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR','ORGANIZER'] }]
 * /api/quizzes/sessions/{sid}/podio:
 *   post:
 *     tags: [Quizzes]
 *     summary: Podio final (cierra la partida)
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR','ORGANIZER'] }]
 * /api/quizzes/sessions/{sid}/lobby:
 *   post:
 *     tags: [Quizzes]
 *     summary: Volver a la sala de espera
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR','ORGANIZER'] }]
 * /api/quizzes/sessions/{sid}/players/{pid}:
 *   delete:
 *     tags: [Quizzes]
 *     summary: Expulsar jugador
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR','ORGANIZER'] }]
 * /api/quizzes/sessions/{sid}:
 *   delete:
 *     tags: [Quizzes]
 *     summary: Cancelar/eliminar sesión
 *     security: [{ BearerAuth: ['ADMIN','PRODUCTOR','ORGANIZER'] }]
 *
 * /api/quizzes/public/session/{pin}/join:
 *   post:
 *     tags: [Quizzes]
 *     summary: Unirse a la partida con PIN + apodo (público)
 * /api/quizzes/public/session/{pin}/state:
 *   get:
 *     tags: [Quizzes]
 *     summary: Estado público (oculta la respuesta correcta mientras la pregunta está abierta)
 * /api/quizzes/public/answer:
 *   post:
 *     tags: [Quizzes]
 *     summary: Enviar respuesta (público; puntúa por rapidez + racha)
 * /api/quizzes/public/session/{pin}/react:
 *   post:
 *     tags: [Quizzes]
 *     summary: Enviar reacción emoji (público)
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getEventConnection, eventDatabaseExists } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { logAction } = require('../security/audit');

const logger = require("../utils/logger");
const router = express.Router();

// ── helpers ──

function getEventGuestDb(eventId) {
    const event = db.prepare("SELECT has_own_db FROM events WHERE id = ?").get(eventId);
    if (event && event.has_own_db === 1 && eventDatabaseExists(eventId)) {
        const eventDb = getEventConnection(eventId);
        if (eventDb) return eventDb;
    }
    return db;
}

function parseJsonSafe(str, fallback) {
    try { return JSON.parse(str); } catch (e) { return fallback; }
}

// Notifica el cambio de estado a host y jugadores (socket.io) — la reserva es el
// polling por version: si el socket no llega (proxy sin websocket), todos refrescan igual.
function notifySession(sessionId, extra) {
    try {
        const io = require('../../socket').getIO();
        if (io) {
            const s = db.prepare("SELECT version, status, current_index FROM quiz_sessions WHERE id = ?").get(sessionId);
            io.to('quiz:' + sessionId).emit('quiz_state', Object.assign({
                sessionId: sessionId,
                version: s ? s.version : 0,
                status: s ? s.status : 'ended',
                currentIndex: s ? s.current_index : -1
            }, extra || {}));
        }
    } catch (e) { logger.warn('[QUIZ] notify fallo (no bloquea): ' + e.message); }
}

function bumpVersion(sessionId) {
    db.prepare("UPDATE quiz_sessions SET version = version + 1 WHERE id = ?").run(sessionId);
    return db.prepare("SELECT version FROM quiz_sessions WHERE id = ?").get(sessionId).version;
}

// PIN de 7 dígitos único entre sesiones vivas (últimas 24h no terminadas)
function generatePin() {
    for (let i = 0; i < 20; i++) {
        const pin = String(Math.floor(1000000 + Math.random() * 9000000));
        const clash = db.prepare("SELECT id FROM quiz_sessions WHERE pin = ? AND (status != 'ended' OR created_at > ?)").get(
            pin, new Date(Date.now() - 24 * 3600 * 1000).toISOString()
        );
        if (!clash) return pin;
    }
    return String(Date.now()).slice(-7); // reserva casi imposible de alcanzar
}

function getSession(sid) {
    return db.prepare("SELECT * FROM quiz_sessions WHERE id = ?").get(sid);
}

function getQuestions(quizId) {
    return db.prepare("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC").all(quizId);
}

// Puntaje paridad Kahoot: base por rapidez + bonus de racha
function computeScore(pointsMode, msTaken, timeLimitSec, previousStreak, isCorrect) {
    if (!isCorrect) return { points: 0, bonus: 0, streak: 0 };
    const base = pointsMode === 'double' ? 2000 : pointsMode === 'none' ? 0 : 1000;
    if (base === 0) return { points: 0, bonus: 0, streak: previousStreak + 1 };
    const total = Math.max((timeLimitSec || 20) * 1000, 1);
    const left = Math.max(total - msTaken, 0);
    const points = Math.round(base * (0.5 + 0.5 * (left / total)));
    const streak = previousStreak + 1;
    const bonus = Math.min((streak - 1) * 100, 500);
    return { points: points, bonus: bonus, streak: streak };
}

function scoreboardTop(sessionId, limit) {
    return db.prepare("SELECT id, nickname, points, streak, correct_count FROM quiz_players WHERE session_id = ? ORDER BY points DESC, correct_count DESC, joined_at ASC LIMIT ?")
        .all(sessionId, limit || 10)
        .map(function(p, i) { return { rank: i + 1, playerId: p.id, nickname: p.nickname, points: p.points, streak: p.streak, correctCount: p.correct_count }; });
}

function answerCounts(sessionId, questionId, totalAnswers) {
    const rows = db.prepare("SELECT answer_index, COUNT(*) as c FROM quiz_responses WHERE session_id = ? AND question_id = ? GROUP BY answer_index").all(sessionId, questionId);
    const counts = new Array(totalAnswers).fill(0);
    rows.forEach(function(r) {
        if (r.answer_index != null && r.answer_index >= 0 && r.answer_index < counts.length) counts[r.answer_index] = r.c;
    });
    return counts;
}

function sanitizeQuestionInput(type, title, answers, timeLimit, pointsMode) {
    if (type !== 'quiz' && type !== 'true_false') return 'Tipo de pregunta inválido (quiz o true_false)';
    if (!title || !String(title).trim()) return 'El texto de la pregunta es requerido';
    if (String(title).length > 500) return 'La pregunta no puede superar 500 caracteres';
    if (!Array.isArray(answers) || answers.length < 2) return 'La pregunta necesita al menos 2 respuestas';
    const maxAnswers = type === 'true_false' ? 2 : 4;
    if (answers.length > maxAnswers) return 'Máximo ' + maxAnswers + ' respuestas';
    let correctCount = 0;
    for (const a of answers) {
        if (!a || !String(a.text || '').trim()) return 'Toda respuesta necesita texto';
        if (String(a.text).length > 150) return 'Las respuestas no pueden superar 150 caracteres';
        if (a.correct) correctCount++;
    }
    if (correctCount < 1) return 'Marca al menos una respuesta correcta';
    const tl = parseInt(timeLimit) || 20;
    if (tl < 5 || tl > 120) return 'El límite de tiempo debe estar entre 5 y 120 segundos';
    if (!['standard', 'double', 'none'].includes(pointsMode)) return 'Modo de puntos inválido';
    return null;
}

// ── CRUD del quiz (anfitrión) ──

router.get('/events/:eventId/quizzes', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const quizzes = db.prepare("SELECT * FROM quizzes WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId);
        quizzes.forEach(function(q) {
            if (q.config_json) try { q.config = JSON.parse(q.config_json); } catch (e) {}
            q.questionCount = db.prepare("SELECT COUNT(*) as c FROM quiz_questions WHERE quiz_id = ?").get(q.id).c;
            const sess = db.prepare("SELECT COUNT(*) as c FROM quiz_sessions WHERE quiz_id = ?").get(q.id);
            const players = db.prepare("SELECT COUNT(*) as c FROM quiz_players qp JOIN quiz_sessions qs ON qs.id = qp.session_id WHERE qs.quiz_id = ?").get(q.id);
            q.stats = { sessions: sess ? sess.c : 0, players: players ? players.c : 0 };
        });
        res.json(quizzes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events/:eventId/quizzes', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { name, description, config } = req.body || {};
        if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nombre requerido' });
        if (String(name).length > 200) return res.status(400).json({ error: 'Nombre demasiado largo' });
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO quizzes (id, event_id, name, description, config_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)").run(
            id, req.params.eventId, String(name).trim(), description || null,
            config ? JSON.stringify(config) : null, now, now
        );
        try { logAction(req, 'QUIZ_CREATE', { quizId: id, name: String(name).trim() }); } catch (e) {}
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const quiz = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });
        if (quiz.config_json) try { quiz.config = JSON.parse(quiz.config_json); } catch (e) {}
        const questions = getQuestions(quiz.id).map(function(q, idx) {
            return {
                id: q.id, type: q.type, title: q.title, mediaUrl: q.media_url,
                timeLimit: q.time_limit, pointsMode: q.points_mode,
                answers: parseJsonSafe(q.answers_json, []),
                orderIndex: idx
            };
        });
        quiz.questions = questions;
        res.json(quiz);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const quiz = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });
        const { name, description, config, status, questions } = req.body || {};
        if (name !== undefined && (!String(name).trim() || String(name).length > 200)) {
            return res.status(400).json({ error: 'Nombre inválido' });
        }
        if (status !== undefined && !['draft', 'published'].includes(status)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }
        db.prepare("UPDATE quizzes SET name = COALESCE(?, name), description = COALESCE(?, description), config_json = COALESCE(?, config_json), status = COALESCE(?, status), updated_at = ? WHERE id = ?").run(
            name ? String(name).trim() : null,
            description !== undefined ? (description || null) : null,
            config ? JSON.stringify(config) : null,
            status || null,
            new Date().toISOString(), quiz.id
        );
        // Reemplazo atómico de preguntas si se envían (el editor siempre manda el bloque completo)
        if (Array.isArray(questions)) {
            if (questions.length > 100) return res.status(400).json({ error: 'Máximo 100 preguntas' });
            const tx = db.transaction(function() {
                db.prepare("DELETE FROM quiz_questions WHERE quiz_id = ?").run(quiz.id);
                const insert = db.prepare("INSERT INTO quiz_questions (id, quiz_id, type, title, media_url, time_limit, points_mode, answers_json, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                questions.forEach(function(q, idx) {
                    const type = q.type === 'true_false' ? 'true_false' : 'quiz';
                    const answers = Array.isArray(q.answers) ? q.answers : [];
                    const pointsMode = q.pointsMode || 'standard';
                    const err = sanitizeQuestionInput(type, q.title, answers, q.timeLimit, pointsMode);
                    if (err) throw new Error('Pregunta ' + (idx + 1) + ': ' + err);
                    const cleanAnswers = answers.map(function(a) { return { text: String(a.text).trim(), correct: a.correct ? true : false }; });
                    insert.run(uuidv4(), quiz.id, type, String(q.title).trim(), q.mediaUrl || null,
                        parseInt(q.timeLimit) || 20, pointsMode, JSON.stringify(cleanAnswers), idx, new Date().toISOString());
                });
            });
            try {
                tx();
            } catch (e) {
                return res.status(400).json({ error: e.message });
            }
        }
        try { logAction(req, 'QUIZ_UPDATE', { quizId: quiz.id, name: name || quiz.name, questions: Array.isArray(questions) ? questions.length : undefined }); } catch (e) {}
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const quiz = db.prepare("SELECT id FROM quizzes WHERE id = ?").get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });
        const tx = db.transaction(function() {
            db.prepare("DELETE FROM quiz_reactions WHERE session_id IN (SELECT id FROM quiz_sessions WHERE quiz_id = ?)").run(quiz.id);
            db.prepare("DELETE FROM quiz_responses WHERE session_id IN (SELECT id FROM quiz_sessions WHERE quiz_id = ?)").run(quiz.id);
            db.prepare("DELETE FROM quiz_players WHERE session_id IN (SELECT id FROM quiz_sessions WHERE quiz_id = ?)").run(quiz.id);
            db.prepare("DELETE FROM quiz_sessions WHERE quiz_id = ?").run(quiz.id);
            db.prepare("DELETE FROM quiz_questions WHERE quiz_id = ?").run(quiz.id);
            db.prepare("DELETE FROM quizzes WHERE id = ?").run(quiz.id);
        });
        tx();
        try { logAction(req, 'QUIZ_DELETE', { quizId: quiz.id }); } catch (e) {}
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Enlace compartido (política del dueño, paridad ruleta v12.44.821) ──
// El link del quiz publicado permite EDITAR la configuración y CONTROLAR la partida
// sin clave (p. ej. el master proyecta y controla desde otro equipo). La configuración
// por JWT sigue funcionando igual para el SPA; el UUID de sesión actúa de llave de
// control (no adivinable) y toda acción queda auditada con IP.

// Datos completos del quiz publicado (editor y pantalla del anfitrión sin login)
router.get('/:id/public', (req, res) => {
    try {
        const quiz = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });
        if (quiz.status !== 'published') return res.status(403).json({ error: 'Solo los quizzes publicados se abren desde el enlace' });
        const event = db.prepare("SELECT id, name FROM events WHERE id = ?").get(quiz.event_id);
        const questions = getQuestions(quiz.id).map(function(q, idx) {
            return {
                id: q.id, type: q.type, title: q.title, mediaUrl: q.media_url,
                timeLimit: q.time_limit, pointsMode: q.points_mode,
                answers: parseJsonSafe(q.answers_json, []), orderIndex: idx
            };
        });
        res.json({
            id: quiz.id, event_id: quiz.event_id,
            event_name: event ? event.name : 'Evento',
            name: quiz.name, description: quiz.description,
            config: parseJsonSafe(quiz.config_json, {}),
            questions: questions
        });
    } catch (err) {
        logger.error('[QUIZ] Public error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Guardado desde el enlace: config + preguntas (SOLO quizzes publicados, con límites)
router.put('/:id/public-config', (req, res) => {
    try {
        const quiz = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });
        if (quiz.status !== 'published') {
            return res.status(403).json({ error: 'Solo los quizzes publicados aceptan cambios desde el enlace' });
        }
        const { config, questions, name, description } = req.body || {};
        if (config !== undefined) {
            if (typeof config !== 'object' || config === null || Array.isArray(config)) {
                return res.status(400).json({ error: 'config inválida' });
            }
            const json = JSON.stringify(config);
            if (json.length > 100000) return res.status(400).json({ error: 'Configuración demasiado grande' });
            db.prepare("UPDATE quizzes SET config_json = ?, updated_at = ? WHERE id = ?").run(json, new Date().toISOString(), quiz.id);
        }
        if (name !== undefined || description !== undefined) {
            if (name !== undefined) {
                const nm = String(name).trim();
                if (!nm || nm.length > 200) return res.status(400).json({ error: 'Nombre inválido' });
                db.prepare("UPDATE quizzes SET name = ?, updated_at = ? WHERE id = ?").run(nm, new Date().toISOString(), quiz.id);
            }
            if (description !== undefined) {
                db.prepare("UPDATE quizzes SET description = ?, updated_at = ? WHERE id = ?").run(String(description || '').slice(0, 300) || null, new Date().toISOString(), quiz.id);
            }
        }
        if (questions !== undefined) {
            if (!Array.isArray(questions)) return res.status(400).json({ error: 'questions debe ser un array' });
            if (questions.length > 100) return res.status(400).json({ error: 'Máximo 100 preguntas' });
            const tx = db.transaction(function() {
                db.prepare("DELETE FROM quiz_questions WHERE quiz_id = ?").run(quiz.id);
                const insert = db.prepare("INSERT INTO quiz_questions (id, quiz_id, type, title, media_url, time_limit, points_mode, answers_json, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                questions.forEach(function(q, idx) {
                    const type = q.type === 'true_false' ? 'true_false' : 'quiz';
                    const answers = Array.isArray(q.answers) ? q.answers : [];
                    const pointsMode = q.pointsMode || 'standard';
                    const err = sanitizeQuestionInput(type, q.title, answers, q.timeLimit, pointsMode);
                    if (err) throw new Error('Pregunta ' + (idx + 1) + ': ' + err);
                    const cleanAnswers = answers.map(function(a) { return { text: String(a.text).trim(), correct: a.correct ? true : false }; });
                    insert.run(uuidv4(), quiz.id, type, String(q.title).trim(), q.mediaUrl || null,
                        parseInt(q.timeLimit) || 20, pointsMode, JSON.stringify(cleanAnswers), idx, new Date().toISOString());
                });
            });
            try { tx(); } catch (e) { return res.status(400).json({ error: e.message }); }
        }
        try { logAction(req, 'QUIZ_PUBLIC_SAVE', { quizId: quiz.id, name: quiz.name, questions: Array.isArray(questions) ? questions.length : undefined }); } catch (e) {}
        res.json({ success: true });
    } catch (err) {
        logger.error('[QUIZ] Public save error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Abrir sesión desde el enlace (publicada; el UUID de la sesión es la llave de control)
router.post('/:id/public-session', (req, res) => {
    try {
        const quiz = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });
        if (quiz.status !== 'published') return res.status(403).json({ error: 'Publica el quiz para abrir partidas desde el enlace' });
        if (getQuestions(quiz.id).length === 0) return res.status(400).json({ error: 'El quiz no tiene preguntas' });
        const id = uuidv4();
        const pin = generatePin();
        db.prepare("INSERT INTO quiz_sessions (id, quiz_id, event_id, pin, status, current_index, version, config_json, created_at) VALUES (?, ?, ?, ?, 'lobby', -1, 1, NULL, ?)").run(
            id, quiz.id, quiz.event_id, pin, new Date().toISOString()
        );
        try { logAction(req, 'QUIZ_SESSION_OPEN_PUBLIC', { quizId: quiz.id, sessionId: id, pin: pin }); } catch (e) {}
        res.json({ success: true, id: id, pin: pin });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── QR del enlace del jugador (self-hosted con qrcode npm, paridad ruleta) ──

router.get('/:id/qr', async (req, res) => {
    try {
        const quiz = db.prepare("SELECT id, event_id FROM quizzes WHERE id = ?").get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });
        const event = db.prepare("SELECT name FROM events WHERE id = ?").get(quiz.event_id);
        const slug = ((event && event.name) || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.headers['x-forwarded-host'] || req.get('host') || '';
        let url = proto + '://' + host + '/' + slug + '/quiz/' + quiz.id + '/play';
        if (req.query.pin) url += '?pin=' + encodeURIComponent(String(req.query.pin));
        const size = Math.min(Math.max(parseInt(req.query.size) || 300, 120), 800);
        const buf = await require('qrcode').toBuffer(url, { width: size, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' } });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(buf);
    } catch (err) {
        logger.error('[QUIZ] QR error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Resultados CSV (todas las sesiones del quiz) ──

router.get('/:id/export-csv', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const quiz = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });
        const sessions = db.prepare("SELECT * FROM quiz_sessions WHERE quiz_id = ? ORDER BY created_at DESC").all(quiz.id);
        const questions = getQuestions(quiz.id);
        const qTitle = {};
        questions.forEach(function(q, i) { qTitle[q.id] = (i + 1) + '. ' + q.title; });
        const esc = function(v) { const s = v == null ? '' : String(v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        let csv = '\uFEFFsesion_pin,jugador,apodo,pregunta,respuesta_elegida,correcta,puntos,ms,fecha\n';
        let totalPlayers = 0;
        sessions.forEach(function(s) {
            const players = db.prepare("SELECT * FROM quiz_players WHERE session_id = ? ORDER BY points DESC").all(s.id);
            totalPlayers += players.length;
            const responses = db.prepare("SELECT * FROM quiz_responses WHERE session_id = ? ORDER BY created_at ASC").all(s.id);
            responses.forEach(function(r) {
                const p = players.find(function(x) { return x.id === r.player_id; });
                const qIdx = questions.findIndex(function(q) { return q.id === r.question_id; });
                const answers = qIdx >= 0 ? parseJsonSafe(questions[qIdx].answers_json, []) : [];
                csv += esc(s.pin) + ',' + esc(p ? p.nickname : '?') + ',' +
                    esc(qIdx >= 0 ? qTitle[questions[qIdx].id] : '?') + ',' +
                    esc(r.answer_index != null && answers[r.answer_index] ? answers[r.answer_index].text : '-') + ',' +
                    (r.is_correct ? 'si' : 'no') + ',' + r.points + ',' + (r.ms_taken || 0) + ',' + esc(r.created_at) + '\n';
            });
            players.forEach(function(p, i) {
                csv += esc(s.pin) + ',RESUMEN,' + esc(p.nickname) + ',posicion ' + (i + 1) + ',-,' + (p.correct_count > 0 ? 'si' : '-') + ',' + p.points + ',-,' + esc(s.created_at) + '\n';
            });
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=quiz_resultados.csv');
        res.send(csv);
    } catch (err) {
        logger.error('[QUIZ] CSV error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Historial de sesiones (resultados) ──

router.get('/:id/results', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const quiz = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });
        const sessions = db.prepare("SELECT * FROM quiz_sessions WHERE quiz_id = ? ORDER BY created_at DESC LIMIT 50").all(quiz.id);
        const result = sessions.map(function(s) {
            const players = scoreboardTop(s.id, 100);
            const answers = db.prepare("SELECT COUNT(*) as c FROM quiz_responses WHERE session_id = ?").get(s.id);
            return { id: s.id, pin: s.pin, status: s.status, createdAt: s.created_at, endedAt: s.ended_at, playersCount: players.length, answersCount: answers ? answers.c : 0, top: players.slice(0, 5) };
        });
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Sesiones de partida (anfitrión) ──

router.post('/:id/sessions', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const quiz = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(req.params.id);
        if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado' });
        const questions = getQuestions(quiz.id);
        if (questions.length === 0) return res.status(400).json({ error: 'El quiz no tiene preguntas. Agrega al menos una.' });
        const id = uuidv4();
        const pin = generatePin();
        db.prepare("INSERT INTO quiz_sessions (id, quiz_id, event_id, pin, status, current_index, version, config_json, created_at) VALUES (?, ?, ?, ?, 'lobby', -1, 1, ?, ?)").run(
            id, quiz.id, quiz.event_id, pin,
            req.body && req.body.config ? JSON.stringify(req.body.config) : null,
            new Date().toISOString()
        );
        try { logAction(req, 'QUIZ_SESSION_OPEN', { quizId: quiz.id, sessionId: id, pin: pin }); } catch (e) {}
        res.json({ success: true, id: id, pin: pin });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Estado completo del anfitrión (incluye respuestas correctas y conteos en vivo)
router.get('/sessions/:sid/host-state', (req, res) => {
    try {
        const s = getSession(req.params.sid);
        if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
        const quiz = db.prepare("SELECT id, name, config_json FROM quizzes WHERE id = ?").get(s.quiz_id);
        const questions = getQuestions(s.quiz_id);
        const total = questions.length;
        const players = db.prepare("SELECT id, nickname, points, streak, correct_count, guest_id FROM quiz_players WHERE session_id = ? ORDER BY points DESC, joined_at ASC").all(s.id);
        const out = {
            sessionId: s.id, pin: s.pin, version: s.version, status: s.status,
            currentIndex: s.current_index, totalQuestions: total,
            questionStartedAt: s.question_started_at,
            quiz: { id: quiz.id, name: quiz.name, config: parseJsonSafe(quiz.config_json, {}) },
            playersCount: players.length,
            players: players.map(function(p, i) { return { id: p.id, nickname: p.nickname, points: p.points, streak: p.streak, correctCount: p.correct_count, rank: i + 1 }; })
        };
        if (s.current_index >= 0 && s.current_index < total) {
            const q = questions[s.current_index];
            const answers = parseJsonSafe(q.answers_json, []);
            out.question = {
                id: q.id, type: q.type, title: q.title, mediaUrl: q.media_url,
                timeLimit: q.time_limit, pointsMode: q.points_mode,
                answers: answers.map(function(a, i) { return { index: i, text: a.text, correct: a.correct ? true : false }; })
            };
            out.answerCounts = answerCounts(s.id, q.id, answers.length);
            out.answeredCount = out.answerCounts.reduce(function(a, b) { return a + b; }, 0);
        }
        if (s.status === 'scoreboard' || s.status === 'ended') out.top = scoreboardTop(s.id, 10);
        // el más rápido en acertar la pregunta actual (para el revelado, paridad Kahoot)
        if ((s.status === 'reveal' || s.status === 'scoreboard') && s.current_index >= 0) {
            const qNow = db.prepare("SELECT id FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC LIMIT 1 OFFSET ?").get(s.quiz_id, s.current_index);
            if (qNow) {
                const fastest = db.prepare("SELECT p.nickname, r.ms_taken FROM quiz_responses r JOIN quiz_players p ON p.id = r.player_id WHERE r.session_id = ? AND r.question_id = ? AND r.is_correct = 1 ORDER BY r.ms_taken ASC LIMIT 1").get(s.id, qNow.id);
                if (fastest) out.fastest = { nickname: fastest.nickname, ms: fastest.ms_taken };
                const correctCount = db.prepare("SELECT COUNT(*) as c FROM quiz_responses WHERE session_id = ? AND question_id = ? AND is_correct = 1").get(s.id, qNow.id);
                out.correctCount = correctCount ? correctCount.c : 0;
            }
        }
        const cutoff = new Date(Date.now() - 30000).toISOString();
        out.reactions = db.prepare("SELECT nickname, emoji, created_at FROM quiz_reactions WHERE session_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 20").all(s.id, cutoff);
        res.json(out);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mostrar pregunta N (abre el window de respuestas)
router.post('/sessions/:sid/show-question', (req, res) => {
    try {
        const s = getSession(req.params.sid);
        if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
        if (s.status === 'ended') return res.status(400).json({ error: 'La partida ya terminó' });
        const idx = parseInt(req.body && req.body.index);
        const total = db.prepare("SELECT COUNT(*) as c FROM quiz_questions WHERE quiz_id = ?").get(s.quiz_id).c;
        if (isNaN(idx) || idx < 0 || idx >= total) return res.status(400).json({ error: 'Índice de pregunta inválido' });
        // limpiar reacciones viejas al abrir pregunta nueva
        db.prepare("DELETE FROM quiz_reactions WHERE session_id = ?").run(s.id);
        db.prepare("UPDATE quiz_sessions SET status = 'question', current_index = ?, question_started_at = ?, version = version + 1 WHERE id = ?").run(
            idx, new Date().toISOString(), s.id
        );
        notifySession(s.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sessions/:sid/reveal', (req, res) => {
    try {
        const s = getSession(req.params.sid);
        if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
        if (s.status !== 'question') return res.status(400).json({ error: 'Solo se revela durante una pregunta abierta' });
        db.prepare("UPDATE quiz_sessions SET status = 'reveal', version = version + 1 WHERE id = ?").run(s.id);
        notifySession(s.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sessions/:sid/scoreboard', (req, res) => {
    try {
        const s = getSession(req.params.sid);
        if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
        db.prepare("UPDATE quiz_sessions SET status = 'scoreboard', version = version + 1 WHERE id = ?").run(s.id);
        notifySession(s.id);
        res.json({ success: true, top: scoreboardTop(s.id, 10) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sessions/:sid/lobby', (req, res) => {
    try {
        const s = getSession(req.params.sid);
        if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
        db.prepare("UPDATE quiz_sessions SET status = 'lobby', current_index = -1, question_started_at = NULL, version = version + 1 WHERE id = ?").run(s.id);
        notifySession(s.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sessions/:sid/podio', (req, res) => {
    try {
        const s = getSession(req.params.sid);
        if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
        db.prepare("UPDATE quiz_sessions SET status = 'ended', ended_at = ?, version = version + 1 WHERE id = ?").run(new Date().toISOString(), s.id);
        notifySession(s.id, { podio: true });
        try { logAction(req, 'QUIZ_SESSION_END', { quizId: s.quiz_id, sessionId: s.id }); } catch (e) {}
        res.json({ success: true, top: scoreboardTop(s.id, 3) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/sessions/:sid', (req, res) => {
    try {
        const s = getSession(req.params.sid);
        if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
        db.prepare("DELETE FROM quiz_reactions WHERE session_id = ?").run(s.id);
        db.prepare("DELETE FROM quiz_responses WHERE session_id = ?").run(s.id);
        db.prepare("DELETE FROM quiz_players WHERE session_id = ?").run(s.id);
        db.prepare("DELETE FROM quiz_sessions WHERE id = ?").run(s.id);
        notifySession(s.id, { podio: false, closed: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/sessions/:sid/players/:pid', (req, res) => {
    try {
        const s = getSession(req.params.sid);
        if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
        db.prepare("DELETE FROM quiz_players WHERE id = ? AND session_id = ?").run(req.params.pid, s.id);
        db.prepare("DELETE FROM quiz_responses WHERE player_id = ? AND session_id = ?").run(req.params.pid, s.id);
        notifySession(s.id, { kicked: req.params.pid });
        try { const io = require('../../socket').getIO(); if (io) io.to('quiz:' + s.id).emit('quiz_kicked', { playerId: req.params.pid }); } catch (e) {}
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Público: unirse con PIN ──

router.post('/public/session/:pin/join', (req, res) => {
    try {
        const s = db.prepare("SELECT * FROM quiz_sessions WHERE pin = ? AND status != 'ended'").get(String(req.params.pin).trim());
        if (!s) return res.status(404).json({ error: 'PIN no encontrado o partida terminada' });
        let nickname = String((req.body && req.body.nickname) || '').trim();
        if (!nickname) return res.status(400).json({ error: 'Escribe un apodo' });
        nickname = nickname.slice(0, 16);
        if (/^(admin|checkpro|check pro|sistema)$/i.test(nickname)) return res.status(400).json({ error: 'Ese apodo no está permitido' });
        // Apodo único en la sesión (Kahoot añade sufijo)
        let finalNick = nickname;
        let n = 2;
        while (db.prepare("SELECT id FROM quiz_players WHERE session_id = ? AND nickname = ?").get(s.id, finalNick)) {
            finalNick = (nickname + n).slice(0, 16);
            n++;
            if (n > 50) return res.status(400).json({ error: 'Demasiados jugadores con ese apodo' });
        }
        // Vinculación opcional con invitado del evento (por token QR del invitado)
        let guestId = null;
        const guestToken = req.body && req.body.guestToken;
        if (guestToken) {
            try {
                const eventDb = getEventGuestDb(s.event_id);
                const g = eventDb.prepare("SELECT id FROM guests WHERE qr_token = ? AND event_id = ?").get(String(guestToken), s.event_id);
                if (g) guestId = g.id;
            } catch (e) { /* sin vínculo si falla la BD del evento */ }
        }
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO quiz_players (id, session_id, nickname, guest_id, points, streak, correct_count, joined_at, last_seen_at) VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?)").run(
            id, s.id, finalNick, guestId, now, now
        );
        notifySession(s.id, { joined: finalNick });
        try { const io = require('../../socket').getIO(); if (io) io.to('quiz:' + s.id).emit('quiz_player_joined', { nickname: finalNick }); } catch (e) {}
        res.json({ success: true, playerId: id, nickname: finalNick, sessionId: s.id, quizId: s.quiz_id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Público: estado (oculta correctas mientras la pregunta está abierta) ──

router.get('/public/session/:pin/state', (req, res) => {
    try {
        const pin = String(req.params.pin).trim();
        let s = db.prepare("SELECT * FROM quiz_sessions WHERE pin = ? ORDER BY created_at DESC").get(pin);
        if (!s) return res.status(404).json({ error: 'PIN no encontrado' });
        const quiz = db.prepare("SELECT name, config_json FROM quizzes WHERE id = ?").get(s.quiz_id);
        const total = db.prepare("SELECT COUNT(*) as c FROM quiz_questions WHERE quiz_id = ?").get(s.quiz_id).c;
        const playersCount = db.prepare("SELECT COUNT(*) as c FROM quiz_players WHERE session_id = ?").get(s.id).c;
        const quizCfg = parseJsonSafe(quiz.config_json, {});
        const out = {
            sessionId: s.id, version: s.version, status: s.status,
            quizName: quiz ? quiz.name : 'Quiz',
            // banderas que la vista del jugador necesita (título y reacciones configurables)
            cfg: {
                showQuestionOnDevice: quizCfg.show_question_on_device !== false,
                reactions: quizCfg.reactions !== false,
                music: quizCfg.play_sounds !== false
            },
            currentIndex: s.current_index, totalQuestions: total,
            questionStartedAt: s.question_started_at,
            playersCount: playersCount
        };
        if (s.current_index >= 0) {
            const q = db.prepare("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC LIMIT 1 OFFSET ?").get(s.quiz_id, s.current_index);
            if (q) {
                const answers = parseJsonSafe(q.answers_json, []);
                const showCorrect = s.status === 'reveal' || s.status === 'scoreboard';
                out.question = {
                    id: q.id, type: q.type, title: q.title, mediaUrl: q.media_url,
                    timeLimit: q.time_limit, startedAt: s.question_started_at,
                    answers: answers.map(function(a, i) {
                        const item = { index: i, text: a.text };
                        if (showCorrect) item.correct = a.correct ? true : false;
                        return item;
                    })
                };
            }
        }
        if (s.status === 'scoreboard') out.top = scoreboardTop(s.id, 10);
        if (s.status === 'ended') out.top = scoreboardTop(s.id, 3);
        // Datos personales del jugador (opcional)
        const playerId = req.query.playerId;
        if (playerId) {
            const me = db.prepare("SELECT id, nickname, points, streak, correct_count FROM quiz_players WHERE id = ? AND session_id = ?").get(String(playerId), s.id);
            if (me) {
                const rank = db.prepare("SELECT COUNT(*) + 1 as r FROM quiz_players WHERE session_id = ? AND (points > ? OR (points = ? AND joined_at < ?))").get(s.id, me.points, me.points, me.joined_at);
                let myLast = null;
                if (s.current_index >= 0) {
                    const qNow = db.prepare("SELECT id FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC LIMIT 1 OFFSET ?").get(s.quiz_id, s.current_index);
                    if (qNow) {
                        const resp = db.prepare("SELECT answer_index, is_correct, points FROM quiz_responses WHERE session_id = ? AND player_id = ? AND question_id = ?").get(s.id, me.id, qNow.id);
                        if (resp) myLast = { answerIndex: resp.answer_index, isCorrect: resp.is_correct === 1, points: resp.points };
                    }
                }
                out.me = { playerId: me.id, nickname: me.nickname, points: me.points, streak: me.streak, correctCount: me.correct_count, rank: rank ? rank.r : 1, lastAnswer: myLast };
            }
        }
        res.json(out);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Público: responder ──

router.post('/public/answer', (req, res) => {
    try {
        const { pin, playerId, questionId, answerIndex } = req.body || {};
        const s = db.prepare("SELECT * FROM quiz_sessions WHERE pin = ?").get(String(pin || '').trim());
        if (!s) return res.status(404).json({ error: 'Partida no encontrada' });
        if (s.status !== 'question') return res.status(400).json({ error: 'La pregunta no está abierta' });
        const player = db.prepare("SELECT * FROM quiz_players WHERE id = ? AND session_id = ?").get(String(playerId || ''), s.id);
        if (!player) return res.status(401).json({ error: 'Jugador no encontrado en esta partida' });
        const q = db.prepare("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC LIMIT 1 OFFSET ?").get(s.quiz_id, s.current_index);
        if (!q || q.id !== String(questionId)) return res.status(400).json({ error: 'Pregunta no coincide' });
        const answers = parseJsonSafe(q.answers_json, []);
        const idx = parseInt(answerIndex);
        if (isNaN(idx) || idx < 0 || idx >= answers.length) return res.status(400).json({ error: 'Respuesta inválida' });
        const dup = db.prepare("SELECT id FROM quiz_responses WHERE session_id = ? AND player_id = ? AND question_id = ?").get(s.id, player.id, q.id);
        if (dup) return res.status(400).json({ error: 'Ya respondiste esta pregunta' });
        // ventana de respuesta: tiempo límite + 1.5s de gracia de red
        const startedAt = s.question_started_at ? new Date(s.question_started_at).getTime() : Date.now();
        const elapsed = Date.now() - startedAt;
        const window = (q.time_limit || 20) * 1000 + 1500;
        if (elapsed > window) return res.status(400).json({ error: 'Se agotó el tiempo de esta pregunta' });
        const isCorrect = answers[idx] && answers[idx].correct ? true : false;
        const msTaken = Math.max(Math.min(elapsed, window), 0);
        const score = computeScore(q.points_mode, msTaken, q.time_limit, player.streak, isCorrect);
        const now = new Date().toISOString();
        const tx = db.transaction(function() {
            db.prepare("INSERT INTO quiz_responses (id, session_id, player_id, question_id, answer_index, is_correct, points, ms_taken, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
                uuidv4(), s.id, player.id, q.id, idx, isCorrect ? 1 : 0, score.points + score.bonus, msTaken, now
            );
            db.prepare("UPDATE quiz_players SET points = points + ?, streak = ?, correct_count = correct_count + ?, last_seen_at = ? WHERE id = ?").run(
                score.points + score.bonus, score.streak, isCorrect ? 1 : 0, now, player.id
            );
        });
        tx();
        const updated = db.prepare("SELECT points, streak FROM quiz_players WHERE id = ?").get(player.id);
        const rank = db.prepare("SELECT COUNT(*) + 1 as r FROM quiz_players WHERE session_id = ? AND points > ?").get(s.id, updated.points);
        res.json({
            success: true, isCorrect: isCorrect, points: score.points, bonus: score.bonus,
            totalPoints: updated.points, streak: updated.streak, rank: rank ? rank.r : 1
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Público: reacción emoji ──

router.post('/public/session/:pin/react', (req, res) => {
    try {
        const s = db.prepare("SELECT * FROM quiz_sessions WHERE pin = ? AND status != 'ended'").get(String(req.params.pin).trim());
        if (!s) return res.status(404).json({ error: 'Partida no encontrada' });
        const allowed = ['👍', '👏', '❤️', '😂', '🤔', '😮'];
        const emoji = allowed.includes(req.body && req.body.emoji) ? req.body.emoji : null;
        if (!emoji) return res.status(400).json({ error: 'Reacción no permitida' });
        const player = db.prepare("SELECT id, nickname FROM quiz_players WHERE id = ? AND session_id = ?").get(String((req.body && req.body.playerId) || ''), s.id);
        const nickname = player ? player.nickname : 'Anónimo';
        // máx 1 reacción por jugador cada 3s (anti-spam)
        if (player) {
            const cutoff = new Date(Date.now() - 3000).toISOString();
            const recent = db.prepare("SELECT id FROM quiz_reactions WHERE session_id = ? AND player_id = ? AND created_at > ?").get(s.id, player.id, cutoff);
            if (recent) return res.status(429).json({ error: 'Espera un momento para otra reacción' });
        }
        db.prepare("INSERT INTO quiz_reactions (id, session_id, player_id, nickname, emoji, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
            uuidv4(), s.id, player ? player.id : null, nickname, emoji, new Date().toISOString()
        );
        try {
            const io = require('../../socket').getIO();
            if (io) io.to('quiz:' + s.id).emit('quiz_reaction', { nickname: nickname, emoji: emoji });
        } catch (e) {}
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
