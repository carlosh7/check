const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, 'check_app.db');
const db = new Database(dbPath);

console.log("Migrando tabla events...");
try {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
        // 1. Crear tabla temporal con FK correcta
        db.prepare(`CREATE TABLE events_v1044 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT,
            date TEXT,
            end_date TEXT,
            location TEXT,
            logo_url TEXT,
            description TEXT,
            status TEXT DEFAULT 'ACTIVE',
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`).run();

        // 2. Copiar datos (mapeando columnas)
        db.prepare(`INSERT INTO events_v1044 (id, user_id, name, date, end_date, location, logo_url, description, status, created_at)
                    SELECT id, user_id, name, date, end_date, location, logo_url, description, status, created_at FROM events`).run();

        // 3. Eliminar tabla vieja y renombrar
        db.prepare(`DROP TABLE events`).run();
        db.prepare(`ALTER TABLE events_v1044 RENAME TO events`).run();
        
        console.log("Migración completada con éxito.");
    })();
} catch (e) {
    console.error("ERROR EN MIGRACIÓN:", e.message);
} finally {
    db.pragma('foreign_keys = ON');
    db.close();
}
