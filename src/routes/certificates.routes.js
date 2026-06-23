/**
 * Rutas de Certificados Automáticos (C11-08)
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
const { castId } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { getEventDb } = require('../utils/event-db');

const router = express.Router();

// ─── CRUD Templates ───

router.get('/:eventId/templates', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var templates = db.prepare("SELECT * FROM certificate_templates WHERE event_id = ? ORDER BY created_at DESC").all(req.params.eventId);
        res.json(templates.map(function(t) {
            if (t.config) { try { t.config = JSON.parse(t.config); } catch(e) { t.config = {}; } }
            return t;
        }));
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.post('/:eventId/templates', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { name, config } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
        var id = uuidv4();
        var now = new Date().toISOString();
        db.prepare("INSERT INTO certificate_templates (id, event_id, name, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
            id, req.params.eventId, name.trim(), config ? JSON.stringify(config) : null, now, now
        );
        res.json({ success: true, id: id });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.put('/:eventId/templates/:templateId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var { name, config } = req.body;
        db.prepare("UPDATE certificate_templates SET name = COALESCE(?, name), config = COALESCE(?, config), updated_at = ? WHERE id = ? AND event_id = ?").run(
            name || null, config ? JSON.stringify(config) : null, new Date().toISOString(), req.params.templateId, req.params.eventId
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

router.delete('/:eventId/templates/:templateId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        db.prepare("DELETE FROM guest_certificates WHERE template_id = ?").run(req.params.templateId);
        db.prepare("DELETE FROM certificate_templates WHERE id = ? AND event_id = ?").run(req.params.templateId, req.params.eventId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Generar certificados para un template ───

router.post('/:eventId/templates/:templateId/generate', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        var template = db.prepare("SELECT * FROM certificate_templates WHERE id = ? AND event_id = ?").get(req.params.templateId, req.params.eventId);
        if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });
        var cfg = {};
        try { cfg = JSON.parse(template.config); } catch(e) {}
        var targetDb = getEventDb(req.params.eventId);
        var guests = targetDb.prepare("SELECT id, name, email, organization, checked_in FROM guests WHERE event_id = ? AND checked_in = 1 ORDER BY name ASC").all(req.params.eventId);
        if (guests.length === 0) return res.status(400).json({ error: 'No hay invitados con check-in' });
        var count = 0;
        var insertCert = db.prepare("INSERT OR IGNORE INTO guest_certificates (id, template_id, event_id, guest_id) VALUES (?, ?, ?, ?)");
        var insertMany = db.transaction(function(guests) {
            guests.forEach(function(g) {
                var certId = uuidv4();
                insertCert.run(certId, req.params.templateId, req.params.eventId, g.id);
                count++;
            });
        });
        insertMany(guests);
        res.json({ success: true, generated: count, total: guests.length });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Listar certificados generados ───

router.get('/:eventId/templates/:templateId/certificates', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        var certs = db.prepare(`
            SELECT gc.*, g.name as guest_name, g.email as guest_email
            FROM guest_certificates gc
            LEFT JOIN guests g ON g.id = gc.guest_id
            WHERE gc.template_id = ? AND gc.event_id = ?
            ORDER BY g.name ASC
        `).all(req.params.templateId, req.params.eventId);
        res.json(certs);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Descargar PDF de un certificado ───

router.get('/download/:certId', (req, res) => {
    try {
        var cert = db.prepare(`
            SELECT gc.*, g.name as guest_name, g.email as guest_email, g.qr_token,
                   t.name as template_name, t.config, t.event_id,
                   e.name as event_name, e.date as event_date,
                   tm.name as template_config
            FROM guest_certificates gc
            JOIN guests g ON g.id = gc.guest_id
            JOIN certificate_templates t ON t.id = gc.template_id
            JOIN events e ON e.id = gc.event_id
            WHERE gc.id = ?
        `).get(req.params.certId);
        if (!cert) return res.status(404).json({ error: 'Certificado no encontrado' });

        // Actualizar contador de descargas
        db.prepare("UPDATE guest_certificates SET download_count = download_count + 1 WHERE id = ?").run(req.params.certId);

        var cfg = {};
        try { cfg = JSON.parse(cert.config); } catch(e) {}
        var themeColor = cfg.primaryColor || '#7c3aed';

        const { jsPDF } = require('jspdf');
        var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        // Fondo
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 297, 210, 'F');

        // Borde decorativo
        doc.setDrawColor(themeColor);
        doc.setLineWidth(2);
        doc.rect(10, 10, 277, 190);
        doc.setLineWidth(0.5);
        doc.rect(12, 12, 273, 186);

        // Título
        doc.setFontSize(36);
        doc.setTextColor(255, 255, 255);
        doc.text('CERTIFICADO', 148.5, 50, { align: 'center' });

        // Línea decorativa
        doc.setDrawColor(themeColor);
        doc.setLineWidth(0.5);
        doc.line(70, 58, 227, 58);

        // Otorgado a
        doc.setFontSize(14);
        doc.setTextColor(180, 180, 180);
        doc.text('Otorgado a', 148.5, 75, { align: 'center' });

        // Nombre del invitado
        doc.setFontSize(32);
        doc.setTextColor(255, 255, 255);
        doc.text(cert.guest_name || '', 148.5, 98, { align: 'center' });

        // Evento
        doc.setFontSize(16);
        doc.setTextColor(200, 200, 200);
        doc.text('Por su asistencia a ' + (cert.event_name || ''), 148.5, 120, { align: 'center' });

        // Fecha
        doc.setFontSize(12);
        doc.setTextColor(150, 150, 150);
        var dateStr = cert.event_date ? new Date(cert.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
        doc.text(dateStr, 148.5, 135, { align: 'center' });

        // QR de verificación
        if (cert.qr_token) {
            try {
                var QRCode = require('qrcode');
                var verifyUrl = (req.headers['x-forwarded-proto'] || 'http') + '://' + req.get('host') + '/api/certificates/verify/' + req.params.certId;
                QRCode.toDataURL(verifyUrl, { width: 120, margin: 1, color: { dark: themeColor, light: '#0f172a' } }).then(function(qrDataUrl) {
                    doc.addImage(qrDataUrl, 'PNG', 148.5 - 18, 145, 36, 36);
                    doc.setFontSize(7);
                    doc.setTextColor(120, 120, 120);
                    doc.text('Escanea para verificar', 148.5, 188, { align: 'center' });
                    sendPdf(doc, res, cert);
                }).catch(function() { sendPdf(doc, res, cert); });
            } catch(e) { sendPdf(doc, res, cert); }
        } else {
            sendPdf(doc, res, cert);
        }
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

function sendPdf(doc, res, cert) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Certificado_' + (cert.guest_name || '').replace(/\s+/g, '_') + '.pdf');
    res.send(Buffer.from(doc.output('arraybuffer')));
}

// ─── Verificar certificado (público) ───

router.get('/verify/:certId', (req, res) => {
    try {
        var cert = db.prepare(`
            SELECT gc.id, gc.generated_at, g.name as guest_name, e.name as event_name
            FROM guest_certificates gc
            JOIN guests g ON g.id = gc.guest_id
            JOIN events e ON e.id = gc.event_id
            WHERE gc.id = ?
        `).get(req.params.certId);
        if (!cert) return res.status(404).json({ valid: false, error: 'Certificado no encontrado' });
        res.json({ valid: true, guest: cert.guest_name, event: cert.event_name, generatedAt: cert.generated_at });
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ─── Certificados de un guest (portal) ───

router.get('/guest/:guestId', (req, res) => {
    try {
        var certs = db.prepare(`
            SELECT gc.id, t.name as template_name, e.name as event_name, gc.generated_at
            FROM guest_certificates gc
            JOIN certificate_templates t ON t.id = gc.template_id
            JOIN events e ON e.id = gc.event_id
            WHERE gc.guest_id = ?
            ORDER BY gc.generated_at DESC
        `).all(req.params.guestId);
        res.json(certs);
    } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
