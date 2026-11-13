/**
 * Tests del Quiz en vivo (K1 — paridad Kahoot — v12.44.829)
 * Cubre: CRUD, validación de preguntas, ciclo de sesión completo,
 * unión de jugadores, puntuación (rapidez + racha), estado público
 * sin respuestas correctas durante la pregunta, CSV y enlace compartido.
 *
 * Nota: el router se monta en /api/quizzes — TODAS las rutas de request()
 * llevan ese prefijo (sin él, Express responde 404 por ruta no encontrada).
 */
require('dotenv').config();
const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { generateToken } = require('../src/security/jwt');

const quizzesRoutes = require('../src/routes/quizzes.routes');

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/quizzes', quizzesRoutes);
    return app;
}

function getAdminToken() {
    const admin = db.prepare("SELECT id, username, role FROM users WHERE role = 'ADMIN' LIMIT 1").get();
    if (!admin) return null;
    return generateToken({ userId: admin.id, username: admin.username, role: admin.role });
}

// ─── FIXTURE ───
const eventId = uuidv4();
let quizId = null;
let sessionId = null;
let pin = null;
let playerA = null; // jugador rápido (acierta)
let playerB = null; // jugador que falla
let playerC = null; // segundo acertador (racha)

const adminToken = getAdminToken();

beforeAll(function() {
    db.prepare("INSERT OR IGNORE INTO events (id, user_id, name, date, status, created_at) VALUES (?, (SELECT id FROM users WHERE role='ADMIN' LIMIT 1), ?, ?, 'ACTIVE', ?)")
      .run(eventId, 'Evento Quiz Test ' + Date.now(), '2026-12-01', new Date().toISOString());
});

afterAll(function() {
    // limpieza (cascada manual como en la ruta DELETE)
    if (quizId) {
        db.prepare("DELETE FROM quiz_reactions WHERE session_id IN (SELECT id FROM quiz_sessions WHERE quiz_id = ?)").run(quizId);
        db.prepare("DELETE FROM quiz_responses WHERE session_id IN (SELECT id FROM quiz_sessions WHERE quiz_id = ?)").run(quizId);
        db.prepare("DELETE FROM quiz_players WHERE session_id IN (SELECT id FROM quiz_sessions WHERE quiz_id = ?)").run(quizId);
        db.prepare("DELETE FROM quiz_sessions WHERE quiz_id = ?").run(quizId);
        db.prepare("DELETE FROM quiz_questions WHERE quiz_id = ?").run(quizId);
        db.prepare("DELETE FROM quizzes WHERE id = ?").run(quizId);
    }
    db.prepare("DELETE FROM events WHERE id = ?").run(eventId);
});

