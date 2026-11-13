/**
 * Tests de la Trivia promocional (P3 — paridad AppSorteos — v12.44.834)
 * Cubre: CRUD con plantilla por defecto, gestión de preguntas (crear/validar/import CSV),
 * anti-trampa (public NO expone correct_index; public-editor SÍ), juego público con
 * corrección en el servidor (todo correcto / parcial con nota de aprobación),
 * seguridad (máx. por email), leads CSV con BOM, QR, comprobante PDF y DELETE cascada.
 *
 * Nota: el router se monta en /api/trivias — TODAS las rutas de request()
 * llevan ese prefijo COMPLETO.
 */
require('dotenv').config();
const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { generateToken } = require('../src/security/jwt');

const triviasRoutes = require('../src/routes/trivias.routes');

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/trivias', triviasRoutes);
    return app;
}

function getAdminToken() {
    const admin = db.prepare("SELECT id, username, role FROM users WHERE role = 'ADMIN' LIMIT 1").get();
    if (!admin) return null;
    return generateToken({ userId: admin.id, username: admin.username, role: admin.role });
}

const eventId = uuidv4();
let triviaId = null;
const adminToken = getAdminToken();

// preguntas esperadas en orden de servidor (ver CSV más abajo)
const CSV = [
    '¿Capital de Francia?;Madrid;París;Roma;Londres;1',
    '¿Cuánto es 2+2?;4;5;6;7;0',
    '¿El cielo es azul?;No;Sí;1'
].join('\n');
const ALL_CORRECT = [1, 1, 0, 1]; // Q1 creada con correct_index 1 + las 3 del CSV
const MOSTLY_WRONG = [0, 0, 0, 0]; // solo acierta la Q3 (índice 0)

beforeAll(function() {
    db.prepare("INSERT OR IGNORE INTO events (id, user_id, name, date, status, created_at) VALUES (?, (SELECT id FROM users WHERE role='ADMIN' LIMIT 1), ?, ?, 'ACTIVE', ?)")
      .run(eventId, 'Evento Trivia Test ' + Date.now(), '2026-12-20', new Date().toISOString());
});

afterAll(function() {
    if (triviaId) {
        db.prepare("DELETE FROM trivia_plays WHERE trivia_id = ?").run(triviaId);
        db.prepare("DELETE FROM trivia_questions WHERE trivia_id = ?").run(triviaId);
        db.prepare("DELETE FROM trivias WHERE id = ?").run(triviaId);
        triviaId = null;
    }
    db.prepare("DELETE FROM events WHERE id = ?").run(eventId);
});

