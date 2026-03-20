const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

console.log("--- Global Templates ---");
const globalTemplates = db.prepare("SELECT name, subject, body FROM email_templates").all();
globalTemplates.forEach(t => console.log(`Name: ${t.name} | Subject: ${t.subject}`));

console.log("\n--- Event Templates ---");
const eventTemplates = db.prepare("SELECT name, subject, body FROM event_email_templates").all();
eventTemplates.forEach(t => console.log(`Name: ${t.name} | Subject: ${t.subject}`));

db.close();