describe('Quiz CRUD', () => {
    test('crea un quiz', async () => {
        if (!adminToken) return;
        const res = await request(createTestApp())
            .post('/api/quizzes/events/' + eventId + '/quizzes')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ name: 'Trivia K1' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.id).toBeTruthy();
        quizId = res.body.id;
    });

    test('rechaza crear sin nombre', async () => {
        if (!adminToken) return;
        const res = await request(createTestApp())
            .post('/api/quizzes/events/' + eventId + '/quizzes')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({});
        expect(res.status).toBe(400);
    });

    test('rechaza crear sin token', async () => {
        const res = await request(createTestApp())
            .post('/api/quizzes/events/' + eventId + '/quizzes')
            .send({ name: 'x' });
        expect(res.status).toBe(401);
    });

    test('guarda preguntas completas (PUT reemplaza atómicamente)', async () => {
        if (!adminToken || !quizId) return;
        const res = await request(createTestApp())
            .put('/api/quizzes/' + quizId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({
                name: 'Trivia K1',
                status: 'published',
                config: { play_sounds: true, reactions: true },
                questions: [
                    { type: 'quiz', title: '¿Cuál es la capital de Colombia?', timeLimit: 20, pointsMode: 'standard',
                      answers: [{ text: 'Bogotá', correct: true }, { text: 'Medellín', correct: false }, { text: 'Cali', correct: false }, { text: 'Barranquilla', correct: false }] },
                    { type: 'true_false', title: 'La ruleta es una función de Check Pro', timeLimit: 10, pointsMode: 'double',
                      answers: [{ text: 'Verdadero', correct: true }, { text: 'Falso', correct: false }] },
                    { type: 'quiz', title: 'Pregunta sin puntos', timeLimit: 5, pointsMode: 'none',
                      answers: [{ text: 'A', correct: true }, { text: 'B', correct: false }] }
                ]
            });
        expect(res.status).toBe(200);
        const get = await request(createTestApp())
            .get('/api/quizzes/' + quizId)
            .set('Authorization', 'Bearer ' + adminToken);
        expect(get.status).toBe(200);
        expect(get.body.questions.length).toBe(3);
        expect(get.body.questions[1].type).toBe('true_false');
        expect(get.body.status).toBe('published');
    });

    test('rechaza pregunta sin respuesta correcta', async () => {
        if (!adminToken || !quizId) return;
        const res = await request(createTestApp())
            .put('/api/quizzes/' + quizId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({
                questions: [{ type: 'quiz', title: 'Mala', timeLimit: 20, pointsMode: 'standard',
                    answers: [{ text: 'A', correct: false }, { text: 'B', correct: false }] }]
            });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/correcta/i);
    });

    test('rechaza V/F con más de 2 respuestas', async () => {
        if (!adminToken || !quizId) return;
        const res = await request(createTestApp())
            .put('/api/quizzes/' + quizId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({
                questions: [{ type: 'true_false', title: 'VF', timeLimit: 20, pointsMode: 'standard',
                    answers: [{ text: 'V', correct: true }, { text: 'F', correct: false }, { text: 'X', correct: false }] }]
            });
        expect(res.status).toBe(400);
    });

    test('lista quizzes del evento con conteo de preguntas', async () => {
        if (!adminToken || !quizId) return;
        const res = await request(createTestApp())
            .get('/api/quizzes/events/' + eventId + '/quizzes')
            .set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
        const found = res.body.find(q => q.id === quizId);
        expect(found).toBeTruthy();
        expect(found.questionCount).toBe(3);
    });
});

describe('Enlace compartido (política ruleta)', () => {
    test('GET público devuelve el quiz publicado con preguntas', async () => {
        if (!quizId) return;
        const res = await request(createTestApp()).get('/api/quizzes/' + quizId + '/public');
        expect(res.status).toBe(200);
        expect(res.body.questions.length).toBe(3);
        expect(res.body.questions[0].answers.some(a => a.correct)).toBe(true);
    });

    test('PUT public-config permite guardar sin login en publicado', async () => {
        if (!quizId) return;
        const res = await request(createTestApp())
            .put('/api/quizzes/' + quizId + '/public-config')
            .send({ config: { title: 'Desde el enlace' } });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('rechaza public-config con questions inválidas', async () => {
        if (!quizId) return;
        const res = await request(createTestApp())
            .put('/api/quizzes/' + quizId + '/public-config')
            .send({ questions: [{ type: 'quiz', title: 'Mala', answers: [{ text: 'A', correct: false }, { text: 'B', correct: false }] }] });
        expect(res.status).toBe(400);
    });
});

describe('Ciclo de partida completo', () => {
    test('abre sesión con PIN de 7 dígitos', async () => {
        if (!quizId) return;
        const res = await request(createTestApp())
            .post('/api/quizzes/' + quizId + '/sessions')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({});
        expect(res.status).toBe(200);
        expect(res.body.pin).toMatch(/^\d{7}$/);
        sessionId = res.body.id;
        pin = res.body.pin;
    });

    test('host-state inicial: lobby, sin pregunta', async () => {
        if (!sessionId) return;
        const res = await request(createTestApp()).get('/api/quizzes/sessions/' + sessionId + '/host-state');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('lobby');
        expect(res.body.totalQuestions).toBe(3);
        expect(res.body.question).toBeUndefined();
    });

    test('jugador A se une con apodo', async () => {
        if (!pin) return;
        const res = await request(createTestApp())
            .post('/api/quizzes/public/session/' + pin + '/join')
            .send({ nickname: 'Carlos' });
        expect(res.status).toBe(200);
        expect(res.body.playerId).toBeTruthy();
        playerA = res.body;
    });

    test('apodo duplicado recibe sufijo', async () => {
        if (!pin) return;
        const res = await request(createTestApp())
            .post('/api/quizzes/public/session/' + pin + '/join')
            .send({ nickname: 'Carlos' });
        expect(res.status).toBe(200);
        expect(res.body.nickname).toBe('Carlos2');
        playerB = res.body;
        const r3 = await request(createTestApp())
            .post('/api/quizzes/public/session/' + pin + '/join')
            .send({ nickname: 'Ana' });
        playerC = r3.body;
        // v12.44.830 (bugfix en vivo): unir jugador incrementa la versión de la sesión
        // — sin esto el sondeo del anfitrión no refresca el contador de la sala
        const v = db.prepare("SELECT version FROM quiz_sessions WHERE id = ?").get(sessionId);
        expect(v.version).toBeGreaterThanOrEqual(3); // 1 inicial + 2 uniones
    });

    test('apodo prohibido rechazado', async () => {
        if (!pin) return;
        const res = await request(createTestApp())
            .post('/api/quizzes/public/session/' + pin + '/join')
            .send({ nickname: 'admin' });
        expect(res.status).toBe(400);
    });

    test('PIN inexistente rechazado', async () => {
        const res = await request(createTestApp())
            .post('/api/quizzes/public/session/9999999/join')
            .send({ nickname: 'X' });
        expect(res.status).toBe(404);
    });

    test('mostrar pregunta 1 abre el estado question', async () => {
        if (!sessionId) return;
        const res = await request(createTestApp())
            .post('/api/quizzes/sessions/' + sessionId + '/show-question')
            .send({ index: 0 });
        expect(res.status).toBe(200);
        const st = await request(createTestApp()).get('/api/quizzes/sessions/' + sessionId + '/host-state');
        expect(st.body.status).toBe('question');
        expect(st.body.question.title).toMatch(/capital de Colombia/);
        expect(st.body.question.answers.length).toBe(4);
    });

    test('estado público OCULTA las respuestas correctas durante la pregunta', async () => {
        if (!pin) return;
        const res = await request(createTestApp()).get('/api/quizzes/public/session/' + pin + '/state');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('question');
        expect(res.body.question.answers.every(a => a.correct === undefined)).toBe(true);
        expect(res.body.cfg).toBeTruthy();
    });

    test('responder correcto y rápido puntúa alto (A)', async () => {
        if (!pin || !playerA) return;
        const st = await request(createTestApp()).get('/api/quizzes/sessions/' + sessionId + '/host-state');
        const qid = st.body.question.id;
        const res = await request(createTestApp())
            .post('/api/quizzes/public/answer')
            .send({ pin: pin, playerId: playerA.playerId, questionId: qid, answerIndex: 0 });
        expect(res.status).toBe(200);
        expect(res.body.isCorrect).toBe(true);
        expect(res.body.points).toBeGreaterThanOrEqual(900);
        expect(res.body.totalPoints).toBe(res.body.points);
    });

    test('responder incorrecto da 0 puntos (B)', async () => {
        if (!pin || !playerB) return;
        const st = await request(createTestApp()).get('/api/quizzes/sessions/' + sessionId + '/host-state');
        const qid = st.body.question.id;
        const res = await request(createTestApp())
            .post('/api/quizzes/public/answer')
            .send({ pin: pin, playerId: playerB.playerId, questionId: qid, answerIndex: 1 });
        expect(res.status).toBe(200);
        expect(res.body.isCorrect).toBe(false);
        expect(res.body.totalPoints).toBe(0);
    });

    test('respuesta duplicada rechazada', async () => {
        if (!pin || !playerA) return;
        const st = await request(createTestApp()).get('/api/quizzes/sessions/' + sessionId + '/host-state');
        const qid = st.body.question.id;
        const res = await request(createTestApp())
            .post('/api/quizzes/public/answer')
            .send({ pin: pin, playerId: playerA.playerId, questionId: qid, answerIndex: 2 });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Ya respondiste/i);
    });

    test('respuestas cerradas tras reveal se rechazan', async () => {
        if (!pin || !playerC) return;
        await request(createTestApp()).post('/api/quizzes/sessions/' + sessionId + '/reveal').send({});
        const st = await request(createTestApp()).get('/api/quizzes/sessions/' + sessionId + '/host-state');
        const qid = st.body.question.id;
        const res = await request(createTestApp())
            .post('/api/quizzes/public/answer')
            .send({ pin: pin, playerId: playerC.playerId, questionId: qid, answerIndex: 0 });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/no está abierta/i);
    });

    test('reveal muestra correctas en el estado público y conteos en host', async () => {
        if (!pin) return;
        const st = await request(createTestApp()).get('/api/quizzes/sessions/' + sessionId + '/host-state');
        expect(st.body.status).toBe('reveal');
        expect(st.body.answerCounts.filter(n => n > 0).length).toBe(2);
        expect(st.body.correctCount).toBe(1);
        const pub = await request(createTestApp()).get('/api/quizzes/public/session/' + pin + '/state');
        expect(pub.body.question.answers.some(a => a.correct === true)).toBe(true);
    });

    test('flujo pregunta 2 V/F con puntos dobles y racha', async () => {
        if (!pin || !playerA || !playerC) return;
        await request(createTestApp()).post('/api/quizzes/sessions/' + sessionId + '/scoreboard').send({});
        await request(createTestApp()).post('/api/quizzes/sessions/' + sessionId + '/show-question').send({ index: 1 });
        const st = await request(createTestApp()).get('/api/quizzes/sessions/' + sessionId + '/host-state');
        expect(st.body.question.type).toBe('true_false');
        const qid = st.body.question.id;
        // A acierta de nuevo (racha 2 → bonus 100); C acierta (racha 1 → sin bonus)
        const ra = await request(createTestApp()).post('/api/quizzes/public/answer')
            .send({ pin: pin, playerId: playerA.playerId, questionId: qid, answerIndex: 0 });
        const rc = await request(createTestApp()).post('/api/quizzes/public/answer')
            .send({ pin: pin, playerId: playerC.playerId, questionId: qid, answerIndex: 0 });
        expect(ra.body.isCorrect).toBe(true);
        expect(rc.body.isCorrect).toBe(true);
        expect(ra.body.bonus).toBe(100);
        expect(rc.body.bonus).toBe(0);
        expect(ra.body.points).toBeGreaterThanOrEqual(1900);
        expect(ra.body.streak).toBe(2);
    });

    test('scoreboard ordena por puntos', async () => {
        if (!sessionId) return;
        const sb = await request(createTestApp()).post('/api/quizzes/sessions/' + sessionId + '/scoreboard').send({});
        expect(sb.status).toBe(200);
        expect(sb.body.top[0].nickname).toBe('Carlos');
        const st = await request(createTestApp()).get('/api/quizzes/sessions/' + sessionId + '/host-state');
        expect(st.body.status).toBe('scoreboard');
        expect(st.body.top).toBeTruthy();
    });

    test('podio cierra la partida y el estado público refleja ended', async () => {
        if (!sessionId || !pin) return;
        const res = await request(createTestApp()).post('/api/quizzes/sessions/' + sessionId + '/podio').send({});
        expect(res.status).toBe(200);
        expect(res.body.top.length).toBe(3);
        expect(res.body.top[0].nickname).toBe('Carlos');
        const pub = await request(createTestApp()).get('/api/quizzes/public/session/' + pin + '/state');
        expect(pub.body.status).toBe('ended');
        expect(pub.body.top.length).toBe(3);
    });

    test('expulsar jugador elimina sus respuestas', async () => {
        if (!sessionId || !playerB) return;
        const res = await request(createTestApp())
            .delete('/api/quizzes/sessions/' + sessionId + '/players/' + playerB.playerId);
        expect(res.status).toBe(200);
        const st = await request(createTestApp()).get('/api/quizzes/sessions/' + sessionId + '/host-state');
        expect(st.body.players.find(p => p.id === playerB.playerId)).toBeUndefined();
    });

    test('reacciones: emoji válido aceptado, inválido rechazado, spam 429', async () => {
        if (!pin || !playerA) return;
        // la partida terminó; react exige sesión viva → reabrimos lobby
        await request(createTestApp()).post('/api/quizzes/sessions/' + sessionId + '/lobby').send({});
        const ok = await request(createTestApp())
            .post('/api/quizzes/public/session/' + pin + '/react')
            .send({ playerId: playerA.playerId, emoji: '👍' });
        expect(ok.status).toBe(200);
        const bad = await request(createTestApp())
            .post('/api/quizzes/public/session/' + pin + '/react')
            .send({ playerId: playerA.playerId, emoji: '🔥' });
        expect(bad.status).toBe(400);
        const spam = await request(createTestApp())
            .post('/api/quizzes/public/session/' + pin + '/react')
            .send({ playerId: playerA.playerId, emoji: '👏' });
        expect(spam.status).toBe(429);
    });

    test('export CSV requiere token y trae BOM UTF-8', async () => {
        if (!quizId) return;
        const res = await request(createTestApp()).get('/api/quizzes/' + quizId + '/export-csv');
        expect(res.status).toBe(401);
        const ok = await request(createTestApp())
            .get('/api/quizzes/' + quizId + '/export-csv')
            .set('Authorization', 'Bearer ' + adminToken);
        expect(ok.status).toBe(200);
        expect(ok.text).toMatch(/jugador/);
        expect(ok.text).toContain('\uFEFF');
    });

    test('resultados listan sesiones con top', async () => {
        if (!quizId) return;
        const res = await request(createTestApp())
            .get('/api/quizzes/' + quizId + '/results')
            .set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
        expect(res.body[0].pin).toMatch(/^\d{7}$/);
    });

    test('QR responde imagen PNG', async () => {
        if (!quizId) return;
        const res = await request(createTestApp()).get('/api/quizzes/' + quizId + '/qr?pin=' + (pin || '1234567'));
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/image\/png/);
    });
});

describe('Quiz DELETE', () => {
    test('borra quiz y deja huérfanos en cero', async () => {
        if (!adminToken || !quizId) return;
        const res = await request(createTestApp())
            .delete('/api/quizzes/' + quizId)
            .set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
        const q = db.prepare("SELECT id FROM quizzes WHERE id = ?").get(quizId);
        expect(q).toBeUndefined();
        const sess = db.prepare("SELECT COUNT(*) as c FROM quiz_sessions WHERE quiz_id = ?").get(quizId);
        expect(sess.c).toBe(0);
        quizId = null;
    });
});