describe('Trivia CRUD y preguntas', () => {
    test('crea una trivia con plantilla por defecto', async () => {
        if (!adminToken) return;
        const res = await request(createTestApp())
            .post('/api/trivias/events/' + eventId + '/trivias')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ name: 'Trivia de Marca TEST' });
        expect(res.status).toBe(200);
        expect(res.body.id).toBeTruthy();
        triviaId = res.body.id;
        const get = await request(createTestApp())
            .get('/api/trivias/' + triviaId)
            .set('Authorization', 'Bearer ' + adminToken);
        expect(get.status).toBe(200);
        expect(get.body.status).toBe('draft');
        expect(get.body.config.texts.welcome_title).toBe('Bienvenido al Quiz');
        expect(get.body.config.texts.final_desc).toContain('[score]');
        expect(get.body.config.quiz.time_limit).toBe(0);
        expect(get.body.config.quiz.feedback).toBe('selected');
        expect(get.body.config.quiz.indicator).toBe('none');
        expect(get.body.config.quiz.passing_grade).toBe(0);
        expect(get.body.config.scoring).toBe('percentage');
        expect(get.body.config.design.bg_color).toBe('#1e3a5f');
        expect(get.body.config.security.max_per_email).toBe(1);
        expect(get.body.config.prize_on_pass).toBeNull();
        expect(get.body.questions.length).toBe(0);
    });

    test('rechaza crear sin nombre y sin token', async () => {
        if (!adminToken) return;
        const r1 = await request(createTestApp())
            .post('/api/trivias/events/' + eventId + '/trivias')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({});
        expect(r1.status).toBe(400);
        const r2 = await request(createTestApp())
            .post('/api/trivias/events/' + eventId + '/trivias')
            .send({ name: 'x' });
        expect(r2.status).toBe(401);
    });

    test('crea pregunta (POST questions) con 4 respuestas + correct_index', async () => {
        if (!adminToken || !triviaId) return;
        const res = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/questions')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ question: '¿Cuál es el río más largo del mundo?', answers: ['Nilo', 'Amazonas', 'Yangtsé', 'Misisipi'], correct_index: 1 });
        expect(res.status).toBe(200);
        expect(res.body.id).toBeTruthy();
        const list = await request(createTestApp())
            .get('/api/trivias/' + triviaId + '/questions')
            .set('Authorization', 'Bearer ' + adminToken);
        expect(list.status).toBe(200);
        expect(list.body.length).toBe(1);
        expect(list.body[0].correct_index).toBe(1);
        expect(list.body[0].answers.length).toBe(4);
    });

    test('rechaza correct_index inválido (>3 o fuera de rango) y answers < 2', async () => {
        if (!adminToken || !triviaId) return;
        const r1 = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/questions')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ question: '¿?', answers: ['a', 'b', 'c', 'd'], correct_index: 4 });
        expect(r1.status).toBe(400);
        const r2 = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/questions')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ question: '¿?', answers: ['única'], correct_index: 0 });
        expect(r2.status).toBe(400);
        const r3 = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/questions')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ question: '¿?', answers: ['a', 'b'], correct_index: 2 });
        expect(r3.status).toBe(400);
    });

    test('import CSV de 3 preguntas funciona', async () => {
        if (!adminToken || !triviaId) return;
        const res = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/questions/import')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ csv: CSV });
        expect(res.status).toBe(200);
        expect(res.body.imported).toBe(3);
        expect(res.body.skipped).toBe(0);
        const list = await request(createTestApp())
            .get('/api/trivias/' + triviaId + '/questions')
            .set('Authorization', 'Bearer ' + adminToken);
        expect(list.body.length).toBe(4);
        // el índice correcto del CSV se respetó (París = 1, 4 = 0, Sí = 1)
        expect(list.body[1].correct_index).toBe(1);
        expect(list.body[2].correct_index).toBe(0);
        expect(list.body[3].correct_index).toBe(1);
        // la de 2 respuestas se acepta
        expect(list.body[3].answers.length).toBe(2);
    });

    test('DELETE /:id/questions/:qid elimina solo esa pregunta', async () => {
        if (!adminToken || !triviaId) return;
        const list = await request(createTestApp())
            .get('/api/trivias/' + triviaId + '/questions')
            .set('Authorization', 'Bearer ' + adminToken);
        const extra = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/questions')
            .set('Authorization', 'Bearer ' + adminToken)
            .send({ question: 'Temporal', answers: ['x', 'y'], correct_index: 0 });
        expect(extra.status).toBe(200);
        const del = await request(createTestApp())
            .delete('/api/trivias/' + triviaId + '/questions/' + extra.body.id)
            .set('Authorization', 'Bearer ' + adminToken);
        expect(del.status).toBe(200);
        const list2 = await request(createTestApp())
            .get('/api/trivias/' + triviaId + '/questions')
            .set('Authorization', 'Bearer ' + adminToken);
        expect(list2.body.length).toBe(list.body.length);
    });
});

