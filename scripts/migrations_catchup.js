/**
 * Script de catchup para registrar migraciones ya aplicadas
 * Usa en DB existentes que ya tienen todas las columnas
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'check_app.db'));

// Crear tabla si no existe
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    rolled_back_at TEXT
)`);

// Todas las migraciones que deben marcarse como aplicadas
const migrationsToMark = [
    { version: '001', name: 'create_initial_schema' },
    { version: '002', name: 'add_display_name_to_users' },
    { version: '003', name: 'add_group_id_to_events' },
    { version: '004', name: 'add_group_id_to_users' },
    { version: '005', name: 'add_unsubscribe_to_guests' },
    { version: '006', name: 'add_unsubscribe_token_to_guests' },
    { version: '007', name: 'add_end_date_to_events' },
    { version: '008', name: 'add_phone_to_users' },
    { version: '009', name: 'add_role_detail_to_users' },
    { version: '010', name: 'add_status_to_users' },
    { version: '011', name: 'add_reg_fields_to_events' },
    { version: '012', name: 'add_qr_customization_to_events' },
    { version: '013', name: 'add_email_fields_to_groups' },
    { version: '014', name: 'add_event_id_to_email_templates' },
    { version: '015', name: 'create_database_indexes' }
];

console.log('===========================================');
console.log('  📦 CATCHUP DE MIGRATIONS');
console.log('===========================================\n');

// Verificar qué ya está marcado
const alreadyMarked = db.prepare("SELECT version FROM schema_migrations").all().map(m => m.version);

const insert = db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)");

let marked = 0;
let skipped = 0;

for (const m of migrationsToMark) {
    if (alreadyMarked.includes(m.version)) {
        skipped++;
        console.log(`  - ${m.version}: ${m.name} (ya marcado)`);
    } else {
        insert.run(m.version, m.name, new Date().toISOString());
        marked++;
        console.log(`  ✓ ${m.version}: ${m.name} (marcado)`);
    }
}

console.log(`\n✓ ${marked} migración(es) marcada(s) como aplicadas`);
console.log(`- ${skipped} ya estaban marcadas\n`);

// Verificar estado final
const totalApplied = db.prepare("SELECT COUNT(*) as count FROM schema_migrations WHERE rolled_back_at IS NULL").get();
console.log(`Total de migraciones aplicadas: ${totalApplied.count}`);

db.close();
