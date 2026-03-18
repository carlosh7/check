const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('check_app.db');

db.all("PRAGMA table_info(events)", (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log("COLUMNS IN 'events' TABLE:");
    rows.forEach(row => console.log(`- ${row.name} (${row.type})`));
    
    db.all("SELECT id, name, created_at FROM events LIMIT 5", (err, events) => {
        if (err) {
            console.error("Error fetching events:", err.message);
        } else {
            console.log("\nSAMPLE EVENTS:");
            console.table(events);
        }
        db.close();
    });
});
