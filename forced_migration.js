const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('check_app.db');

db.serialize(() => {
    console.log("Starting forced migration...");

    // 1. Verificar tabla events
    db.all("PRAGMA table_info(events)", (err, columns) => {
        const hasStatus = columns.some(c => c.name === 'status');
        const hasDbName = columns.some(c => c.name === 'db_name');
        const hasCreatedAt = columns.some(c => c.name === 'created_at');

        if (hasDbName && !hasStatus) {
            console.log("Renaming 'db_name' to 'status'...");
            db.run("ALTER TABLE events RENAME COLUMN db_name TO status", (err) => {
                if (err) console.error("Error renaming db_name:", err.message);
            });
        } else if (!hasStatus) {
            console.log("Adding 'status' column...");
            db.run("ALTER TABLE events ADD COLUMN status TEXT DEFAULT 'ACTIVE'", (err) => {
                if (err) console.error("Error adding status:", err.message);
            });
        }

        if (!hasCreatedAt) {
            console.log("Adding 'created_at' column...");
            db.run("ALTER TABLE events ADD COLUMN created_at TEXT", (err) => {
                if (err) console.error("Error adding created_at:", err.message);
            });
        }

        // 2. Limpiar valores basura
        db.run("UPDATE events SET status = 'ACTIVE' WHERE status IS NULL OR status = '' OR status = 'undefined' OR status = 'UNDEFINED'", function(err) {
            console.log(`Updated ${this.changes} rows to 'ACTIVE' status.`);
        });

        // 3. Finalizar
        console.log("Migration finished.");
        
        db.all("SELECT id, name, status FROM events", (err, rows) => {
            console.table(rows);
            db.close();
        });
    });
});
