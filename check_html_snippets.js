const Database = require('better-sqlite3');
const db = new Database('./check_app.db');

const r = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Recordatorio de Evento'").get();
const c = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Confirmación de Registro'").get();

console.log("--- Recordatorio (First 500) ---");
console.log(r ? r.body.substring(0, 500) : "Not found");

console.log("\n--- Confirmación (First 500) ---");
console.log(c ? c.body.substring(0, 500) : "Not found");

db.close();
