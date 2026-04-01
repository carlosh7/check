const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.argv[2] || path.join(__dirname, 'data', 'check_app.db');
console.log('--- AUDITORÍA DE BASE DE DATOS (v12.37.23) ---');
console.log('Ruta:', dbPath);

try {
    const db = new Database(dbPath, { fileMustExist: true });
    
    console.log('\n[CUENTAS DE EMAIL]');
    const accounts = db.prepare('SELECT id, email, smtp_host FROM email_accounts').all();
    if (accounts.length === 0) console.log('Vacío.');
    accounts.forEach(a => {
        console.log(`- ID: ${a.id} | Email: ${a.email} | Host: ${a.smtp_host}`);
    });

    console.log('\n[PLANTILLAS DE EMAIL]');
    const templates = db.prepare('SELECT id, name, subject FROM email_templates').all();
    if (templates.length === 0) console.log('Vacío.');
    templates.forEach(t => {
        console.log(`- ID: ${t.id} | Nombre: ${t.name} | Asunto: ${t.subject}`);
    });

    db.close();
    console.log('\n--- FIN DE AUDITORÍA ---');
} catch (e) {
    console.error('Error al abrir la base de datos:', e.message);
}
