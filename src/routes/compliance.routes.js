const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');
// v12.44.842 (auditoría Invitados #2): getEventConnection devuelve null cuando el evento
// no tiene BD propia → portabilidad y derecho al olvido daban 404 SIEMPRE en el caso
// por defecto. getEventDb cae a la BD principal, como el resto de rutas.
const { getEventDb } = require('../utils/event-db');
const { hasEventAccess } = require('../utils/helpers');
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
        // v12.44.842 (seguridad): el evento debe ser del usuario (antes cualquier
        // PRODUCTOR/ORGANIZER podía pedir datos de invitados de eventos ajenos)
        if (!hasEventAccess(req.userId, req.params.eventId, req.userRole)) return res.status(403).json({ error: 'No tienes acceso a este evento' });
        const eventDb = getEventDb(req.params.eventId);
        if (!eventDb) return res.status(404).json({ error: 'Evento no encontrado' });
        const guestId = req.params.guestId;
        const guest = eventDb.prepare("SELECT * FROM guests WHERE id = ? AND event_id = ?").get(guestId, req.params.eventId);
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

// ─── H2 (v12.44.846, auditoría 2026-11-25): anonimización con las columnas REALES de guests ───
// guests NO tiene columnas company / dietary_restrictions / special_needs / notes (comprobado con
// PRAGMA table_info en la BD maestra y en las BD de evento) y además el esquema cambia entre
// bases: la maestra tiene otp_code, bio, interests, social_linkedin, photo_url, unsubscribed y
// unsubscribe_token; la de evento no. Por eso el SET se calcula contra el esquema de CADA
// conexión: solo se escriben columnas que existan (nunca más un 500 por "no such column").
const ERASURE_NOTE = '[Datos eliminados por solicitud de derecho al olvido]';

// Columnas PERSONALES de guests (las que existen hoy en algún esquema) y con qué se sustituyen:
//   anon_name / anon_email → generados por invitado (la fila sigue siendo referenciable)
//   blank   → ''       null → NULL (qr_token es UNIQUE: dos '' chocarían, dos NULL no)
//   default → el DEFAULT de la columna (dato sensible devuelto a "sin dato")
// Mapeo del hallazgo: company → organization; dietary_restrictions → dietary_notes (+ restricciones
// y vegano, mismo dato alimentario sensible); special_needs no tiene equivalente en guests; las
// notas sobre el invitado viven en guest_status_log.notes.
const GUEST_PERSONAL_COLUMNS = {
    name: 'anon_name',
    email: 'anon_email',
    phone: 'blank',
    organization: 'blank',
    position: 'blank',
    cargo: 'blank',
    dietary_notes: 'blank',
    restricciones: 'blank',
    vegano: 'default',
    gender: 'default',
    qr_token: 'null',
    otp_code: 'null',
    unsubscribe_token: 'null',
    bio: 'blank',
    interests: 'blank',
    social_linkedin: 'blank',
    photo_url: 'blank'
};

// Las que NO identifican a la persona (estado operativo y trazabilidad del evento) se conservan.
const GUEST_OPERATIONAL_COLUMNS = new Set([
    'id', 'event_id', 'status', 'category_id', 'waitlist_position', 'promoted_at', 'waitlisted_at',
    'is_new_registration', 'checked_in', 'checkin_time', 'validated', 'validated_at', 'validated_by',
    'created_at', 'parent_guest_id', 'guest_type', 'unsubscribed'
]);

function quoteIdent(name) { return '"' + String(name).replace(/"/g, '""') + '"'; }

function isTextColumn(type) {
    const t = String(type || '').toUpperCase();
    return t === '' || t.includes('TEXT') || t.includes('CHAR') || t.includes('CLOB') || t.includes('BLOB');
}

// `table` solo llega desde constantes de este archivo; el filtro evita interpolar cualquier otra cosa.
function tableColumns(conn, table) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) return [];
    try { return conn.prepare('PRAGMA table_info(' + table + ')').all(); } catch (_) { return []; }
}

function tableHasColumn(conn, table, column) {
    return tableColumns(conn, table).some(c => c.name === column);
}

