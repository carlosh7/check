/**
 * fix_db.js - Check Pro v12.44.0
 * Uso: node fix_db.js "ruta/de/la/base.db"
 * Nota: El módulo de mailing fue eliminado, este script ahora solo repara tablas principales
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const targetDb = process.argv[2] || path.resolve(__dirname, 'data/check_app.db');
console.log(`🔍 Iniciando REPARACION en: ${targetDb}`);

try {
    const db = new Database(targetDb);
    
    // Reparar Usuarios con ID nulo
    const nullUsers = db.prepare("SELECT ROWID, username FROM users WHERE id IS NULL OR id = 'null' OR id = ''").all();
    if (nullUsers.length > 0) {
        console.log(`[REPAIR] Encontrados ${nullUsers.length} usuarios dañados.`);
        const updateStmt = db.prepare("UPDATE users SET id = ? WHERE ROWID = ?");
        nullUsers.forEach(row => {
            const newId = uuidv4();
            updateStmt.run(newId, row.rowid);
            console.log(`✓ Reparado usuario '${row.username}' -> Nuevo ID: ${newId}`);
        });
    }

    db.close();
    console.log("✨ REPARACION COMPLETADA.");
} catch (e) {
    console.error("❌ Error:", e.message);
}