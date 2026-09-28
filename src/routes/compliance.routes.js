const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, getEventConnection } = require('../../database');
const { authMiddleware } = require('../middleware/auth');

const logger = require("../utils/logger");
const router = express.Router();

// GET /api/compliance/classification — Listar clasificaciones de datos
router.get('/classification', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { table_name } = req.query;
        let sql = "SELECT * FROM data_classification";
        const params = [];
        if (table_name) {
            sql += " WHERE table_name = ?";
            params.push(table_name);
        }
        sql += " ORDER BY table_name, column_name";
        const items = db.prepare(sql).all(...params);
        res.json(items);
    } catch (err) {
        logger.error('[COMPLIANCE] Error:', err.message);
        res.status(500).json({ error: 'Error al obtener clasificaciones' });
    }
});

// POST /api/compliance/classification — Agregar clasificación
router.post('/classification', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { table_name, column_name, classification, category, description, is_pii, is_spi } = req.body;
        if (!table_name || !column_name) return res.status(400).json({ error: 'table_name y column_name requeridos' });
        const existing = db.prepare("SELECT id FROM data_classification WHERE table_name = ? AND column_name = ?").get(table_name, column_name);
        if (existing) return res.status(409).json({ error: 'Ya existe clasificación para esa columna' });
        const id = uuidv4();
        const now = new Date().toISOString();
        db.prepare("INSERT INTO data_classification (id, table_name, column_name, classification, category, description, is_pii, is_spi, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
            id, table_name, column_name, classification || 'internal', category || 'general', description || '',
            is_pii ? 1 : 0, is_spi ? 1 : 0, now
        );
        res.json({ success: true, id });
    } catch (err) {
        logger.error('[COMPLIANCE] Error:', err.message);
        res.status(500).json({ error: 'Error al crear clasificación' });
    }
});

// PUT /api/compliance/classification/:id — Editar clasificación
router.put('/classification/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const { classification, category, description, is_pii, is_spi } = req.body;
        const now = new Date().toISOString();
        db.prepare("UPDATE data_classification SET classification = COALESCE(?, classification), category = COALESCE(?, category), description = COALESCE(?, description), is_pii = COALESCE(?, is_pii), is_spi = COALESCE(?, is_spi), updated_at = ? WHERE id = ?").run(
            classification || null, category || null, description || null,
            is_pii != null ? (is_pii ? 1 : 0) : null, is_spi != null ? (is_spi ? 1 : 0) : null,
            now, req.params.id
        );
        res.json({ success: true });
    } catch (err) {
        logger.error('[COMPLIANCE] Error:', err.message);
        res.status(500).json({ error: 'Error al actualizar clasificación' });
    }
});

