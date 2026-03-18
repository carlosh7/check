const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('check_app.db');

db.all("SELECT id, name, status FROM events", (err, rows) => {
    if (err) {
        console.error("Error reading events:", err.message);
    } else {
        console.log("FINAL EVENTS DATA:");
        console.table(rows);
    }
    db.close();
});
