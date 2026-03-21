/**
 * Sistema de Migrations para Check Pro
 * Permite versionar cambios en la base de datos de forma controlada
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const db = new Database(path.join(__dirname, '..', 'check_app.db'));

// Tabla de control de migrations
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    rolled_back_at TEXT
)`);

// Migraciones pendientes o aplicadas
const migrations = [
    {
        version: '001',
        name: 'create_initial_schema',
        description: 'Esquema inicial (ya existe)',
        up: null, // Ya existe
        down: null
    },
    {
        version: '002', 
        name: 'add_display_name_to_users',
        description: 'Agregar columna display_name a users',
        up: `ALTER TABLE users ADD COLUMN display_name TEXT`,
        down: null
    },
    {
        version: '003',
        name: 'add_group_id_to_events',
        description: 'Agregar columna group_id a events',
        up: `ALTER TABLE events ADD COLUMN group_id TEXT`,
        down: null
    },
    {
        version: '004',
        name: 'add_group_id_to_users', 
        description: 'Agregar columna group_id a users',
        up: `ALTER TABLE users ADD COLUMN group_id TEXT`,
        down: null
    },
    {
        version: '005',
        name: 'add_unsubscribe_to_guests',
        description: 'Agregar columnas de unsubscribe a guests',
        up: `ALTER TABLE guests ADD COLUMN unsubscribed INTEGER DEFAULT 0`,
        down: null
    },
    {
        version: '006',
        name: 'add_unsubscribe_token_to_guests',
        description: 'Agregar token de unsubscribe',
        up: `ALTER TABLE guests ADD COLUMN unsubscribe_token TEXT`,
        down: null
    },
    {
        version: '007',
        name: 'add_end_date_to_events',
        description: 'Agregar columna end_date a events',
        up: `ALTER TABLE events ADD COLUMN end_date TEXT`,
        down: null
    },
    {
        version: '008',
        name: 'add_phone_to_users',
        description: 'Agregar columna phone a users',
        up: `ALTER TABLE users ADD COLUMN phone TEXT`,
        down: null
    },
    {
        version: '009',
        name: 'add_role_detail_to_users',
        description: 'Agregar columna role_detail a users',
        up: `ALTER TABLE users ADD COLUMN role_detail TEXT DEFAULT 'STAFF'`,
        down: null
    },
    {
        version: '010',
        name: 'add_status_to_users',
        description: 'Agregar columna status a users',
        up: `ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'PENDING'`,
        down: null
    },
    {
        version: '011',
        name: 'add_reg_fields_to_events',
        description: 'Agregar campos de registro público a events',
        up: `
            ALTER TABLE events ADD COLUMN reg_title TEXT;
            ALTER TABLE events ADD COLUMN reg_welcome_text TEXT;
            ALTER TABLE events ADD COLUMN reg_policy TEXT;
            ALTER TABLE events ADD COLUMN reg_success_message TEXT;
            ALTER TABLE events ADD COLUMN reg_logo_url TEXT;
            ALTER TABLE events ADD COLUMN reg_show_phone INTEGER DEFAULT 1;
            ALTER TABLE events ADD COLUMN reg_show_org INTEGER DEFAULT 1;
            ALTER TABLE events ADD COLUMN reg_show_position INTEGER DEFAULT 0;
            ALTER TABLE events ADD COLUMN reg_show_vegan INTEGER DEFAULT 1;
            ALTER TABLE events ADD COLUMN reg_show_dietary INTEGER DEFAULT 1;
            ALTER TABLE events ADD COLUMN reg_show_gender INTEGER DEFAULT 0;
            ALTER TABLE events ADD COLUMN reg_require_agreement INTEGER DEFAULT 1;
        `,
        down: null
    },
    {
        version: '012',
        name: 'add_qr_customization_to_events',
        description: 'Agregar personalización de QR y tickets',
        up: `
            ALTER TABLE events ADD COLUMN qr_color_dark TEXT DEFAULT '#000000';
            ALTER TABLE events ADD COLUMN qr_color_light TEXT DEFAULT '#ffffff';
            ALTER TABLE events ADD COLUMN qr_logo_url TEXT;
            ALTER TABLE events ADD COLUMN ticket_bg_url TEXT;
            ALTER TABLE events ADD COLUMN ticket_accent_color TEXT DEFAULT '#7c3aed';
            ALTER TABLE events ADD COLUMN reg_email_whitelist TEXT;
            ALTER TABLE events ADD COLUMN reg_email_blacklist TEXT;
        `,
        down: null
    },
    {
        version: '013',
        name: 'add_email_fields_to_groups',
        description: 'Agregar email y phone a groups',
        up: `
            ALTER TABLE groups ADD COLUMN email TEXT;
            ALTER TABLE groups ADD COLUMN phone TEXT;
        `,
        down: null
    },
    {
        version: '014',
        name: 'add_event_id_to_email_templates',
        description: 'Agregar event_id a email_templates',
        up: `ALTER TABLE email_templates ADD COLUMN event_id TEXT`,
        down: null
    },
    {
        version: '015',
        name: 'create_database_indexes',
        description: 'Crear índices de rendimiento',
        up: `
            CREATE INDEX IF NOT EXISTS idx_guests_event_email ON guests(event_id, email);
            CREATE INDEX IF NOT EXISTS idx_guests_event_phone ON guests(event_id, phone);
            CREATE INDEX IF NOT EXISTS idx_guests_qr_token ON guests(qr_token);
            CREATE INDEX IF NOT EXISTS idx_guests_unsubscribe_token ON guests(unsubscribe_token);
            CREATE INDEX IF NOT EXISTS idx_guests_checkin_time ON guests(event_id, checkin_time);
            CREATE INDEX IF NOT EXISTS idx_events_group ON events(group_id);
            CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
            CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
            CREATE INDEX IF NOT EXISTS idx_pre_reg_event_status ON pre_registrations(event_id, status);
            CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(event_id, status);
            CREATE INDEX IF NOT EXISTS idx_email_logs_event ON email_logs(event_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_events_event ON user_events(event_id);
            CREATE INDEX IF NOT EXISTS idx_group_users_group ON group_users(group_id);
            CREATE INDEX IF NOT EXISTS idx_group_users_user ON group_users(user_id);
            CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
        `,
        down: null
    }
];

// Funciones de migración
function getAppliedMigrations() {
    return db.prepare("SELECT version FROM schema_migrations WHERE rolled_back_at IS NULL ORDER BY version").all().map(m => m.version);
}

function getPendingMigrations() {
    const applied = getAppliedMigrations();
    return migrations.filter(m => !applied.includes(m.version));
}

function applyMigration(migration) {
    const insert = db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)");
    
    try {
        if (migration.up) {
            // Dividir por punto y coma y ejecutar cada statement
            const statements = migration.up.split(';').filter(s => s.trim());
            for (const stmt of statements) {
                if (stmt.trim()) {
                    db.exec(stmt.trim());
                }
            }
        }
        
        insert.run(migration.version, migration.name, new Date().toISOString());
        return true;
    } catch (err) {
        console.error(`Error aplicando migración ${migration.version}: ${err.message}`);
        return false;
    }
}

function rollbackMigration(migration) {
    const update = db.prepare("UPDATE schema_migrations SET rolled_back_at = ? WHERE version = ?");
    
    try {
        if (migration.down) {
            db.exec(migration.down);
        }
        update.run(new Date().toISOString(), migration.version);
        return true;
    } catch (err) {
        console.error(`Error reversando migración ${migration.version}: ${err.message}`);
        return false;
    }
}

// Ejecutar según argumento
const command = process.argv[2] || 'status';

console.log('===========================================');
console.log('  📦 SISTEMA DE MIGRATIONS');
console.log('===========================================\n');

switch (command) {
    case 'up':
        console.log('Ejecutando migraciones pendientes...\n');
        const pending = getPendingMigrations();
        
        if (pending.length === 0) {
            console.log('✓ No hay migraciones pendientes\n');
        } else {
            for (const m of pending) {
                if (applyMigration(m)) {
                    console.log(`  ✓ ${m.version}: ${m.name}`);
                } else {
                    console.log(`  ✗ ${m.version}: Error`);
                }
            }
            console.log(`\n✓ ${pending.length} migración(es) aplicada(s)\n`);
        }
        break;
        
    case 'down':
        console.log('Reversando última migración...\n');
        const applied = getAppliedMigrations();
        
        if (applied.length === 0) {
            console.log('✗ No hay migraciones aplicadas\n');
        } else {
            const lastVersion = applied[applied.length - 1];
            const migration = migrations.find(m => m.version === lastVersion);
            
            if (migration && migration.down) {
                if (rollbackMigration(migration)) {
                    console.log(`  ✓ ${lastVersion}: Reversada`);
                } else {
                    console.log(`  ✗ ${lastVersion}: Error`);
                }
            } else {
                console.log(`  ⚠ ${lastVersion}: No tiene migración down\n`);
            }
        }
        break;
        
    case 'fresh':
        console.log('Recreando base de datos (⚠️ PELIGROSO)...\n');
        console.log('Esta opción aún no está implementada.');
        console.log('Para reiniciar, elimina check_app.db y reinicia el servidor.\n');
        break;
        
    case 'status':
    default:
        const allApplied = getAppliedMigrations();
        const allPending = getPendingMigrations();
        
        console.log(`📊 Estado: ${allApplied.length}/${migrations.length} migraciones aplicadas\n`);
        
        if (allApplied.length > 0) {
            console.log('✓ Aplicadas:');
            allApplied.forEach(v => {
                const m = migrations.find(x => x.version === v);
                console.log(`   ${v}: ${m?.name || 'desconocido'}`);
            });
            console.log('');
        }
        
        if (allPending.length > 0) {
            console.log('○ Pendientes:');
            allPending.forEach(m => {
                console.log(`   ${m.version}: ${m.name}`);
            });
            console.log('');
        }
        
        console.log('Comandos:');
        console.log('  node scripts/run_migrations.js up    - Aplicar pendientes');
        console.log('  node scripts/run_migrations.js down  - Reversar última');
        console.log('  node scripts/run_migrations.js fresh - Recrear (no impl)\n');
        break;
}

db.close();