// DELETE /api/compliance/classification/:id — Eliminar clasificación
router.delete('/classification/:id', authMiddleware(['ADMIN']), (req, res) => {
    try {
        db.prepare("DELETE FROM data_classification WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        logger.error('[COMPLIANCE] Error:', err.message);
        res.status(500).json({ error: 'Error al eliminar clasificación' });
    }
});

// GET /api/events/:eventId/guests/:guestId/export — Portabilidad de datos (exportar datos del invitado en JSON)
router.get('/events/:eventId/guests/:guestId/export', authMiddleware(['ADMIN', 'PRODUCTOR', 'ORGANIZER']), (req, res) => {
    try {
        const eventDb = getEventConnection(req.params.eventId);
        if (!eventDb) return res.status(404).json({ error: 'Evento no encontrado' });
        const guestId = req.params.guestId;
        const guest = eventDb.prepare("SELECT * FROM guests WHERE id = ?").get(guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });

        let sessions = [];
        try { sessions = eventDb.prepare("SELECT s.name, s.date, s.time FROM session_attendees sa JOIN sessions s ON s.id = sa.session_id WHERE sa.guest_id = ?").all(guestId); } catch(e) {}

        // C-7/L-4b (v12.44.820): portabilidad COMPLETA — los datos personales del titular
        // viven también en campos personalizados, acompañantes y transacciones.
        let customFields = [];
        let plusOnes = [];
        let transactions = [];
        try {
            const sqlCustom = "SELECT field_id, value, created_at FROM registration_field_values WHERE guest_id = ?";
            customFields = eventDb.prepare(sqlCustom).all(guestId).concat(db.prepare(sqlCustom).all(guestId));
        } catch(e) {}
        try {
            plusOnes = db.prepare("SELECT id, name, email, phone, gender, guest_type, checked_in FROM guests WHERE parent_guest_id = ?").all(guestId)
                .concat(eventDb.prepare("SELECT id, name, email, phone, gender, guest_type, checked_in FROM guests WHERE parent_guest_id = ?").all(guestId));
        } catch(e) {}
        try {
            transactions = db.prepare("SELECT amount, currency, provider, status, guest_name, guest_email, created_at, completed_at FROM transactions WHERE guest_id = ?").all(guestId)
                .concat(eventDb.prepare("SELECT amount, currency, provider, status, guest_name, guest_email, created_at, completed_at FROM transactions WHERE guest_id = ?").all(guestId));
        } catch(e) {}
        let photos = [];
        try { photos = eventDb.prepare("SELECT id, filename, caption, created_at FROM event_photos WHERE guest_id = ?").all(guestId); } catch(e) {}

        const exportData = {
            exported_at: new Date().toISOString(),
            guest: guest,
            sessions: sessions,
            custom_fields: customFields,
            plus_ones: plusOnes,
            photos: photos,
            transactions: transactions,
            format: 'Ley 1581 / GDPR-compliant'
        };

        // Log access
        try {
            const user = req.user || {};
            db.prepare("INSERT INTO data_access_log (id, user_id, user_name, table_name, record_id, action, sensitivity, ip_address, details) VALUES (?, ?, ?, ?, ?, 'export', 'confidential', ?, ?)").run(
                uuidv4(), user.id || 'unknown', user.name || 'unknown', 'guests', guestId,
                req.ip || '', JSON.stringify({ eventId: req.params.eventId })
            );
        } catch(e) {}

        res.json(exportData);
    } catch (err) {
        logger.error('[COMPLIANCE] Export error:', err.message);
        res.status(500).json({ error: 'Error al exportar datos' });
    }
});

// DELETE /api/events/:eventId/guests/:guestId/personal-data — Derecho al olvido (anonimizar datos personales)
router.delete('/events/:eventId/guests/:guestId/personal-data', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const eventDb = getEventConnection(req.params.eventId);
        if (!eventDb) return res.status(404).json({ error: 'Evento no encontrado' });
        const guestId = req.params.guestId;
        const guest = eventDb.prepare("SELECT * FROM guests WHERE id = ?").get(guestId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });

        const anonName = 'Anonimizado ' + guestId.substring(0, 8);
        eventDb.prepare("UPDATE guests SET name = ?, email = ?, phone = ?, company = 'Anonimizada', position = '', dietary_restrictions = '', special_needs = '', notes = '[Datos eliminados por solicitud de derecho al olvido]' WHERE id = ?").run(
            anonName, 'anon-' + guestId.substring(0, 8) + '@removed.com', '', guestId
        );

        // C-7/L-4b (v12.44.820): el derecho al olvido alcanza TODAS las tablas con PII del
        // titular, no solo la fila de invitados (hallazgo C-7 del informe legal).
        // - Campos personalizados: contienen lo que el organizador preguntó (puede ser PII).
        try {
            eventDb.prepare("DELETE FROM registration_field_values WHERE guest_id = ?").run(guestId);
            db.prepare("DELETE FROM registration_field_values WHERE guest_id = ?").run(guestId);
        } catch(e) {}
        // - Acompañantes (plus-ones = filas hijas en guests): se anonimizan en cascada.
        try {
            const childAnon = (cdb) => {
                const kids = cdb.prepare("SELECT id FROM guests WHERE parent_guest_id = ?").all(guestId);
                for (const kid of kids) {
                    cdb.prepare("UPDATE guests SET name = ?, email = ?, phone = '', notes = '[Datos eliminados por solicitud de derecho al olvido]' WHERE id = ?")
                      .run('Anonimizado ' + kid.id.substring(0, 8), 'anon-' + kid.id.substring(0, 8) + '@removed.com', kid.id);
                }
            };
            childAnon(eventDb); childAnon(db);
        } catch(e) {}
        // - Fotos del álbum: la referencia al titular se rompe (los archivos quedan huérfanos).
        try { eventDb.prepare("UPDATE event_photos SET guest_id = NULL, caption = '' WHERE guest_id = ?").run(guestId); } catch(e) {}
        // - Transacciones: el registro CONTABLE se conserva (obligación fiscal DIAN) pero los
        //  campos de persona se anonimizan. Excepción documentada en la política de retención.
        try {
            const txnAnon = (tdb) => tdb.prepare("UPDATE transactions SET guest_name = ?, guest_email = ?, guest_id = NULL WHERE guest_id = ?")
                .run('Titular anonimizado (' + guestId.substring(0, 8) + ')', 'anon-' + guestId.substring(0, 8) + '@removed.com', guestId);
            txnAnon(eventDb); txnAnon(db);
        } catch(e) {}

        // Log access
        try {
            const user = req.user || {};
            db.prepare("INSERT INTO data_access_log (id, user_id, user_name, table_name, record_id, action, sensitivity, ip_address, details) VALUES (?, ?, ?, ?, ?, 'erasure', 'confidential', ?, ?)").run(
                uuidv4(), user.id || 'unknown', user.name || 'unknown', 'guests', guestId,
                req.ip || '', JSON.stringify({ eventId: req.params.eventId, anonimized: true })
            );
        } catch(e) {}

        res.json({ success: true, message: 'Datos personales eliminados exitosamente' });
    } catch (err) {
        logger.error('[COMPLIANCE] Erasure error:', err.message);
        res.status(500).json({ error: 'Error al eliminar datos personales' });
    }
});

