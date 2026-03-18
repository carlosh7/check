const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, 'check_app.db');
const db = new Database(dbPath);

try {
    const info = db.prepare("PRAGMA table_info(events)").all();
    console.log("TABLE INFO EVENTS:", JSON.stringify(info, null, 2));
} catch (e) {
    console.error("ERROR:", e);
}
db.close();
