const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

console.log("--- email_templates ---");
const t1 = db.prepare("SELECT id, name FROM email_templates WHERE name LIKE '%Confirmación%'").all();
t1.forEach(t => console.log(`- ID: ${t.id} | Name: ${t.name}`));

console.log("\n--- event_email_templates ---");
const t2 = db.prepare("SELECT id, name FROM event_email_templates WHERE name LIKE '%Confirmación%'").all();
t2.forEach(t => console.log(`- ID: ${t.id} | Name: ${t.name}`));

db.close();