// GET /api/compliance/access-logs — Listar logs de acceso a datos
router.get('/access-logs', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = (page - 1) * limit;
        const action = req.query.action || '';

        let where = '';
        const params = [];
        if (action) {
            where = " WHERE action = ?";
            params.push(action);
        }
        const total = db.prepare("SELECT COUNT(*) as cnt FROM data_access_log" + where).get(...params).cnt;
        const rows = db.prepare("SELECT * FROM data_access_log" + where + " ORDER BY created_at DESC LIMIT ? OFFSET ?").all(...params, limit, offset);
        res.json({ data: rows, pagination: { page, limit, total } });
    } catch (err) {
        logger.error('[COMPLIANCE] Access logs error:', err.message);
        res.status(500).json({ error: 'Error al obtener logs de acceso' });
    }
});

// ─── CONSENT TRACKING (GDPR) ───

// Ensure consent_logs table exists
try {
    db.exec(`CREATE TABLE IF NOT EXISTS consent_logs (
        id TEXT PRIMARY KEY,
        guest_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        consent_type TEXT NOT NULL,
        consent_given INTEGER NOT NULL DEFAULT 0,
        consent_text TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_consent_guest ON consent_logs(guest_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_consent_event ON consent_logs(event_id)`);
    // C-4 (v12.44.820): alergias/restricciones alimentarias = dato SENSIBLE (salud, Ley 1581
    // art. 6). Clasificación sembrada una sola vez para el expediente de compliance.
    // OR IGNORE: la tabla es UNIQUE(table_name, column_name) y varios workers pueden
    // correr el ensure a la vez sobre la misma BD (corridas de tests en paralelo).
    try {
        db.prepare("INSERT OR IGNORE INTO data_classification (id, table_name, column_name, classification, category, description, is_pii, is_spi, created_at) VALUES (?, 'guests', 'dietary_notes', 'restricted', 'health', 'Alergias/restricciones alimentarias: revelan condiciones de salud (dato sensible, Ley 1581 art. 6). Consentimiento diferenciado sensitive_data en el registro público.', 1, 1, ?)")
          .run(uuidv4(), new Date().toISOString());
    } catch (_) {}
} catch(e) {}