// Columnas personales según el esquema REAL de esta conexión, y las que el catálogo no sabe
// clasificar (no se tocan: se avisan por log y en la respuesta). ERASURE_EXTRA_GUEST_COLUMNS
// (CSV de nombres de columna, default vacío) permite declarar personales las de esquemas extendidos.
function guestPersonalColumns(conn) {
    const extra = String(process.env.ERASURE_EXTRA_GUEST_COLUMNS || '').split(',')
        .map(s => s.trim()).filter(s => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s));
    const personal = [];
    const unknown = [];
    for (const c of tableColumns(conn, 'guests')) {
        const strategy = GUEST_PERSONAL_COLUMNS[c.name] || (extra.includes(c.name) ? 'blank' : null);
        if (strategy) {
            personal.push({ name: c.name, strategy, text: isTextColumn(c.type), notnull: !!c.notnull, dflt: c.dflt_value });
        } else if (!GUEST_OPERATIONAL_COLUMNS.has(c.name)) {
            unknown.push(c.name);
        }
    }
    return { personal, unknown };
}

// Asignaciones de anonimización para UNA fila de guests.
function guestErasureSets(personal, guestId) {
    const short = String(guestId).substring(0, 8);
    const sets = [];
    const values = [];
    for (const c of personal) {
        const col = quoteIdent(c.name);
        if (c.strategy === 'anon_name') { sets.push(col + ' = ?'); values.push('Anonimizado ' + short); continue; }
        if (c.strategy === 'anon_email') { sets.push(col + ' = ?'); values.push('anon-' + short + '@removed.com'); continue; }
        // DEFAULT del esquema cuando la estrategia lo pide, o cuando hay que vaciar una columna
        // NOT NULL o no textual. c.dflt es texto del propio esquema (no viene del usuario).
        if (c.dflt != null && (c.strategy === 'default' || (c.notnull && (c.strategy === 'null' || !c.text)))) {
            sets.push(col + ' = ' + c.dflt);
            continue;
        }
        const asEmpty = c.notnull || (c.strategy === 'blank' && c.text);
        sets.push(col + ' = ?');
        values.push(asEmpty ? '' : null);
    }
    return { sets, values };
}

// Anonimiza al titular y a sus acompañantes (filas hijas) en UNA conexión, en una sola
// transacción. Devuelve las columnas de guests sin clasificar en esa base.
function anonymizeGuestInConnection(conn, eventId, guestId) {
    const { personal, unknown } = guestPersonalColumns(conn);
    if (!personal.length) return unknown;
    const hasParentLink = tableHasColumn(conn, 'guests', 'parent_guest_id');
    const hasStatusNotes = tableHasColumn(conn, 'guest_status_log', 'notes');
    conn.transaction((gId, evId) => {
        const head = guestErasureSets(personal, gId);
        conn.prepare('UPDATE guests SET ' + head.sets.join(', ') + ' WHERE id = ? AND event_id = ?').run(...head.values, gId, evId);
        let kidIds = [];
        if (hasParentLink) {
            kidIds = conn.prepare('SELECT id FROM guests WHERE parent_guest_id = ?').all(gId).map(r => r.id);
            // los hijos ya quedan ligados al titular por parent_guest_id
            for (const kidId of kidIds) {
                const kid = guestErasureSets(personal, kidId);
                conn.prepare('UPDATE guests SET ' + kid.sets.join(', ') + ' WHERE id = ?').run(...kid.values, kidId);
            }
        }
        // guests no tiene notas propias: las notas del organizador sobre el invitado (texto libre,
        // pueden traer datos personales) viven en guest_status_log.notes.
        if (hasStatusNotes) {
            const ids = [gId].concat(kidIds);
            conn.prepare('UPDATE guest_status_log SET notes = ? WHERE guest_id IN (' + ids.map(() => '?').join(', ') + ')').run(ERASURE_NOTE, ...ids);
        }
    })(guestId, eventId);
    return unknown;
}

