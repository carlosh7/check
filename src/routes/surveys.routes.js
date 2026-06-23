/**
 * Rutas de Encuestas (Builder + Dashboard + Pública)
 */
const express = require('express');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { getEventDb } = require('../utils/event-db');

const router = express.Router();

function getQuestionsWithType(templateId) {
    const eDb = db;
    var rows = eDb.prepare("SELECT * FROM survey_questions WHERE template_id = ? ORDER BY order_index ASC").all(templateId);
    rows.forEach(function(r) {
        if (r.options_json) { try { r.options = JSON.parse(r.options_json); } catch(e) { r.options = []; } }
        if (r.conditional_json) { try { r.conditional = JSON.parse(r.conditional_json); } catch(e) { r.conditional = null; } }
    });
    return rows;
}

// ── CRUD Survey Templates ──

router.get('/:eventId/templates', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var templates = db.prepare("SELECT * FROM survey_templates WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId);
        res.json(templates);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

const createSurveyTemplateSchema = z.object({
    title: z.string().min(1, 'Título requerido').max(200),
    description: z.string().max(2000).optional()
});

const createSuggestionSchema = z.object({
    guest_id: z.string().max(100).optional(),
    suggestion: z.string().min(1, 'Sugerencia requerida').max(2000)
});

router.post('/:eventId/templates', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const result = createSurveyTemplateSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`) });
        }
        var { title, description } = result.data;
        var id = uuidv4();
        db.prepare("INSERT INTO survey_templates (id, event_id, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)").run(
            id, req.params.eventId, title.trim(), description || '', new Date().toISOString(), new Date().toISOString()
        );
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.get('/templates/:id', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var template = db.prepare("SELECT * FROM survey_templates WHERE id = ?").get(req.params.id);
        if (!template) return res.status(404).json({ error: 'Encuesta no encontrada' });
        res.json(template);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.put('/templates/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { title, description, status } = req.body;
        db.prepare("UPDATE survey_templates SET title = COALESCE(?, title), description = COALESCE(?, description), status = COALESCE(?, status), updated_at = ? WHERE id = ?").run(
            title || null, description || null, status || null, new Date().toISOString(), req.params.id
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.delete('/templates/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM survey_questions WHERE template_id = ?").run(req.params.id);
        db.prepare("DELETE FROM survey_templates WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── CRUD Survey Questions ──

router.get('/templates/:templateId/questions', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var questions = getQuestionsWithType(req.params.templateId);
        res.json(questions);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.post('/templates/:templateId/questions', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var questionSchema = z.object({
            type: z.enum(['short_text', 'long_text', 'single_choice', 'multiple_choice', 'rating', 'dropdown', 'date', 'email']).optional(),
            title: z.string().min(1, 'Título requerido').max(500),
            description: z.string().max(1000).optional(),
            options: z.array(z.object({ label: z.string().min(1) })).optional(),
            required: z.boolean().optional(),
            order_index: z.number().int().optional(),
            section: z.string().max(200).optional(),
            image_url: z.string().url().optional().or(z.literal('')),
            has_other: z.boolean().optional(),
            conditional: z.record(z.any()).optional()
        });
        var parsed = questionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ errors: parsed.error.issues.map(function(e) { return e.path.join('.') + ': ' + e.message; }) });
        }
        var { type, title, description, options, required, order_index, section, image_url, has_other, conditional } = parsed.data;
        var id = uuidv4();
        var maxOrder = db.prepare("SELECT COALESCE(MAX(order_index), -1) + 1 as next FROM survey_questions WHERE template_id = ?").get(req.params.templateId);
        db.prepare("INSERT INTO survey_questions (id, template_id, type, title, description, options_json, required, order_index, section, image_url, has_other, conditional_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
            id, req.params.templateId, type || 'short_text', title, description || '',
            options ? JSON.stringify(options) : null, required !== false ? 1 : 0, order_index != null ? order_index : maxOrder.next,
            section || null, image_url || null, has_other ? 1 : 0, conditional ? JSON.stringify(conditional) : null, new Date().toISOString()
        );
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.put('/questions/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { type, title, description, options, required, order_index, section, image_url, has_other, conditional } = req.body;
        db.prepare("UPDATE survey_questions SET type = COALESCE(?, type), title = COALESCE(?, title), description = COALESCE(?, description), options_json = COALESCE(?, options_json), required = COALESCE(?, required), order_index = COALESCE(?, order_index), section = COALESCE(?, section), image_url = COALESCE(?, image_url), has_other = COALESCE(?, has_other), conditional_json = COALESCE(?, conditional_json) WHERE id = ?").run(
            type || null, title || null, description || null, options ? JSON.stringify(options) : null,
            required != null ? (required ? 1 : 0) : null, order_index != null ? order_index : null,
            section || null, image_url || null, has_other != null ? (has_other ? 1 : 0) : null,
            conditional ? JSON.stringify(conditional) : null, req.params.id
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.delete('/questions/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM survey_questions WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.put('/questions/reorder', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { template_id, question_ids } = req.body;
        if (!template_id || !question_ids) return res.status(400).json({ error: 'template_id y question_ids requeridos' });
        question_ids.forEach(function(qId, idx) {
            db.prepare("UPDATE survey_questions SET order_index = ? WHERE id = ? AND template_id = ?").run(idx, qId, template_id);
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── Página pública: datos de la encuesta ──

router.get('/public/:templateId', (req, res) => {
    try {
        var template = db.prepare("SELECT st.*, e.name as event_name FROM survey_templates st LEFT JOIN events e ON e.id = st.event_id WHERE st.id = ?").get(req.params.templateId);
        if (!template) return res.status(404).json({ error: 'Encuesta no encontrada' });
        var questions = getQuestionsWithType(req.params.templateId);
        res.json({ template: template, questions: questions });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── Enviar respuesta ──

router.post('/public/:templateId/response', (req, res) => {
    try {
        var template = db.prepare("SELECT * FROM survey_templates WHERE id = ?").get(req.params.templateId);
        if (!template) return res.status(404).json({ error: 'Encuesta no encontrada' });
        var { guest_id, answers, time_spent } = req.body;
        if (!answers) return res.status(400).json({ error: 'Respuestas requeridas' });
        var id = uuidv4();
        db.prepare("INSERT INTO survey_responses (id, template_id, event_id, guest_id, answers_json, time_spent_seconds, device, ip_address, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
            id, req.params.templateId, template.event_id, guest_id || null, JSON.stringify(answers),
            time_spent || null, req.headers['user-agent'] || null, req.ip || null, new Date().toISOString()
        );
        db.prepare("UPDATE survey_templates SET total_responses = total_responses + 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.templateId);
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── Dashboard / Stats ──

router.get('/templates/:templateId/stats', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var questions = getQuestionsWithType(req.params.templateId);
        var responses = db.prepare("SELECT * FROM survey_responses WHERE template_id = ? ORDER BY submitted_at DESC").all(req.params.templateId);
        var template = db.prepare("SELECT * FROM survey_templates WHERE id = ?").get(req.params.templateId);

        var total = responses.length;
        var completed = responses.filter(function(r) {
            try { var a = JSON.parse(r.answers_json); return Object.keys(a).length > 0; } catch(e) { return false; }
        }).length;

        var today = new Date().toISOString().slice(0, 10);
        var todayCount = responses.filter(function(r) { return (r.submitted_at || '').slice(0, 10) === today; }).length;

        // Tendencia diaria (30 días)
        var dailyTrend = {};
        var past30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        responses.forEach(function(r) {
            if (r.submitted_at >= past30) {
                var day = r.submitted_at.slice(0, 10);
                dailyTrend[day] = (dailyTrend[day] || 0) + 1;
                }
        });
        var trendData = Object.keys(dailyTrend).sort().map(function(d) { return { date: d, count: dailyTrend[d] }; });

        // Heatmap hora/día
        var heatmap = {};
        var dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        for (var h = 0; h < 24; h++) { heatmap[h] = {}; dias.forEach(function(d) { heatmap[h][d] = 0; }); }
        responses.forEach(function(r) {
            if (r.submitted_at) {
                var d = new Date(r.submitted_at);
                var hour = d.getHours();
                var dayIdx = d.getDay();
                if (heatmap[hour]) heatmap[hour][dias[dayIdx]]++;
            }
        });

        // Análisis por pregunta
        var questionStats = questions.map(function(q) {
            var counts = {};
            var totalResp = 0;
            responses.forEach(function(r) {
                try {
                    var answers = JSON.parse(r.answers_json);
                    var val = answers[q.id];
                    if (val != null && val !== '') {
                        var key = String(val);
                        counts[key] = (counts[key] || 0) + 1;
                            totalResp++;
                    }
                } catch(e) {}
            });
            return {
                questionId: q.id,
                title: q.title,
                type: q.type,
                totalAnswers: totalResp,
                distribution: Object.keys(counts).map(function(k) { return { label: k, count: counts[k] }; })
            };
        });

        res.json({
            template: { id: template.id, title: template.title, totalResponses: template.total_responses },
            kpis: { total: total, completed: completed, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0, today: todayCount },
            dailyTrend: trendData,
            heatmap: heatmap,
            questionStats: questionStats
        });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── Export CSV ──

router.get('/templates/:templateId/export/csv', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var questions = getQuestionsWithType(req.params.templateId);
        var responses = db.prepare("SELECT * FROM survey_responses WHERE template_id = ? ORDER BY submitted_at DESC").all(req.params.templateId);
        var headers = ['Fecha', 'Invitado'].concat(questions.map(function(q) { return q.title; }));
        var rows = responses.map(function(r) {
            var answers = {};
            try { answers = JSON.parse(r.answers_json); } catch(e) {}
            var row = [r.submitted_at || '', r.guest_id || ''];
            questions.forEach(function(q) { row.push(answers[q.id] || ''); });
            return row;
        });
        var csv = '\ufeff' + headers.join(',') + '\n' + rows.map(function(r) { return r.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=encuesta_' + req.params.templateId.slice(0, 8) + '.csv');
        res.send(csv);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── Sugerencias + Agenda (legacy, mantener compatibilidad) ──

router.get('/:eventId/suggestions', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const targetDb = getEventDb(eventId);
    const suggestions = targetDb.prepare("SELECT gs.*, g.name as guest_name FROM guest_suggestions gs LEFT JOIN guests g ON gs.guest_id = g.id WHERE gs.event_id = ? ORDER BY gs.submitted_at DESC").all(eventId);
    res.json(suggestions);
});

router.post('/:eventId/suggestions', (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const result = createSuggestionSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`) });
    }
    const { guest_id, suggestion } = result.data;
    const targetDb = getEventDb(eventId);
    const id = getValidId('guest_suggestions');
    targetDb.prepare("INSERT INTO guest_suggestions (id, event_id, guest_id, suggestion, submitted_at) VALUES (?, ?, ?, ?, ?)").run(id, eventId, guest_id || null, suggestion, new Date().toISOString());
    res.json({ success: true });
});

router.get('/:eventId/agenda', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const targetDb = getEventDb(eventId);
    const agenda = targetDb.prepare("SELECT * FROM event_agenda WHERE event_id = ? ORDER BY start_time").all(eventId);
    res.json(agenda);
});

router.put('/:eventId/agenda', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const { items } = req.body;
    const targetDb = getEventDb(eventId);
    if (items && Array.isArray(items)) {
        targetDb.prepare("DELETE FROM event_agenda WHERE event_id = ?").run(eventId);
        const insert = targetDb.prepare("INSERT INTO event_agenda (id, event_id, title, description, start_time, end_time, speaker, location, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            insert.run(getValidId('event_agenda'), eventId, item.title, item.description || '', item.start_time, item.end_time, item.speaker || '', item.location || '', i);
        }
    }
    res.json({ success: true });
});

module.exports = router;
