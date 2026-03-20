const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');
const fs = require('fs');

let output = "--- email_templates ---\n";
const t1 = db.prepare("SELECT id, name FROM email_templates WHERE name LIKE '%Confirmación%'").all();
t1.forEach(t => output += `- ID: ${t.id} | Name: ${t.name}\n`);

output += "\n--- event_email_templates ---\n";
const t2 = db.prepare("SELECT id, name FROM event_email_templates WHERE name LIKE '%Confirmación%'").all();
t2.forEach(t => output += `- ID: ${t.id} | Name: ${t.name}\n`);

fs.writeFileSync('c:/Users/carlo/OneDrive/Documentos/APP/Registro/all_confirmations.txt', output);
db.close();
console.log("Done. Check all_confirmations.txt");
