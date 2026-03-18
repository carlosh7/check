const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, 'check_app.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Tabla de Usuarios (Soporte RBAC)
    // roles: 'ADMIN', 'PRODUCTOR', 'CLIENTE', 'LOGISTICO'
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'PRODUCTOR',
        status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
        created_at TEXT
    )`, (err) => {
        if (!err) {
            // Migración: Asegurar que la columna status existe (para DBs antiguas)
            db.run("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'PENDING'", (err) => {
                // Si falla es porque ya existe, lo ignoramos
            });
        }
    });

    // 2. Tabla de Eventos (Multitenancy)
    db.run(`CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT,
        date TEXT,
        location TEXT,
        logo_url TEXT,
        description TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (!err) {
            db.run("ALTER TABLE events ADD COLUMN created_at TEXT", (err) => {});
        }
    });

    // 3. Tabla de Invitados (UUIDs y Campos extendidos)
    db.run(`CREATE TABLE IF NOT EXISTS guests (
        id TEXT PRIMARY KEY,
        event_id TEXT,
        name TEXT,
        email TEXT,
        phone TEXT,
        organization TEXT,
        gender TEXT, -- 'M', 'F', 'O'
        dietary_notes TEXT, -- Alergias / Vegano
        is_new_registration INTEGER DEFAULT 0, -- 1 si fue registro on-site
        checked_in INTEGER DEFAULT 0,
        checkin_time TEXT,
        qr_token TEXT UNIQUE,
        FOREIGN KEY (event_id) REFERENCES events (id)
    )`);

    // 4. Tabla de Configuración de Mailing (SMTP por evento o usuario)
    db.run(`CREATE TABLE IF NOT EXISTS event_mailing_config (
        id TEXT PRIMARY KEY,
        event_id TEXT,
        smtp_host TEXT,
        smtp_port INTEGER,
        smtp_user TEXT,
        smtp_pass TEXT,
        welcome_subject TEXT,
        welcome_body TEXT,
        survey_subject TEXT,
        survey_body TEXT,
        FOREIGN KEY (event_id) REFERENCES events (id)
    )`);

    // 5. Tabla de Encuestas
    db.run(`CREATE TABLE IF NOT EXISTS surveys (
        id TEXT PRIMARY KEY,
        event_id TEXT,
        question TEXT,
        type TEXT DEFAULT 'stars', -- 'stars', 'yes_no', 'open', 'multiple'
        options TEXT, -- JSON para opciones múltiples
        FOREIGN KEY (event_id) REFERENCES events (id)
    )`);

    // 6. Tabla de Respuestas
    db.run(`CREATE TABLE IF NOT EXISTS survey_responses (
        id TEXT PRIMARY KEY,
        event_id TEXT,
        guest_id TEXT,
        responses_json TEXT, -- Almacena todas las respuestas de un invitado en JSON
        submitted_at TEXT,
        FOREIGN KEY (event_id) REFERENCES events (id),
        FOREIGN KEY (guest_id) REFERENCES guests (id)
    )`);

    // 7. Tabla de Configuración Global (Textos Legales V10)
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT
    )`, (err) => {
        if (!err) {
            // Semilla de textos legales por defecto si no existen
            db.run(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES 
                ('policy_data', '<h2>Política de Tratamiento de Datos</h2><p>Texto provisional. El administrador debe actualizar esto.</p>'),
                ('terms_conditions', '<h2>Términos y Condiciones</h2><p>Texto provisional. El administrador debe actualizar esto.</p>')
            `);
        }
    });

    // 8. Tabla de Auditoría (Logs V10)
    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT,
        details TEXT,
        created_at TEXT
    )`);

    // --- INICIALIZACIÓN DE DATOS SEMILLA (Si está vacío) ---
    
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (row && row.count === 0) {
            const adminId = uuidv4();
            db.run("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)", 
                [adminId, 'admin@check.com', 'admin123', 'ADMIN', 'APPROVED', new Date().toISOString()]);
            
            console.log("Admin por defecto creado con ID:", adminId);
        }
    });

});

module.exports = db;
