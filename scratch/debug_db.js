const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_PATH = process.env.DATA_PATH || '/home/carlosh/check/persistence';
const dbPath = path.join(DATA_PATH, 'database.db');

console.log('--- DB DEBUG ---');
console.log('Path:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error('ERROR: DB file not found!');
    process.exit(1);
}

try {
    const db = new Database(dbPath);
    const tables = ['groups', 'events', 'users', 'clients'];
    
    tables.forEach(table => {
        try {
            const columns = db.prepare(`PRAGMA table_info(${table})`).all();
            console.log(`\nTable: ${table}`);
            columns.forEach(c => {
                console.log(`  - ${c.name} (${c.type}) ${c.notnull ? 'NOT NULL' : ''}`);
            });
        } catch (e) {
            console.error(`Error reading table ${table}:`, e.message);
        }
    });

    // Check if table 'groups' is empty or missing
    const groupCount = db.prepare("SELECT count(*) as count FROM groups").get();
    console.log('\nGroups count:', groupCount.count);

    db.close();
} catch (e) {
    console.error('Fatal DB Error:', e.message);
}
