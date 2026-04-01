/**
 * fix_db.js - Check Pro v12.37.21
 * Ejecuta este script con 'node fix_db.js' para reparar IDs nulos.
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, 'data/check_app.db');
const db = new Database(dbPath);

console.log("🔍 Iniciando REPARACIÓN MANUAL de base de datos...");

try {
    // 1. Reparar Email Accounts
    const nullAccounts = db.prepare("SELECT ROWID, name FROM email_accounts WHERE id IS NULL OR id = 'null' OR id = ''").all();
    if (nullAccounts.length > 0) {
        console.log(`[REPAIR] Encontradas ${nullAccounts.length} cuentas dañadas.`);
        const updateStmt = db.prepare("UPDATE email_accounts SET id = ? WHERE ROWID = ?");
        nullAccounts.forEach(row => {
            const newId = uuidv4();
            updateStmt.run(newId, row.rowid);
            console.log(`✓ Reparada cuenta '${row.name}' -> Nuevo ID: ${newId}`);
        });
    } else {
        console.log("✓ No se encontraron cuentas con ID nulo.");
    }

    // 2. Reparar Templates
    const nullTemplates = db.prepare("SELECT ROWID, name FROM email_templates WHERE id IS NULL OR id = 'null' OR id = ''").all();
    if (nullTemplates.length > 0) {
        console.log(`[REPAIR] Encontradas ${nullTemplates.length} plantillas dañadas.`);
        const updateStmt = db.prepare("UPDATE email_templates SET id = ? WHERE ROWID = ?");
        nullTemplates.forEach(row => {
            const newId = uuidv4();
            updateStmt.run(newId, row.rowid);
            console.log(`✓ Reparada plantilla '${row.name}' -> Nuevo ID: ${newId}`);
        });
    } else {
        console.log("✓ No se encontraron plantillas con ID nulo.");
    }

    console.log("✨ REPARACIÓN COMPLETADA EXITOSAMENTE.");
} catch (e) {
    console.error("❌ ERROR CRÍTICO EN REPARACIÓN:", e.message);
    process.exit(1);
} finally {
    db.close();
}
