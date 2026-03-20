const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

const r = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Recordatorio de Evento'").get();
const c = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Confirmación de Registro'").get();

console.log("--- Recordatorio ---");
console.log(r.body.substring(0, 500));
console.log("\n--- Confirmacion ---");
console.log(c.body.substring(0, 500));

db.close();
