const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.argv[2] || path.join(__dirname, 'data', 'check_app.db');
console.log('--- AUDITORÍA DE BASE DE DATOS (v12.44.0) ---');
console.log('Ruta:', dbPath);

try {
    const db = new Database(dbPath, { fileMustExist: true });
    
    // Auditoría de tablas principales
    console.log('\n[USUARIOS]');
    const users = db.prepare('SELECT id, username, role FROM users LIMIT 5').all();
    console.log(`Total: ${users.length} muestra(s)`);
    
    console.log('\n[EVENTOS]');
    const events = db.prepare('SELECT id, name, status FROM events LIMIT 5').all();
    console.log(`Total: ${events.length} muestra(s)`);
    
    db.close();
    console.log('\n--- FIN DE AUDITORÍA ---');
} catch (e) {
    console.error('Error al abrir la base de datos:', e.message);
}