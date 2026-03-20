const Database = require('better-sqlite3');
const db = new Database('./check_app.db');

console.log('--- BUSCANDO PLANTILLAS DE CONFIRMACIÓN ---');

const searchTerms = ['%Confirmación%', '%Confirmacion%'];

searchTerms.forEach(term => {
    console.log(`\nBuscando: ${term}`);
    
    console.log('Tabla: email_templates');
    const globalTpls = db.prepare("SELECT id, name, SUBSTR(body, 1, 50) as snippet FROM email_templates WHERE name LIKE ?").all(term);
    globalTpls.forEach(t => console.log(`ID: ${t.id} | Name: ${t.name} | Snippet: ${t.snippet}...`));

    console.log('Tabla: event_email_templates');
    const eventTpls = db.prepare("SELECT id, event_id, name, SUBSTR(body, 1, 50) as snippet FROM event_email_templates WHERE name LIKE ? OR template_type LIKE ?").all(term, term);
    eventTpls.forEach(t => {
        const event = db.prepare("SELECT name FROM events WHERE id = ?").get(t.event_id);
        console.log(`ID: ${t.id} | Event: ${event?.name || t.event_id} | Name: ${t.name} | Snippet: ${t.snippet}...`);
    });
});

db.close();
