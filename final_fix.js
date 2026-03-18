const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('check_app.db');

db.serialize(() => {
    db.run("UPDATE events SET status = 'ACTIVE' WHERE status IS NULL OR status = ''", function(err) {
        if (err) console.error(err.message);
        console.log(`Updated ${this.changes} rows.`);
        db.close();
    });
});
