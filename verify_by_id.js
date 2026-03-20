const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

const t = db.prepare("SELECT body FROM email_templates WHERE id = 'evt_confirmation_model'").get();
if (t) {
    console.log("--- Body of Confirmacion (ID: evt_confirmation_model) ---");
    console.log(t.body);
} else {
    console.log("Template not found by ID.");
}

db.close();
