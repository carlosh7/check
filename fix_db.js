/**
 * fix_db.js - Check Pro v12.37.22
 * Uso: node fix_db.js "ruta/de/la/base.db"
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const targetDb = process.argv[2] || path.resolve(__dirname, 'data/check_app.db');
console.log(`🔍 Iniciando REPARACION en: ${targetDb}`);

try {
    const db = new Database(targetDb);
    
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
    }

    db.close();
    console.log("✨ REPARACION COMPLETADA.");
} catch (e) {
    console.error("❌ ERROR EN REPARACION:", e.message);
    process.exit(1);
}
