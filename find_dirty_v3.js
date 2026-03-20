const Database = require('better-sqlite3');
const db = new Database('./check_app.db');

const searchText = "complace";

const tables = ['email_templates', 'event_email_templates'];

tables.forEach(table => {
    const rows = db.prepare(`SELECT id, name, body FROM ${table} WHERE body LIKE ?`).all(`%${searchText}%`);
    rows.forEach(row => {
        console.log(`FOUND in ${table}:`);
        console.log(`ID: ${row.id}`);
        console.log(`Name: ${row.name}`);
        console.log(`Body (snippet): ${row.body.substring(0, 200)}`);
        console.log('---');
    });
});

db.close();
