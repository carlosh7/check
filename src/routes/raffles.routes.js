/**
 * Rutas de Sorteos (Ruleta, Grupos, Lista)
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getEventConnection, eventDatabaseExists } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const { logAction, AUDIT_ACTIONS } = require('../security/audit');
const QRCode = require('qrcode');

const router = express.Router();

function getEventGuestDb(eventId) {
    const event = db.prepare("SELECT has_own_db FROM events WHERE id = ?").get(eventId);
    if (event && event.has_own_db === 1 && eventDatabaseExists(eventId)) {
        const eventDb = getEventConnection(eventId);
        if (eventDb) return eventDb;
    }
    return db;
}

// ── CRUD Raffles ──

router.get('/events/:eventId/raffles', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var raffles = db.prepare("SELECT * FROM raffles WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId);
        res.json(raffles);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/events/:eventId/raffles', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { type, name, winner_count, data_source, source_template_id, config } = req.body;
        if (!name) return res.status(400).json({ error: 'Nombre requerido' });
        var id = uuidv4();
        db.prepare("INSERT INTO raffles (id, event_id, type, name, config_json, data_source, source_template_id, winner_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)").run(
            id, req.params.eventId, type || 'wheel', name, config ? JSON.stringify(config) : null,
            data_source || 'guests', source_template_id || null, parseInt(winner_count) || 1,
            new Date().toISOString(), new Date().toISOString()
        );
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var raffle = db.prepare("SELECT * FROM raffles WHERE id = ?").get(req.params.id);
        if (!raffle) return res.status(404).json({ error: 'Sorteo no encontrado' });
        if (raffle.config_json) try { raffle.config = JSON.parse(raffle.config_json); } catch(e) {}
        res.json(raffle);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { type, name, winner_count, data_source, source_template_id, config, status } = req.body;
        db.prepare("UPDATE raffles SET type = COALESCE(?, type), name = COALESCE(?, name), winner_count = COALESCE(?, winner_count), data_source = COALESCE(?, data_source), source_template_id = COALESCE(?, source_template_id), config_json = COALESCE(?, config_json), status = COALESCE(?, status), updated_at = ? WHERE id = ?").run(
            type || null, name || null, winner_count != null ? parseInt(winner_count) : null, data_source || null,
            source_template_id || null, config ? JSON.stringify(config) : null, status || null,
            new Date().toISOString(), req.params.id
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM raffle_results WHERE raffle_id = ?").run(req.params.id);
        db.prepare("DELETE FROM raffle_participants WHERE raffle_id = ?").run(req.params.id);
        db.prepare("DELETE FROM raffles WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Poblar participantes desde fuente ──

router.post('/:id/populate', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var raffle = db.prepare("SELECT * FROM raffles WHERE id = ?").get(req.params.id);
        if (!raffle) return res.status(404).json({ error: 'Sorteo no encontrado' });

        var eventDb = getEventGuestDb(raffle.event_id);
        var sourceSql = '';
        if (raffle.data_source === 'guests') {
            sourceSql = "SELECT id as guest_id, name, email, phone FROM guests WHERE event_id = ?";
        } else if (raffle.data_source === 'checked_in') {
            sourceSql = "SELECT id as guest_id, name, email, phone FROM guests WHERE event_id = ? AND checked_in = 1";
        } else if (raffle.data_source === 'pre_registered') {
            sourceSql = "SELECT id as guest_id, name, email, phone FROM pre_registrations WHERE event_id = ?";
        } else if (raffle.data_source === 'survey' && raffle.source_template_id) {
            var sTemplate = db.prepare("SELECT * FROM survey_templates WHERE id = ?").get(raffle.source_template_id);
            if (!sTemplate) return res.status(400).json({ error: 'Template de encuesta no encontrado' });
            var respondents = db.prepare("SELECT guest_id, answers_json FROM survey_responses WHERE template_id = ? AND guest_id IS NOT NULL").all(raffle.source_template_id);
            var guestIds = respondents.map(function(r) { return r.guest_id; }).filter(Boolean);
            if (guestIds.length === 0) return res.json({ added: 0, message: 'No hay invitados que respondieron la encuesta' });
            var placeholders = guestIds.map(function() { return '?'; }).join(',');
            var guests = db.prepare("SELECT id as guest_id, name, email, phone FROM guests WHERE event_id = ? AND id IN (" + placeholders + ")").all.apply(null, [raffle.event_id].concat(guestIds));
            sourceSql = null;
            var insert = db.prepare("INSERT OR IGNORE INTO raffle_participants (id, raffle_id, guest_id, name, email, phone, source) VALUES (?, ?, ?, ?, ?, ?, ?)");
            var count = 0;
            guests.forEach(function(g) {
                try { insert.run(uuidv4(), raffle.id, g.guest_id, g.name, g.email, g.phone, 'survey'); count++; } catch(e) {}
            });
            db.prepare("UPDATE raffles SET total_participants = ?, updated_at = ? WHERE id = ?").run(count, new Date().toISOString(), raffle.id);
            return res.json({ added: count });
        }

        if (sourceSql) {
            var guests = eventDb.prepare(sourceSql).all(raffle.event_id);
            db.prepare("DELETE FROM raffle_participants WHERE raffle_id = ?").run(raffle.id);
            var insert = db.prepare("INSERT INTO raffle_participants (id, raffle_id, guest_id, name, email, phone, source) VALUES (?, ?, ?, ?, ?, ?, ?)");
            var count = 0;
            guests.forEach(function(g) {
                try { insert.run(uuidv4(), raffle.id, g.guest_id, g.name || '', g.email || '', g.phone || '', raffle.data_source); count++; } catch(e) {}
            });
            db.prepare("UPDATE raffles SET total_participants = ?, updated_at = ? WHERE id = ?").run(count, new Date().toISOString(), raffle.id);
            res.json({ added: count });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Sortear (draw) ──

router.post('/:id/draw', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var raffle = db.prepare("SELECT * FROM raffles WHERE id = ?").get(req.params.id);
        if (!raffle) return res.status(404).json({ error: 'Sorteo no encontrado' });

        var participants = db.prepare("SELECT * FROM raffle_participants WHERE raffle_id = ?").all(raffle.id);
        if (participants.length === 0) return res.status(400).json({ error: 'No hay participantes. Pobla la lista primero.' });

        var winnerCount = raffle.winner_count || 1;
        var shuffled = participants.slice().sort(function() { return Math.random() - 0.5; });
        var winners = shuffled.slice(0, Math.min(winnerCount, shuffled.length));

        var winnersData = winners.map(function(w) { return { id: w.id, name: w.name, email: w.email, phone: w.phone }; });

        var round = 1;
        var lastRound = db.prepare("SELECT COALESCE(MAX(round), 0) as r FROM raffle_results WHERE raffle_id = ?").get(raffle.id);
        if (lastRound) round = lastRound.r + 1;

        var resultId = uuidv4();
        db.prepare("INSERT INTO raffle_results (id, raffle_id, round, winners_json, total_participants) VALUES (?, ?, ?, ?, ?)").run(resultId, raffle.id, round, JSON.stringify(winnersData), participants.length);

        try { logAction(req, 'RAFFLE_DRAW', { raffleId: raffle.id, name: raffle.name, type: raffle.type, winners: winnersData.length }); } catch(e) {}

        res.json({ success: true, round: round, winners: winnersData, totalParticipants: participants.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Participantes ──

router.get('/:id/participants', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var participants = db.prepare("SELECT * FROM raffle_participants WHERE raffle_id = ? ORDER BY name ASC").all(req.params.id);
        res.json(participants);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/participants', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { name, email, phone, guest_id } = req.body;
        var id = uuidv4();
        db.prepare("INSERT INTO raffle_participants (id, raffle_id, guest_id, name, email, phone, source) VALUES (?, ?, ?, ?, ?, ?, 'manual')").run(id, req.params.id, guest_id || null, name, email || '', phone || '');
        var count = db.prepare("SELECT COUNT(*) as c FROM raffle_participants WHERE raffle_id = ?").get(req.params.id).c;
        db.prepare("UPDATE raffles SET total_participants = ? WHERE id = ?").run(count, req.params.id);
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/participants/:participantId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM raffle_participants WHERE id = ? AND raffle_id = ?").run(req.params.participantId, req.params.id);
        var count = db.prepare("SELECT COUNT(*) as c FROM raffle_participants WHERE raffle_id = ?").get(req.params.id).c;
        db.prepare("UPDATE raffles SET total_participants = ? WHERE id = ?").run(count, req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Resultados ──

router.get('/:id/results', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var results = db.prepare("SELECT * FROM raffle_results WHERE raffle_id = ? ORDER BY round DESC").all(req.params.id);
        results.forEach(function(r) {
            try { r.winners = JSON.parse(r.winners_json); } catch(e) { r.winners = []; }
        });
        res.json(results);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/results/:resultId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM raffle_results WHERE id = ? AND raffle_id = ?").run(req.params.resultId, req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/results', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM raffle_results WHERE raffle_id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Reporte PDF ──

router.get('/:id/report', authMiddleware(['ADMIN', 'PRODUCTOR']), async (req, res) => {
    try {
        var raffle = db.prepare("SELECT * FROM raffles WHERE id = ?").get(req.params.id);
        if (!raffle) return res.status(404).json({ error: 'Sorteo no encontrado' });
        var event = db.prepare("SELECT * FROM events WHERE id = ?").get(raffle.event_id);
        var participants = db.prepare("SELECT * FROM raffle_participants WHERE raffle_id = ? ORDER BY name ASC").all(req.params.id);
        var results = db.prepare("SELECT * FROM raffle_results WHERE raffle_id = ? ORDER BY round DESC").all(req.params.id);
        results.forEach(function(r) { try { r.winners = JSON.parse(r.winners_json); } catch(e) { r.winners = []; } });

        var { jsPDF } = require('jspdf');
        var autoTable = require('jspdf-autotable').default;
        var doc = new jsPDF();

        doc.setFontSize(22); doc.setTextColor(124, 58, 237);
        doc.text('Reporte de Sorteo', 14, 30);
        doc.setFontSize(14); doc.setTextColor(60);
        doc.text(raffle.name, 14, 40);
        doc.setFontSize(10); doc.setTextColor(100);
        doc.text('Evento: ' + (event ? event.name : 'N/A'), 14, 48);
        doc.text('Tipo: ' + raffle.type + ' | Fuente: ' + raffle.data_source, 14, 55);
        doc.text('Generado: ' + new Date().toLocaleString(), 14, 62);

        doc.setFontSize(16); doc.setTextColor(0);
        doc.text('Participantes (' + participants.length + ')', 14, 75);
        autoTable(doc, {
            startY: 80, head: [['Nombre', 'Email', 'Teléfono']],
            body: participants.map(function(p) { return [p.name || '-', p.email || '-', p.phone || '-']; }),
            theme: 'striped', headStyles: { fillColor: [124, 58, 237] }, styles: { fontSize: 8 }
        });

        if (results.length > 0) {
            var y = (doc.lastAutoTable.finalY || 80) + 15;
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFontSize(16); doc.setTextColor(0);
            doc.text('Resultados', 14, y);
            results.forEach(function(r) {
                y += 10;
                doc.setFontSize(11); doc.setTextColor(124, 58, 237);
                doc.text('Ronda ' + r.round + ' (' + r.total_participants + ' participantes)', 14, y);
                y += 5;
                (r.winners || []).forEach(function(w, i) {
                    doc.setFontSize(10); doc.setTextColor(0);
                    doc.text((i + 1) + '. ' + (w.name || '-') + ' — ' + (w.email || '-'), 20, y + 5);
                    y += 6;
                });
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=' + raffle.name.replace(/\s+/g, '_') + '_reporte.pdf');
        res.send(Buffer.from(doc.output('arraybuffer')));
    } catch (err) {
        console.error('[RAFFLE] Report error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
