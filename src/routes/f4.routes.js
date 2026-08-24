/**
 * F4 2026-08 — Features diferenciadoras
 *  - Campos personalizados de pre-registro (CRUD + formulario público)
 *  - Sponsors / Expositores + Lead retrieval + ROI básico
 *  - Plus-ones: lectura de acompañantes por invitado
 * Montaje: app.use('/api/events', f4Routes) → rutas relativas a /api/events
 */
const express = require('express');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// ────────────────────────────────────────────────
// CAMPOS PERSONALIZADOS DE REGISTRO
// ────────────────────────────────────────────────

const fieldSchema = z.object({
    label: z.string().min(1).max(200),
    field_type: z.enum(['text', 'textarea', 'select', 'checkbox', 'radio', 'number', 'email', 'phone']).default('text'),
    options: z.array(z.string()).optional(),
    required: z.boolean().optional(),
    show_if_field_id: z.string().nullable().optional(),
    show_if_value: z.string().nullable().optional(),
    sort_order: z.number().int().optional()
});

function safeParse(json, fallback) {
    try { return JSON.parse(json); } catch (_) { return fallback; }
}

router.get('/:eventId/reg-fields', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const rows = db.prepare("SELECT * FROM registration_fields WHERE event_id = ? ORDER BY sort_order ASC").all(req.params.eventId);
        rows.forEach(r => { r.options = safeParse(r.options_json, []); delete r.options_json; });
        res.json(rows);
    } catch (e) { logger.error('[REGFIELDS] list:', e.message); res.status(500).json({ error: 'Error interno' }); }
});

router.post('/:eventId/reg-fields', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const parsed = fieldSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(', ') });
    try {
        const id = uuidv4();
        const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM registration_fields WHERE event_id = ?").get(req.params.eventId);
        db.prepare(`INSERT INTO registration_fields (id, event_id, label, field_type, options_json, required, show_if_field_id, show_if_value, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            id, req.params.eventId, parsed.data.label, parsed.data.field_type,
            parsed.data.options ? JSON.stringify(parsed.data.options) : null,
            parsed.data.required !== false ? 1 : 0,
            parsed.data.show_if_field_id || null,
            parsed.data.show_if_value || null,
            parsed.data.sort_order != null ? parsed.data.sort_order : maxOrder.next
        );
        res.json({ success: true, id });
    } catch (e) { logger.error('[REGFIELDS] create:', e.message); res.status(500).json({ error: 'Error interno' }); }
});

router.put('/:eventId/reg-fields/:fieldId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const b = req.body;
        db.prepare(`UPDATE registration_fields SET label = COALESCE(?, label), field_type = COALESCE(?, field_type),
                    options_json = COALESCE(?, options_json), required = COALESCE(?, required),
                    show_if_field_id = COALESCE(?, show_if_field_id), show_if_value = COALESCE(?, show_if_value)
                    WHERE id = ? AND event_id = ?`).run(
            b.label || null, b.field_type || null,
            b.options ? JSON.stringify(b.options) : null,
            b.required != null ? (b.required ? 1 : 0) : null,
            b.show_if_field_id || null, b.show_if_value || null,
            req.params.fieldId, req.params.eventId
        );
        res.json({ success: true });
    } catch (e) { logger.error('[REGFIELDS] update:', e.message); res.status(500).json({ error: 'Error interno' }); }
});

router.delete('/:eventId/reg-fields/:fieldId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM registration_field_values WHERE field_id = ?").run(req.params.fieldId);
        db.prepare("DELETE FROM registration_fields WHERE id = ? AND event_id = ?").run(req.params.fieldId, req.params.eventId);
        res.json({ success: true });
    } catch (e) { logger.error('[REGFIELDS] delete:', e.message); res.status(500).json({ error: 'Error interno' }); }
});

// Público: campos activos del evento para renderizar el formulario
router.get('/:eventId/public/registration-form', (req, res) => {
    try {
        const fields = db.prepare("SELECT id, label, field_type, options_json, required, show_if_field_id, show_if_value FROM registration_fields WHERE event_id = ? ORDER BY sort_order ASC").all(req.params.eventId);
        fields.forEach(f => {
            f.options = safeParse(f.options_json, []);
            delete f.options_json;
            f.required = !!f.required;
        });
        let quota = 0;
        try {
            const ev = db.prepare("SELECT plus_one_quota FROM events WHERE id = ?").get(req.params.eventId);
            quota = ev?.plus_one_quota || 0;
        } catch (_) {}
        res.json({ fields, plusOneQuota: quota });
    } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

// ────────────────────────────────────────────────
// SPONSORS / EXPOSITORES + LEAD RETRIEVAL
// ────────────────────────────────────────────────

router.get('/:eventId/sponsors', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const sponsors = db.prepare(`SELECT s.*, COUNT(l.id) as lead_count
                                     FROM sponsors s LEFT JOIN sponsor_leads l ON l.sponsor_id = s.id
                                     WHERE s.event_id = ? GROUP BY s.id ORDER BY s.created_at DESC`).all(req.params.eventId);
        res.json(sponsors);
    } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

router.post('/:eventId/sponsors', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'Nombre requerido' });
    try {
        const id = uuidv4();
        db.prepare(`INSERT INTO sponsors (id, event_id, name, tier, booth, contact_email, logo_url) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(id, req.params.eventId, b.name, b.tier || 'standard', b.booth || '', b.contact_email || '', b.logo_url || '');
        res.json({ success: true, id });
    } catch (e) { logger.error('[SPONSORS] create:', e.message); res.status(500).json({ error: 'Error interno' }); }
});

