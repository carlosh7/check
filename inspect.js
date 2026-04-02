/**
 * inspect.js - Check Pro v12.44.0 (Auditoría)
 * Uso: node inspect.js "ruta/de/la/base.db"
 */
const Database = require('better-sqlite3');
const path = require('path');

const targetDb = process.argv[2] || path.resolve(__dirname, 'data/check_app.db');
console.log(`\n🔍 AUDITANDO BASE DE DATOS EN: ${targetDb}`);

try {
    const db = new Database(targetDb);
    
    // 1. Auditoría de Usuarios
    console.log(`\n--- [USUARIOS] ---`);
    const users = db.prepare("SELECT id, username, role, status FROM users").all();
    console.log(`Total: ${users.length} usuario(s)`);
    
    // 2. Auditoría de Eventos
    console.log(`\n--- [EVENTOS] ---`);
    const events = db.prepare("SELECT id, name, status FROM events").all();
    console.log(`Total: ${events.length} evento(s)`);

    db.close();
    console.log("\n✨ AUDITORIA FINALIZADA.\n");
} catch (e) {
    console.error("❌ Error:", e.message);
}