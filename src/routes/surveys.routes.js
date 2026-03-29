/**
 * Rutas de Encuestas y Respuestas
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getEventConnection, eventDatabaseExists } = require('../../database');
const { getValidId, castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Función helper para obtener la BD correcta según el evento
function getEventDb(eventId) {
    const event = db.prepare("SELECT has_own_db FROM events WHERE id = ?").get(eventId);
    if (event && event.has_own_db === 1 && eventDatabaseExists(eventId)) {
        const eventDb = getEventConnection(eventId);
        if (eventDb) return eventDb;
    }
    return db;
}

// Obtener encuestas de evento (público)
router.get('/:eventId/surveys', (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const targetDb = getEventDb(eventId);
    const questions = targetDb.prepare("SELECT * FROM surveys WHERE event_id = ?").all(eventId);
    res.json(questions);
});

// Actualizar encuestas de evento
router.put('/:eventId/surveys', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const { questions } = req.body;
    const targetDb = getEventDb(eventId);
    
    if (questions && Array.isArray(questions)) {
        targetDb.prepare("DELETE FROM surveys WHERE event_id = ?").run(eventId);
        
        const insert = targetDb.prepare("INSERT INTO surveys (id, event_id, question, type, options) VALUES (?, ?, ?, ?, ?)");
        for (const q of questions) {
            insert.run(getValidId('surveys'), eventId, q.question, q.type || 'stars', q.options || null);
        }
    }
    
    res.json({ success: true });
});

// Enviar respuesta de encuesta
router.post('/:eventId/surveys/responses', (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const { guest_id, responses } = req.body;
    const targetDb = getEventDb(eventId);
    
    const id = getValidId('survey_responses');
    targetDb.prepare("INSERT INTO survey_responses (id, event_id, guest_id, responses_json, submitted_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, eventId, guest_id, JSON.stringify(responses), new Date().toISOString());
    
    res.json({ success: true });
});

// Obtener respuestas de encuesta (admin)
router.get('/:eventId/surveys/responses', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const targetDb = getEventDb(eventId);
    const responses = targetDb.prepare("SELECT * FROM survey_responses WHERE event_id = ?").all(eventId);
    res.json(responses);
});

// Sugerencias
router.get('/:eventId/suggestions', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const targetDb = getEventDb(eventId);
    const suggestions = targetDb.prepare("SELECT gs.*, g.name as guest_name FROM guest_suggestions gs LEFT JOIN guests g ON gs.guest_id = g.id WHERE gs.event_id = ? ORDER BY gs.submitted_at DESC").all(eventId);
    res.json(suggestions);
});

router.post('/:eventId/suggestions', (req, res) => {
    const eventId = castId('events', req.params.eventId);
    const { guest_id, suggestion } = req.body;
    const targetDb = getEventDb(eventId);
    
    const id = getValidId('guest_suggestions');
    targetDb.prepare("INSERT INTO guest_suggestions (id, event_id, guest_id, suggestion, submitted_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, eventId, guest_id || null, suggestion, new Date().toISOString());
    
    res.json({ success: true });
});

// Agenda
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