router.delete('/:eventId/sponsors/:sponsorId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM sponsor_leads WHERE sponsor_id = ?").run(req.params.sponsorId);
        db.prepare("DELETE FROM sponsors WHERE id = ? AND event_id = ?").run(req.params.sponsorId, req.params.eventId);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

// Lead retrieval: escanear credencial de invitado en booth del patrocinador
router.post('/:eventId/sponsors/:sponsorId/scan', authMiddleware(['ADMIN', 'PRODUCTOR', 'LOGISTICO', 'ORGANIZER']), (req, res) => {
    try {
        const { guest_id, notes } = req.body || {};
        if (!guest_id) return res.status(400).json({ error: 'guest_id requerido' });
        const sponsor = db.prepare("SELECT id, name FROM sponsors WHERE id = ? AND event_id = ?").get(req.params.sponsorId, req.params.eventId);
        if (!sponsor) return res.status(404).json({ error: 'Patrocinador no encontrado' });

        // Resolver invitado por id o qr_token
        let guest = null;
        try {
            guest = db.prepare("SELECT id, name, email FROM guests WHERE (id = ? OR qr_token = ?) AND event_id = ?").get(guest_id, guest_id, req.params.eventId);
        } catch (_) {}
        if (!guest) {
            // Intentar en BD de evento si existe
            try {
                const { getEventDb } = require('../utils/event-db');
                const eDb = getEventDb(req.params.eventId);
                guest = eDb.prepare("SELECT id, name, email FROM guests WHERE (id = ? OR qr_token = ?)").get(guest_id, guest_id);
            } catch (_) {}
        }
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });

        // Deduplicar scan mismo invitado mismo sponsor
        const dup = db.prepare("SELECT id FROM sponsor_leads WHERE sponsor_id = ? AND guest_id = ?").get(sponsor.id, guest.id);
        if (dup) return res.json({ success: true, duplicate: true, message: 'Lead ya registrado' });

        db.prepare("INSERT INTO sponsor_leads (id, event_id, sponsor_id, guest_id, notes) VALUES (?, ?, ?, ?, ?)")
          .run(uuidv4(), req.params.eventId, sponsor.id, guest.id, notes || '');
        res.json({ success: true, lead: { sponsor: sponsor.name, guest: guest.name, email: guest.email } });
    } catch (e) { logger.error('[SPONSORS] scan:', e.message); res.status(500).json({ error: 'Error interno' }); }
});

router.get('/:eventId/sponsors/:sponsorId/leads', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const leads = db.prepare(`SELECT l.*, g.name as guest_name, g.email as guest_email, g.organization
                                  FROM sponsor_leads l LEFT JOIN guests g ON g.id = l.guest_id
                                  WHERE l.sponsor_id = ? ORDER BY l.scanned_at DESC`).all(req.params.sponsorId);
        res.json(leads);
    } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

// ROI básico: leads por tier para el dashboard del patrocinador
router.get('/:eventId/sponsors-roi/summary', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const rows = db.prepare(`SELECT s.tier, COUNT(l.id) as total_leads
                                 FROM sponsors s LEFT JOIN sponsor_leads l ON l.sponsor_id = s.id
                                 WHERE s.event_id = ? GROUP BY s.tier`).all(req.params.eventId);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
