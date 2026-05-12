/**
 * Migration Manager (C-04)
 * Sistema formal de migraciones con tracking en BD.
 *
 * Uso: node src/utils/migrator.js
 */
const path = require('path');
const fs = require('fs');

const db = require('../../database');

function ensureTable() {
    db.exec("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, name TEXT UNIQUE, applied_at TEXT DEFAULT (datetime('now')))");
}

function getApplied() {
    ensureTable();
    return db.prepare("SELECT name FROM _migrations ORDER BY name ASC").all().map(function(r) { return r.name; });
}

function markApplied(name) {
    ensureTable();
    try { db.prepare("INSERT INTO _migrations (id, name) VALUES (?, ?)").run(require('uuid').v4(), name); } catch(e) {}
}

function runPending() {
    var applied = getApplied();
    var migrationsDir = path.join(__dirname, '../../migrations');
    if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
        console.log('[MIGRATOR] Created migrations directory');
    }
    var files = fs.readdirSync(migrationsDir).filter(function(f) { return f.endsWith('.sql'); }).sort();
    var count = 0;
    files.forEach(function(file) {
        var name = file.replace(/\.sql$/, '');
        if (applied.includes(name)) return;
        var sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
            db.exec(sql);
            markApplied(name);
            console.log('[MIGRATOR] Applied: ' + name);
            count++;
        } catch(e) {
            console.error('[MIGRATOR] Error applying ' + name + ':', e.message);
        }
    });
    if (count === 0) console.log('[MIGRATOR] No pending migrations');
    return count;
}

// Auto-run on require
runPending();

module.exports = { runPending, getApplied };
