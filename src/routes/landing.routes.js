/**
 * Rutas de Landing Page Config (C11-06)
 */
const express = require('express');
const { db, getEventConnection, eventDatabaseExists } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Guardar configuración de landing page
router.put('/:eventId/config', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID inválido' });
        var { blocks, primary_color, show_countdown, show_map, show_schedule, hero_title, hero_subtitle, about_text, cta_text, cta_link, banner_url, logo_url } = req.body;
        var config = { blocks: blocks || [], primary_color: primary_color || '#7c3aed', show_countdown: show_countdown !== false, show_map: show_map !== false, show_schedule: show_schedule !== false, hero_title: hero_title || '', hero_subtitle: hero_subtitle || '', about_text: about_text || '', cta_text: cta_text || 'Registrarse', cta_link: cta_link || '', banner_url: banner_url || '', logo_url: logo_url || '' };
        db.prepare("UPDATE events SET landing_config = ? WHERE id = ?").run(JSON.stringify(config), eId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// Obtener configuración de landing page
router.get('/:eventId/config', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID inválido' });
        var event = db.prepare("SELECT id, landing_config FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        var config = {};
        try { config = JSON.parse(event.landing_config); } catch(e) {}
        res.json(config);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// Obtener landing page pública
router.get('/:eventId/public', (req, res) => {
    try {
        var eId = castId('events', req.params.eventId);
        if (!eId) return res.status(400).json({ error: 'ID inválido' });
        var event = db.prepare("SELECT id, name, date, end_date, location, description, logo_url, banner_url, landing_config, sessions FROM events WHERE id = ?").get(eId);
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
        var config = {};
        try { config = JSON.parse(event.landing_config); } catch(e) {}
        // Merge config with event data
        var landing = {
            eventName: event.name,
            eventDate: event.date,
            eventEndDate: event.end_date,
            eventLocation: event.location,
            eventDescription: event.description,
            logoUrl: config.logo_url || event.logo_url || '',
            bannerUrl: config.banner_url || event.banner_url || '',
            primaryColor: config.primary_color || '#7c3aed',
            showCountdown: config.show_countdown !== false,
            showMap: config.show_map !== false,
            showSchedule: config.show_schedule !== false,
            heroTitle: config.hero_title || event.name || '',
            heroSubtitle: config.hero_subtitle || '',
            aboutText: config.about_text || event.description || '',
            ctaText: config.cta_text || 'Registrarse',
            ctaLink: config.cta_link || '',
            blocks: config.blocks || []
        };
        // Get sessions for schedule
        if (landing.showSchedule) {
            try {
                var targetDb = eventDatabaseExists(eId) ? getEventConnection(eId) : null;
                if (!targetDb) { var Database = require('better-sqlite3'); targetDb = db; }
                var sessions = targetDb.prepare("SELECT title, start_time, end_time, location, description FROM sessions WHERE event_id = ? ORDER BY start_time ASC").all(eId);
                landing.sessions = sessions;
            } catch(e) { landing.sessions = []; }
        }
        res.json(landing);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
