/**
 * Script de migración de índices para mejorar rendimiento
 * Uso: node scripts/create_indexes.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'check_app.db'));

console.log('===========================================');
console.log('  📊 MIGRACIÓN DE ÍNDICES');
console.log('===========================================\n');

const indexes = [
    // Guests - búsquedas frecuentes por evento
    {
        name: 'idx_guests_event_email',
        sql: 'CREATE INDEX IF NOT EXISTS idx_guests_event_email ON guests(event_id, email)',
        description: 'Búsqueda de invitados por evento y email'
    },
    {
        name: 'idx_guests_event_phone',
        sql: 'CREATE INDEX IF NOT EXISTS idx_guests_event_phone ON guests(event_id, phone)',
        description: 'Búsqueda de invitados por evento y teléfono'
    },
    {
        name: 'idx_guests_qr_token',
        sql: 'CREATE INDEX IF NOT EXISTS idx_guests_qr_token ON guests(qr_token)',
        description: 'Búsqueda por QR token (check-in)'
    },
    {
        name: 'idx_guests_unsubscribe_token',
        sql: 'CREATE INDEX IF NOT EXISTS idx_guests_unsubscribe_token ON guests(unsubscribe_token)',
        description: 'Búsqueda de unsubscribe'
    },
    {
        name: 'idx_guests_checkin_time',
        sql: 'CREATE INDEX IF NOT EXISTS idx_guests_checkin_time ON guests(event_id, checkin_time)',
        description: 'Flujo de asistencia horaria'
    },

    // Events - filtros por grupo y usuario
    {
        name: 'idx_events_group',
        sql: 'CREATE INDEX IF NOT EXISTS idx_events_group ON events(group_id)',
        description: 'Filtrar eventos por grupo'
    },
    {
        name: 'idx_events_user',
        sql: 'CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id)',
        description: 'Filtrar eventos por usuario'
    },
    {
        name: 'idx_events_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)',
        description: 'Filtrar por estado'
    },

    // Pre-registrations
    {
        name: 'idx_pre_reg_event_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_pre_reg_event_status ON pre_registrations(event_id, status)',
        description: 'Pre-inscripciones pendientes por evento'
    },

    // Email queue
    {
        name: 'idx_email_queue_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(event_id, status)',
        description: 'Cola de emails por estado'
    },

    // Email logs
    {
        name: 'idx_email_logs_event',
        sql: 'CREATE INDEX IF NOT EXISTS idx_email_logs_event ON email_logs(event_id, created_at)',
        description: 'Logs de email por evento'
    },

    // User events (relación)
    {
        name: 'idx_user_events_user',
        sql: 'CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id)',
        description: 'Eventos por usuario'
    },
    {
        name: 'idx_user_events_event',
        sql: 'CREATE INDEX IF NOT EXISTS idx_user_events_event ON user_events(event_id)',
        description: 'Usuarios por evento'
    },

    // Group users (relación)
    {
        name: 'idx_group_users_group',
        sql: 'CREATE INDEX IF NOT EXISTS idx_group_users_group ON group_users(group_id)',
        description: 'Usuarios por grupo'
    },
    {
        name: 'idx_group_users_user',
        sql: 'CREATE INDEX IF NOT EXISTS idx_group_users_user ON group_users(user_id)',
        description: 'Grupos por usuario'
    },

    // Password resets
    {
        name: 'idx_password_resets_user',
        sql: 'CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id)',
        description: 'Resets de contraseña por usuario'
    }
];

let created = 0;
let skipped = 0;
let errors = 0;

console.log('Creando índices...\n');

for (const idx of indexes) {
    try {
        db.exec(idx.sql);
        
        // Verificar si se creó o ya existía
        const existing = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(idx.name);
        
        if (existing) {
            created++;
            console.log(`  ✓ ${idx.name}`);
        } else {
            skipped++;
            console.log(`  - ${idx.name} (ya existía)`);
        }
    } catch (err) {
        errors++;
        console.log(`  ✗ ${idx.name} - Error: ${err.message}`);
    }
}

console.log('\n===========================================');
console.log('  📊 RESUMEN');
console.log('===========================================');
console.log(`   ✓ Creados/nuevos:  ${created}`);
console.log(`   - Ya existían:     ${skipped}`);
console.log(`   ✗ Errores:          ${errors}`);
console.log('===========================================\n');

// Mostrar todos los índices creados
console.log('Índices en la base de datos:\n');
const allIndexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' ORDER BY tbl_name, name").all();
allIndexes.forEach(idx => {
    console.log(`  - ${idx.tbl_name}.${idx.name}`);
});

console.log('\n✅ Migración de índices completada!');

db.close();
