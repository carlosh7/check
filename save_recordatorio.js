const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

const t = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Recordatorio de Evento'").get();
if (t) {
    const fs = require('fs');
    fs.writeFileSync('c:/Users/carlo/OneDrive/Documentos/APP/Registro/recordatorio_full.html', t.body);
    console.log("Full body saved to recordatorio_full.html");
} else {
    console.log("Template not found.");
}

db.close();
