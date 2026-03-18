const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('check_app.db');

db.run("UPDATE events SET status = 'ACTIVE' WHERE status IS NULL OR status = '' OR status = 'undefined' OR status = 'UNDEFINED'", function(err) {
    if (err) {
        console.error("Error updating status:", err.message);
    } else {
        console.log(`Updated ${this.changes} events with invalid status.`);
    }
    
    db.all("SELECT id, name, status FROM events", (err, rows) => {
        console.log("\nCURRENT EVENTS STATE:");
        console.table(rows);
        db.close();
    });
});
