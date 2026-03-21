const { db } = require('./database');
const { v4: uuidv4 } = require('uuid');

const castId = (tableName, id) => {
    if (id === null || id === undefined) return id;
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const idCol = info.find(c => c.name === 'id');
        if (idCol && idCol.type === 'INTEGER' && !isNaN(id)) return parseInt(id, 10);
        return id;
    } catch(e) { return id; }
};

const eId = castId('events', '6');
console.log('Testing eId:', eId);

try {
    const gen = db.prepare(`
        SELECT 
            COUNT(*) as total, 
            SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checkedIn, 
            COUNT(DISTINCT organization) as orgs, 
            SUM(CASE WHEN is_new_registration = 1 THEN 1 ELSE 0 END) as onsite 
        FROM guests WHERE event_id = ?
    `).get(eId);
    console.log('Gen Stats:', gen);

    const health = db.prepare("SELECT COUNT(*) as health FROM guests WHERE event_id = ? AND (dietary_notes IS NOT NULL AND dietary_notes != '')").get(eId);
    console.log('Health Stats:', health);

    const mailingStats = db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as errors
        FROM email_queue WHERE event_id = ?
    `).get(eId);
    console.log('Mailing Stats:', mailingStats);

    process.exit(0);
} catch (e) {
    console.error('CRASH DETECTED:', e);
    process.exit(1);
}
