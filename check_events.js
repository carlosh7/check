const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, 'check_app.db');
const db = new Database(dbPath);

try {
    const count = db.prepare("SELECT COUNT(*) as count FROM events").get();
    console.log("EVENT COUNT:", count.count);
    if (count.count > 0) {
        const rows = db.prepare("SELECT * FROM events LIMIT 5").all();
        console.log("SAMPLE ROWS:", JSON.stringify(rows, null, 2));
    }
} catch (e) {
    console.error("ERROR:", e);
}
db.close();
