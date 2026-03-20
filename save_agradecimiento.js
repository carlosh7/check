const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

const t = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Agradecimiento Post-Evento'").get();
if (t) {
    const fs = require('fs');
    fs.writeFileSync('c:/Users/carlo/OneDrive/Documentos/APP/Registro/agradecimiento_full.html', t.body);
    console.log("Full body saved to agradecimiento_full.html");
} else {
    console.log("Template not found.");
}

db.close();
