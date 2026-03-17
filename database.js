const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'check_app.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Tabla de Usuarios (Administradores)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'admin'
    )`);

    // Tabla de Eventos
    db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        date TEXT,
        location TEXT,
        logo_url TEXT,
        description TEXT,
        db_name TEXT UNIQUE -- Identificador para la "base de datos" lógica del evento
    )`);

    // Tabla de Invitados/Asistentes
    db.run(`CREATE TABLE IF NOT EXISTS guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER,
        name TEXT,
        email TEXT,
        phone TEXT,
        organization TEXT,
        checked_in INTEGER DEFAULT 0,
        checkin_time TEXT,
        FOREIGN KEY (event_id) REFERENCES events (id)
    )`);

    // Insertar usuario administrador por defecto (password: admin123)
    // En producción usaríamos bcrypt
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
        if (!row) {
            db.run("INSERT INTO users (username, password) VALUES ('admin', 'admin123')");
        }
    });

    // Evento de ejemplo
    db.get("SELECT * FROM events LIMIT 1", (err, row) => {
        if (!row) {
            db.run("INSERT INTO events (name, date, location, description) VALUES ('Evento de Gala 2026', '2026-03-20T19:30:00', 'Auditorio Metropolitano', 'El evento más exclusivo del año.')");
        }
    });
});

module.exports = db;
