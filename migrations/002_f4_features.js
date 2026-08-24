/**
 * F4 2026-08 · Features diferenciadoras (idempotente)
 * Plus-ones, campos personalizados de registro, sponsors/leads.
 * Los mismos DDL existen en schema.js para instalaciones frescas; aquí se
 * garantizan para instalaciones existentes sin duplicar columnas.
 */
exports.up = function(db) {
    const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
    const safe = (fn) => { try { fn(); } catch (e) { console.log('[MIGRATE-002] skip:', e.message); } };

    if (!cols('events').includes('plus_one_quota')) {
        db.exec("ALTER TABLE events ADD COLUMN plus_one_quota INTEGER DEFAULT 0");
    }
    if (!cols('guests').includes('parent_guest_id')) {
        db.exec("ALTER TABLE guests ADD COLUMN parent_guest_id TEXT REFERENCES guests(id)");
    }
    if (!cols('guests').includes('guest_type')) {
        db.exec("ALTER TABLE guests ADD COLUMN guest_type TEXT DEFAULT 'principal'");
    }
    if (!cols('sessions').includes('stream_url')) {
        db.exec("ALTER TABLE sessions ADD COLUMN stream_url TEXT");
    }
    safe(() => db.exec(`CREATE TABLE IF NOT EXISTS registration_fields (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        label TEXT NOT NULL,
        field_type TEXT NOT NULL DEFAULT 'text',
        options_json TEXT,
        required INTEGER DEFAULT 0,
        show_if_field_id TEXT,
        show_if_value TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    )`));
    safe(() => db.exec(`CREATE TABLE IF NOT EXISTS registration_field_values (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        guest_id TEXT NOT NULL,
        field_id TEXT NOT NULL,
        value TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )`));
    safe(() => db.exec("CREATE INDEX IF NOT EXISTS idx_rfv_guest ON registration_field_values(guest_id)"));
    safe(() => db.exec("CREATE INDEX IF NOT EXISTS idx_rfv_field ON registration_field_values(field_id)"));
    safe(() => db.exec(`CREATE TABLE IF NOT EXISTS sponsors (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tier TEXT DEFAULT 'standard',
        booth TEXT,
        contact_email TEXT,
        logo_url TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )`));
    safe(() => db.exec(`CREATE TABLE IF NOT EXISTS sponsor_leads (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        sponsor_id TEXT NOT NULL,
        guest_id TEXT NOT NULL,
        notes TEXT,
        scanned_at TEXT DEFAULT (datetime('now'))
    )`));
    safe(() => db.exec("CREATE INDEX IF NOT EXISTS idx_sleads_sponsor ON sponsor_leads(sponsor_id)"));
};