describe('Trivia juego público', () => {
    test('403 si no está publicada', async () => {
        if (!triviaId) return;
        const res = await request(createTestApp()).get('/api/trivias/' + triviaId + '/public');
        expect(res.status).toBe(403);
    });

    test('public NO expone correct_index en las preguntas', async () => {
        if (!adminToken || !triviaId) return;
        // publicar con nota 50% y premio al aprobar
        const put = await request(createTestApp())
            .put('/api/trivias/' + triviaId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({
                name: 'Trivia de Marca TEST',
                status: 'published',
                config: {
                    language: 'es',
                    texts: { welcome_title: 'Bienvenido al Quiz', welcome_desc: 'Demuestra cuánto sabes', start_button: 'Comenzar', final_title: 'Felicitaciones, ¡has terminado!', final_desc: 'Tu puntuación: [score]', certificate: 'Descargar comprobante' },
                    quiz: { time_limit: 15, feedback: 'selected_correct', indicator: 'letters', passing_grade: 50, shuffle_questions: false, shuffle_answers: false, music: false, show_question_numbers: true },
                    scoring: 'percentage',
                    final_button: 'retry',
                    redirect_url: '',
                    design: { bg_color: '#1e3a5f', text_color: '#ffffff', button_color: '#0ea5e9', accent_color: '#fbbf24' },
                    form: { email: true, name: true, apellido: false, phone: false, consent_text: '' },
                    security: { max_per_email: 1, allowed_emails: [], device_limit: 'off', device_max: 1 },
                    share_buttons: true,
                    certificate: true,
                    prize_on_pass: { type: 'cupon', label: '10% OFF', value: 'PASS10' }
                }
            });
        expect(put.status).toBe(200);
        const res = await request(createTestApp()).get('/api/trivias/' + triviaId + '/public');
        expect(res.status).toBe(200);
        expect(res.body.questions.length).toBe(4);
        res.body.questions.forEach(function(q) {
            expect(q).not.toHaveProperty('correct_index');
            expect(q.question).toBeTruthy();
            expect(Array.isArray(q.answers)).toBe(true);
        });
        expect(res.body.prize_on_pass.label).toBe('10% OFF');
        expect(res.body.prize_on_pass.value).toBeUndefined(); // el valor del cupón no viaja al juego
        expect(res.body.quiz.time_limit).toBe(15);
        const res2 = await request(createTestApp()).get('/api/trivias/' + triviaId + '/public');
        expect(res2.body.views).toBeGreaterThan(res.body.views); // suma vistas
    });

    test('verify confirma UNA respuesta (acierto y fallo)', async () => {
        if (!triviaId) return;
        const ok = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/verify')
            .send({ qi: 0, answer: 1 });
        expect(ok.status).toBe(200);
        expect(ok.body.correct).toBe(true);
        const bad = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/verify')
            .send({ qi: 0, answer: 0 });
        expect(bad.status).toBe(200);
        expect(bad.body.correct).toBe(false);
        const out = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/verify')
            .send({ qi: 99, answer: 0 });
        expect(out.status).toBe(400);
    });

    test('public-editor SÍ expone correct_index (para el editor por enlace)', async () => {
        if (!triviaId) return;
        const res = await request(createTestApp()).get('/api/trivias/' + triviaId + '/public-editor');
        expect(res.status).toBe(200);
        expect(res.body.questions.length).toBe(4);
        res.body.questions.forEach(function(q) {
            expect(q).toHaveProperty('correct_index');
            expect(q.correct_index).toBeGreaterThanOrEqual(0);
        });
        expect(res.body.config.prize_on_pass.value).toBe('PASS10'); // el editor sí ve el valor
    });

    test('play con todas correctas: score=total, passed=true, prize_on_pass asignado', async () => {
        if (!triviaId) return;
        const res = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/play')
            .send({ email: 'ana@test.com', name: 'Ana', deviceId: 'dev-1', answers: ALL_CORRECT });
        expect(res.status).toBe(200);
        expect(res.body.score).toBe(4);
        expect(res.body.total).toBe(4);
        expect(res.body.passed).toBe(true);
        expect(res.body.prize).toBeTruthy();
        expect(res.body.prize.label).toBe('10% OFF');
        expect(res.body.prize.type).toBe('cupon');
        expect(res.body.prize.value).toBe('PASS10');
        expect(res.body.playId).toBeTruthy();
    });

    test('máx participaciones por email (1)', async () => {
        if (!triviaId) return;
        const res = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/play')
            .send({ email: 'ana@test.com', answers: ALL_CORRECT });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Ya participaste/i);
    });

    test('play con algunas mal: score parcial; nota de aprobación 100 → passed=false sin premio', async () => {
        if (!adminToken || !triviaId) return;
        // nota de aprobación 100% (config completa como la envía el editor)
        const put = await request(createTestApp())
            .put('/api/trivias/' + triviaId)
            .set('Authorization', 'Bearer ' + adminToken)
            .send({
                config: {
                    language: 'es',
                    texts: { welcome_title: 'Bienvenido al Quiz', welcome_desc: '', start_button: 'Comenzar', final_title: 'Fin', final_desc: 'Tu puntuación: [score]', certificate: 'Descargar comprobante' },
                    quiz: { time_limit: 0, feedback: 'selected', indicator: 'none', passing_grade: 100, shuffle_questions: false, shuffle_answers: false, music: false, show_question_numbers: true },
                    scoring: 'percentage',
                    final_button: 'retry',
                    redirect_url: '',
                    design: { bg_color: '#1e3a5f', text_color: '#ffffff', button_color: '#0ea5e9', accent_color: '#fbbf24' },
                    form: { email: true, name: false, apellido: false, phone: false, consent_text: '' },
                    security: { max_per_email: 1, allowed_emails: [], device_limit: 'off', device_max: 1 },
                    share_buttons: true,
                    certificate: true,
                    prize_on_pass: { type: 'cupon', label: '10% OFF', value: 'PASS10' }
                }
            });
        expect(put.status).toBe(200);
        const res = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/play')
            .send({ email: 'beto@test.com', answers: MOSTLY_WRONG });
        expect(res.status).toBe(200);
        expect(res.body.score).toBe(1);
        expect(res.body.total).toBe(4);
        expect(res.body.passed).toBe(false);
        expect(res.body.prize).toBeNull();
    });

    test('rechaza email inválido y respuestas fuera de rango no suman', async () => {
        if (!triviaId) return;
        const r1 = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/play')
            .send({ email: 'no-es-email', answers: ALL_CORRECT });
        expect(r1.status).toBe(400);
        // índices imposibles (99) cuentan como sin responder: score 0, y con nota 100 no aprueba
        const r2 = await request(createTestApp())
            .post('/api/trivias/' + triviaId + '/play')
            .send({ email: 'carla@test.com', answers: [99, -1, 99, 99] });
        expect(r2.status).toBe(200);
        expect(r2.body.score).toBe(0);
        expect(r2.body.passed).toBe(false);
    });

    test('leads y CSV de leads con BOM', async () => {
        if (!adminToken || !triviaId) return;
        const leads = await request(createTestApp())
            .get('/api/trivias/' + triviaId + '/leads')
            .set('Authorization', 'Bearer ' + adminToken);
        expect(leads.status).toBe(200);
        expect(leads.body.length).toBeGreaterThanOrEqual(3);
        const ana = leads.body.find(function(p) { return p.email === 'ana@test.com'; });
        expect(ana.score).toBe(4);
        expect(ana.passed).toBe(1);
        expect(ana.prize_value).toBe('PASS10');
        const csv = await request(createTestApp())
            .get('/api/trivias/' + triviaId + '/export-csv')
            .set('Authorization', 'Bearer ' + adminToken);
        expect(csv.status).toBe(200);
        expect(csv.text).toContain('\uFEFF');
        expect(csv.text).toMatch(/email,nombre/);
        expect(csv.text).toMatch(/puntuacion/);
        const noAuth = await request(createTestApp()).get('/api/trivias/' + triviaId + '/export-csv');
        expect(noAuth.status).toBe(401);
    });

    test('QR responde PNG y comprobante PDF de una jugada real', async () => {
        if (!adminToken || !triviaId) return;
        const qr = await request(createTestApp()).get('/api/trivias/' + triviaId + '/qr');
        expect(qr.status).toBe(200);
        expect(qr.headers['content-type']).toMatch(/image\/png/);
        const leads = await request(createTestApp())
            .get('/api/trivias/' + triviaId + '/leads')
            .set('Authorization', 'Bearer ' + adminToken);
        const playId = leads.body.find(function(p) { return p.email === 'ana@test.com'; }).id;
        const cert = await request(createTestApp())
            .get('/api/trivias/' + triviaId + '/certificate?play=' + playId);
        expect(cert.status).toBe(200);
        expect(cert.headers['content-type']).toMatch(/application\/pdf/);
        const certBad = await request(createTestApp())
            .get('/api/trivias/' + triviaId + '/certificate?play=no-existe');
        expect(certBad.status).toBe(404);
    });

    test('public-config desde el enlace guarda config y preguntas (auditado)', async () => {
        if (!triviaId) return;
        const res = await request(createTestApp())
            .put('/api/trivias/' + triviaId + '/public-config')
            .send({
                config: { texts: { welcome_title: 'Editada desde el enlace' } },
                questions: [
                    { question: '¿Pregunta editada?', answers: ['a', 'b'], correct_index: 1 }
                ]
            });
        expect(res.status).toBe(200);
        const pub = await request(createTestApp()).get('/api/trivias/' + triviaId + '/public');
        expect(pub.body.questions.length).toBe(1);
        expect(pub.body.questions[0].question).toBe('¿Pregunta editada?');
        // rechaza preguntas inválidas desde el enlace
        const bad = await request(createTestApp())
            .put('/api/trivias/' + triviaId + '/public-config')
            .send({ questions: [{ question: '¿?', answers: ['una'], correct_index: 0 }] });
        expect(bad.status).toBe(400);
    });

    test('DELETE elimina todo en cascada', async () => {
        if (!adminToken || !triviaId) return;
        const res = await request(createTestApp())
            .delete('/api/trivias/' + triviaId)
            .set('Authorization', 'Bearer ' + adminToken);
        expect(res.status).toBe(200);
        const q = db.prepare("SELECT id FROM trivias WHERE id = ?").get(triviaId);
        expect(q).toBeUndefined();
        const questions = db.prepare("SELECT COUNT(*) as c FROM trivia_questions WHERE trivia_id = ?").get(triviaId);
        expect(questions.c).toBe(0);
        const plays = db.prepare("SELECT COUNT(*) as c FROM trivia_plays WHERE trivia_id = ?").get(triviaId);
        expect(plays.c).toBe(0);
        triviaId = null;
    });
});
