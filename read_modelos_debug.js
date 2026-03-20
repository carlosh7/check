const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

const r = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Recordatorio de Evento'").get();
const c = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Confirmación de Registro'").get();

console.log("--- [Modelo] Recordatorio de Evento ---");
console.log(r ? r.body : "Not found");

console.log("\n--- [Modelo] Confirmación de Registro ---");
console.log(c ? c.body : "Not found");

db.close();
