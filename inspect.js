/**
 * inspect.js - Check Pro v12.37.23 (Auditoría)
 * Uso: node inspect.js "ruta/de/la/base.db"
 */
const Database = require('better-sqlite3');
const path = require('path');

const targetDb = process.argv[2] || path.resolve(__dirname, 'data/check_app.db');
console.log(`\n🔍 AUDITANDO BASE DE DATOS EN: ${targetDb}`);

try {
    const db = new Database(targetDb);
    
    // 1. Auditoría Email Accounts
    console.log(`\n--- [EMAIL ACCOUNTS] ---`);
    const accounts = db.prepare("SELECT id, name, user_email FROM email_accounts").all();
    if (accounts.length === 0) {
        console.log("⚠️ No hay cuentas registradas.");
    } else {
        accounts.forEach(acc => {
            const status = (acc.id && acc.id !== 'null' && acc.id !== '') ? '✅ OK' : '❌ DAÑADO (NULL)';
            console.log(`${status} | ID: ${acc.id} | Nombre: ${acc.name} | Email: ${acc.user_email}`);
        });
    }

    // 2. Auditoría Templates
    console.log(`\n--- [EMAIL TEMPLATES] ---`);
    const templates = db.prepare("SELECT id, name, subject FROM email_templates").all();
    if (templates.length === 0) {
        console.log("⚠️ No hay plantillas registradas.");
    } else {
        templates.forEach(tpl => {
            const status = (tpl.id && tpl.id !== 'null' && tpl.id !== '') ? '✅ OK' : '❌ DAÑADO (NULL)';
            console.log(`${status} | ID: ${tpl.id} | Nombre: ${tpl.name} | Asunto: ${tpl.subject}`);
        });
    }

    db.close();
    console.log("\n✨ AUDITORIA FINALIZADA.\n");
} catch (e) {
    console.error("❌ ERROR EN AUDITORIA:", e.message);
    process.exit(1);
}
