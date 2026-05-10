/**
 * Sistema de migraciones de base de datos (BL-23)
 * 
 * Uso: node src/utils/migrate.js
 * Las migraciones se ejecutan automáticamente al iniciar el servidor.
 */

const { db } = require('../../database');
const path = require('path');
const fs = require('fs');

// Ensure migrations table exists
db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

// Ensure migrations directory exists
if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
}

function getApplied() {
    try {
        return db.prepare("SELECT name FROM migrations ORDER BY id ASC").all().map(r => r.name);
    } catch(e) { return []; }
}

function markApplied(name) {
    try { db.prepare("INSERT OR IGNORE INTO migrations (name) VALUES (?)").run(name); } catch(e) {}
}

function getPending() {
    var applied = getApplied();
    if (!fs.existsSync(MIGRATIONS_DIR)) return [];
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(function(f) { return f.endsWith('.sql') || f.endsWith('.js'); })
        .sort()
        .filter(function(f) { return !applied.includes(f); });
}

function runPending() {
    var pending = getPending();
    if (pending.length === 0) {
        console.log('[MIGRATE] No pending migrations.');
        return;
    }
    console.log('[MIGRATE] Running ' + pending.length + ' pending migration(s)...');
    pending.forEach(function(file) {
        try {
            var filePath = path.join(MIGRATIONS_DIR, file);
            if (file.endsWith('.sql')) {
                var sql = fs.readFileSync(filePath, 'utf8');
                db.exec(sql);
            } else if (file.endsWith('.js')) {
                var migration = require(filePath);
                if (typeof migration.up === 'function') migration.up(db);
            }
            markApplied(file);
            console.log('[MIGRATE] ✔ ' + file);
        } catch(e) {
            console.error('[MIGRATE] ✗ ' + file + ' - ' + e.message);
        }
    });
}

// Export functions
module.exports = { runPending, getPending, getApplied, markApplied };
