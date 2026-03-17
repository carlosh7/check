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
        user_id INTEGER,
        name TEXT,
        date TEXT,
        location TEXT,
        logo_url TEXT,
        description TEXT,
        db_name TEXT UNIQUE,
        FOREIGN KEY (user_id) REFERENCES users (id)
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

    // Tabla de Encuestas (Configuración)
    db.run(`CREATE TABLE IF NOT EXISTS surveys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER,
        question TEXT,
        type TEXT DEFAULT 'stars', -- 'stars', 'yes_no', 'text'
        FOREIGN KEY (event_id) REFERENCES events (id)
    )`);

    // Tabla de Respuestas de Encuestas
    db.run(`CREATE TABLE IF NOT EXISTS survey_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER,
        guest_id INTEGER,
        rating INTEGER,
        comment TEXT,
        FOREIGN KEY (event_id) REFERENCES events (id),
        FOREIGN KEY (guest_id) REFERENCES guests (id)
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
