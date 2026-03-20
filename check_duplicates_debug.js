const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

const t = db.prepare("SELECT id, name FROM email_templates WHERE name LIKE '%Confirmación%'").all();
console.log(t);

db.close();