// POST /api/compliance/consent — Record consent
// L-1A (v12.44.818): ya no es público. La escritura de consentimientos ocurre
// server-side en los flujos (public-register, signup); este endpoint queda para
// uso administrativo y exige sesión (evita consentimientos forjados).
router.post('/consent', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const { guest_id, event_id, consent_type, consent_given, consent_text } = req.body;
        if (!guest_id || !event_id || !consent_type) {
            return res.status(400).json({ error: 'guest_id, event_id, consent_type requeridos' });
        }
        const id = uuidv4();
        db.prepare(`INSERT INTO consent_logs (id, guest_id, event_id, consent_type, consent_given, consent_text, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
            id, guest_id, event_id, consent_type, consent_given ? 1 : 0,
            consent_text || null, req.ip, req.get('User-Agent') || null
        );
        res.json({ success: true, id });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/compliance/consent/:eventId — Get consent status for event
router.get('/consent/:eventId', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const logs = db.prepare(`
            SELECT cl.*, g.name as guest_name, g.email as guest_email
            FROM consent_logs cl
            LEFT JOIN guests g ON g.id = cl.guest_id
            WHERE cl.event_id = ?
            ORDER BY cl.created_at DESC
        `).all(req.params.eventId);
        res.json(logs);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/compliance/consent/:eventId/stats — Consent stats
router.get('/consent/:eventId/stats', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const stats = db.prepare(`
            SELECT consent_type, 
                COUNT(*) as total,
                SUM(consent_given) as given,
                COUNT(*) - SUM(consent_given) as denied
            FROM consent_logs
            WHERE event_id = ?
            GROUP BY consent_type
        `).all(req.params.eventId);
        res.json(stats);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/compliance/consent/:eventId/export — Export de consentimientos (CSV)
// L-1A.4 (v12.44.818): evidencia de autorización para el expediente del organizador
// (Responsable) y del operador (Encargado) ante la SIC.
router.get('/consent/:eventId/export', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        const csvEscape = (v) => {
            const s = v == null ? '' : String(v);
            return '"' + s.replace(/"/g, '""') + '"';
        };
        const rows = db.prepare(`
            SELECT cl.created_at, cl.consent_type, cl.consent_given, cl.consent_text,
                   cl.ip_address, g.name as guest_name, g.email as guest_email
            FROM consent_logs cl
            LEFT JOIN guests g ON g.id = cl.guest_id
            WHERE cl.event_id = ?
            ORDER BY cl.created_at DESC
        `).all(req.params.eventId);
        const header = 'fecha,tipo,aceptado,nombre,email,ip,consentimiento(texto+hash)';
        const lines = rows.map(r => [
            r.created_at, r.consent_type, r.consent_given ? 'SI' : 'NO',
            r.guest_name || '', r.guest_email || '', r.ip_address || '', r.consent_text || ''
        ].map(csvEscape).join(','));
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="consentimientos-' + req.params.eventId + '.csv"');
        res.send('\uFEFF' + header + '\n' + lines.join('\n'));
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/compliance/retention — Data retention policy check
// C-9/L-4b (v12.44.820): política POR TABLA. La prueba del consentimiento (Ley 1581
// arts. 8-9) debe durar la vida de la base: consent_logs ya NO se borra con la limpieza
// automática. Auditoría se retiene más (24 meses) para investigación de incidentes.
const RETENTION_POLICY = {
    audit_logs: { days: 730, cleanable: true,  reason: 'Trazabilidad de seguridad (12-24 meses)' },
    consent_logs: { days: null, cleanable: false, reason: 'Prueba del consentimiento: vida de la base + 2 años (NO se limpia)' },
    guests: { days: null, cleanable: false, reason: 'Se gestiona por derecho al olvido (ARCO), no por antigüedad' },
    transactions: { days: 1825, cleanable: false, reason: 'Obligación fiscal DIAN (~5 años): no se borra desde aquí' }
};

router.get('/retention', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const retentionDays = parseInt(req.query.days) || 365;
        const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
        const oldLogs = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE created_at < ?").get(cutoff).c;
        const oldConsents = db.prepare("SELECT COUNT(*) as c FROM consent_logs WHERE created_at < ?").get(cutoff).c;
        res.json({
            retention_days: retentionDays,
            cutoff_date: cutoff,
            policy_by_table: RETENTION_POLICY,
            old_data: {
                audit_logs: oldLogs,
                consent_logs: oldConsents
            }
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/compliance/retention/clean — Clean old data
// C-9/L-4b (v12.44.820): solo limpia audit_logs con su propia ventana (audit_days, default
// 730). consent_logs queda PROTEGIDO: es la evidencia de la autorización y su borrado masivo
// dejaría al responsable sin defensa ante la SIC. Compat: un body {days} viejo sigue siendo
// aceptado pero aplica solo a auditoría.
router.delete('/retention/clean', authMiddleware(['ADMIN']), (req, res) => {
    try {
        const auditDays = parseInt(req.body.audit_days) || parseInt(req.body.days) || RETENTION_POLICY.audit_logs.days;
        const cutoff = new Date(Date.now() - auditDays * 86400000).toISOString();
        const deletedLogs = db.prepare("DELETE FROM audit_logs WHERE created_at < ?").run(cutoff).changes;
        res.json({
            success: true,
            deleted: { audit_logs: deletedLogs, consent_logs: 0 },
            policy: { audit_logs: { days: auditDays }, consent_logs: 'protegido (conservado por deber legal)' }
        });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
