const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');
const fs = require('fs');

const r = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Recordatorio de Evento'").get();
const c = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Confirmación de Registro'").get();

if (r) fs.writeFileSync('c:/Users/carlo/OneDrive/Documentos/APP/Registro/debug_recordatorio.html', r.body);
if (c) fs.writeFileSync('c:/Users/carlo/OneDrive/Documentos/APP/Registro/debug_confirmacion.html', c.body);

db.close();
console.log("Templates saved to debug files.");