// Aplica la anonimización en la BD del evento y, si el evento tiene BD propia, también en la
// maestra (el registro público guarda allí una copia del invitado). No hay transacción entre dos
// archivos: si una base falla se informa cuál, sin dar por hecha una eliminación a medias.
function anonymizeGuestPersonalData(eventId, guestId, eventDb) {
    const targets = [];
    if (eventDb && eventDb !== db) targets.push(['evento', eventDb]);
    targets.push(['maestra', db]);
    const result = { applied: [], failed: [], unclassified: {} };
    for (const [label, conn] of targets) {
        try {
            const unknown = anonymizeGuestInConnection(conn, eventId, guestId);
            result.applied.push(label);
            if (unknown.length) {
                result.unclassified[label] = unknown;
                logger.warn('[COMPLIANCE] guests tiene columnas sin clasificar en la BD ' + label + ' (NO se anonimizan; decláralas en ERASURE_EXTRA_GUEST_COLUMNS): ' + unknown.join(', '));
            }
        } catch (err) {
            result.failed.push(label);
            logger.error('[COMPLIANCE] La anonimización falló en la BD ' + label + ':', err.message);
        }
    }
    return result;
}

// DELETE /api/events/:eventId/guests/:guestId/personal-data — Derecho al olvido (anonimizar datos personales)
router.delete('/events/:eventId/guests/:guestId/personal-data', authMiddleware(['ADMIN', 'PRODUCTOR']), (req, res) => {
    try {
        // v12.44.842 (seguridad): el evento debe ser del usuario (antes cualquier
        // PRODUCTOR/ORGANIZER podía pedir datos de invitados de eventos ajenos)
        if (!hasEventAccess(req.userId, req.params.eventId, req.userRole)) return res.status(403).json({ error: 'No tienes acceso a este evento' });
        const eventDb = getEventDb(req.params.eventId);
        if (!eventDb) return res.status(404).json({ error: 'Evento no encontrado' });
        const guestId = req.params.guestId;
        const guest = eventDb.prepare("SELECT * FROM guests WHERE id = ? AND event_id = ?").get(guestId, req.params.eventId);
        if (!guest) return res.status(404).json({ error: 'Invitado no encontrado' });

        // v12.44.846 (auditoría 2026-11-25, H2): aquí iba un UPDATE fijo sobre company,
        // dietary_restrictions, special_needs y notes. Esas columnas no existen en guests (ni en la
        // BD maestra ni en la de evento) → prepare() lanzaba "no such column" y la ruta respondía
        // 500 SIN anonimizar nada. Además solo tocaba eventDb: si el evento tiene BD propia, la
        // copia de la maestra conservaba los datos reales. Ahora el SET se arma con las columnas
        // personales que REALMENTE tenga cada esquema (definiciones justo encima de esta ruta) y se
        // aplica en la BD del evento y en la maestra. Si alguna falla: 500 y no se sigue.
        const erasure = anonymizeGuestPersonalData(req.params.eventId, guestId, eventDb);
        if (erasure.failed.length) {
            return res.status(500).json({ success: false, error: 'Eliminación incompleta: no se pudo anonimizar en la BD ' + erasure.failed.join(', ') + '. Revisa los logs del servidor.' });
        }

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
        // v12.44.846 (auditoría 2026-11-25, H2): la línea de arriba solo tocaba eventDb; cuando el
        // evento tiene BD propia, en la maestra quedaban el enlace al titular y el pie de foto
        // (texto libre que puede traer su nombre). Mismo corte en la maestra.
        try { if (db !== eventDb) db.prepare("UPDATE event_photos SET guest_id = NULL, caption = '' WHERE guest_id = ?").run(guestId); } catch(e) {}
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

        // v12.44.846 (H2): la respuesta dice en qué bases se aplicó y, si las hay, las columnas de
        // guests que el catálogo no sabe clasificar (no se tocan).
        res.json({ success: true, message: 'Datos personales eliminados exitosamente', anonymized_in: erasure.applied, unclassified_columns: erasure.unclassified });
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
// v12.44.846 (auditoría 2026-11-25, H2b): un solo criterio de anonimización para todo el sistema.
// Lo reutiliza el borrado GDPR deprecado de guests.routes.js cuando el evento tiene BD propia.
module.exports.anonymizeGuestPersonalData = anonymizeGuestPersonalData;
