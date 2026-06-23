/**
 * Sistema de migraciones de base de datos
 * 
 * Uso:
 *   node src/utils/migrate.js          — ejecuta migraciones pendientes
 *   node src/utils/migrate.js status   — muestra estado de migraciones
 *   node src/utils/migrate.js create   — crea nueva migración (interactivo)
 * 
 * Las migraciones se ejecutan automáticamente al iniciar el servidor.
 * @version 12.44.765
 */

const { db } = require('../../database');
const path = require('path');
const fs = require('fs');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

// Asegurar que existe la tabla de tracking
db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT DEFAULT (datetime('now'))
)`);

if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
}

function getApplied() {
    try {
        return db.prepare("SELECT name FROM _migrations ORDER BY id ASC").all().map(r => r.name);
    } catch (e) { return []; }
}

function markApplied(name) {
    try {
        db.prepare("INSERT OR IGNORE INTO _migrations (name) VALUES (?)").run(name);
    } catch (e) {}
}

function getPending() {
    const applied = getApplied();
    if (!fs.existsSync(MIGRATIONS_DIR)) return [];
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
        .sort()
        .filter(f => !applied.includes(f));
}

function runPending() {
    const pending = getPending();
    if (pending.length === 0) {
        return;
    }
    console.log(`[MIGRATE] Ejecutando ${pending.length} migración(es) pendiente(s)...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    pending.forEach(file => {
        try {
            const filePath = path.join(MIGRATIONS_DIR, file);
            
            if (file.endsWith('.sql')) {
                const sql = fs.readFileSync(filePath, 'utf8');
                // Ejecutar cada statement por separado para mejor error handling
                const statements = sql.split(';').filter(s => s.trim());
                statements.forEach(stmt => {
                    if (stmt.trim()) db.exec(stmt.trim());
                });
            } else if (file.endsWith('.js')) {
                const migration = require(filePath);
                if (typeof migration.up === 'function') {
                    migration.up(db);
                }
            }
            
            markApplied(file);
            console.log(`[MIGRATE] ✔ ${file}`);
            successCount++;
        } catch (e) {
            console.error(`[MIGRATE] ✗ ${file} — ${e.message}`);
            errorCount++;
        }
    });
    
    console.log(`[MIGRATE] Completado: ${successCount} éxitos, ${errorCount} errores`);
    return { success: successCount, errors: errorCount };
}

function showStatus() {
    const applied = getApplied();
    const pending = getPending();
    const allFiles = fs.existsSync(MIGRATIONS_DIR) 
        ? fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql') || f.endsWith('.js')).sort()
        : [];
    
    console.log('\n═══ ESTADO DE MIGRACIONES ═══');
    console.log(`Aplicadas: ${applied.length}`);
    console.log(`Pendientes: ${pending.length}`);
    console.log(`Total archivos: ${allFiles.length}`);
    
    if (applied.length > 0) {
        console.log('\n✅ Aplicadas:');
        applied.forEach(name => console.log(`  • ${name}`));
    }
    
    if (pending.length > 0) {
        console.log('\n⏳ Pendientes:');
        pending.forEach(name => console.log(`  • ${name}`));
    }
    
    if (pending.length === 0 && applied.length > 0) {
        console.log('\n🎉 Todas las migraciones están al día.');
    }
    
    console.log('');
}

function createMigration(name) {
    if (!name) {
        console.error('Uso: node src/utils/migrate.js create <nombre_migracion>');
        console.error('Ejemplo: node src/utils/migrate.js create add_event_color_column');
        process.exit(1);
    }
    
    const applied = getApplied();
    const allFiles = fs.existsSync(MIGRATIONS_DIR) 
        ? fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql') || f.endsWith('.js')).sort()
        : [];
    
    // Calcular siguiente número
    const maxNum = allFiles.reduce((max, f) => {
        const num = parseInt(f.split('_')[0], 10);
        return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    
    const nextNum = String(maxNum + 1).padStart(3, '0');
    const filename = `${nextNum}_${name}.sql`;
    const filepath = path.join(MIGRATIONS_DIR, filename);
    
    const template = `-- Migración: ${name}
-- Fecha: ${new Date().toISOString().split('T')[0]}
-- Descripción: [Describir qué hace esta migración]

-- Aquí van los statements SQL
-- Ejemplo:
-- ALTER TABLE events ADD COLUMN color TEXT DEFAULT '#7c3aed';
`;
    
    fs.writeFileSync(filepath, template);
    console.log(`✅ Migración creada: migrations/${filename}`);
    console.log(`   Edita el archivo y ejecuta: node src/utils/migrate.js`);
}

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'status') {
        showStatus();
    } else if (command === 'create') {
        createMigration(args[1]);
    } else {
        runPending();
    }
}

module.exports = { runPending, getPending, getApplied, markApplied, showStatus, createMigration };
