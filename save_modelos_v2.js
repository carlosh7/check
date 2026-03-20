const Database = require('better-sqlite3');
const db = new Database('./check_app.db');
const fs = require('fs');

const r = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Recordatorio de Evento'").get();
const c = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Confirmación de Registro'").get();

if (r) fs.writeFileSync('./debug_recordatorio.html', r.body);
if (c) fs.writeFileSync('./debug_confirmacion.html', c.body);

db.close();
console.log("Templates saved to ./debug_recordatorio.html and ./debug_confirmacion.html");
