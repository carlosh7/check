const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
try {
    const columns = db.prepare("PRAGMA table_info(guests)").all();
    console.log(JSON.stringify(columns, null, 2));
} catch (e) {
    console.error(e.message);
} finally {
    db.close();
}
