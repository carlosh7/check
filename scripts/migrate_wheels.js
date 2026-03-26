// Migración para agregar tablas de Ruleta de Sorteos
// Ejecute: node scripts/migrate_wheels.js

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'check_app.db');
const db = new Database(dbPath);

console.log('=== CREANDO TABLAS PARA RULETA DE SORTESOS ===\n');

// 1. Tabla principal de ruletas por evento
db.exec(`
CREATE TABLE IF NOT EXISTS event_wheels (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id)
)
`);

console.log('✅ event_wheels');

// 2. Participantes de la ruleta
db.exec(`
CREATE TABLE IF NOT EXISTS wheel_participants (
    id TEXT PRIMARY KEY,
    wheel_id TEXT NOT NULL,
    guest_id TEXT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    custom_data TEXT DEFAULT '{}',
    source TEXT DEFAULT 'manual',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id) ON DELETE CASCADE
)
`);

console.log('✅ wheel_participants');

// 3. Historial de giros
db.exec(`
CREATE TABLE IF NOT EXISTS wheel_spins (
    id TEXT PRIMARY KEY,
    wheel_id TEXT NOT NULL,
    participant_id TEXT,
    winner_name TEXT,
    winner_email TEXT,
    spin_result TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id) ON DELETE CASCADE
)
`);

console.log('✅ wheel_spins');

// 4. Captura de leads
db.exec(`
CREATE TABLE IF NOT EXISTS wheel_leads (
    id TEXT PRIMARY KEY,
    wheel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    source_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id) ON DELETE CASCADE
)
`);

console.log('✅ wheel_leads');

// 5. Agregar columna para contar ruletas en events (opcional)
try {
    db.exec(`ALTER TABLE events ADD COLUMN has_wheel INTEGER DEFAULT 0`);
    console.log('✅ Columna has_wheel agregada a events');
} catch(e) {
    // Columna ya existe
    console.log('ℹ️  Columna has_wheel ya existe');
}

console.log('\n=== TABLAS CREADAS CORRECTAMENTE ===');
console.log('\nTablas creadas:');
console.log('  - event_wheels (ruletas por evento)');
console.log('  - wheel_participants (participantes)');
console.log('  - wheel_spins (historial de giros)');
console.log('  - wheel_leads (captura de leads)');

db.close();