const Database = require('better-sqlite3');
const db = new Database('c:/Users/carlo/OneDrive/Documentos/APP/Registro/check_app.db');

console.log("--- Templates in email_templates ---");
try {
    const t1 = db.prepare("SELECT name FROM email_templates").all();
    t1.forEach(t => console.log(`- ${t.name}`));
} catch (e) { console.log("Table email_templates not found or error:", e.message); }

console.log("\n--- Templates in event_email_templates ---");
try {
    const t2 = db.prepare("SELECT name FROM event_email_templates").all();
    t2.forEach(t => console.log(`- ${t.name}`));
} catch (e) { console.log("Table event_email_templates not found or error:", e.message); }

db.close();
