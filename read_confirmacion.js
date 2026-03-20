const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

const t = db.prepare("SELECT body FROM email_templates WHERE name = '[Modelo] Confirmación de Registro'").get();
if (t) {
    console.log("--- Body of Confirmacion ---");
    console.log(t.body);
} else {
    console.log("Template not found.");
}

db.close();
