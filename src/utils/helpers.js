/**
 * Utilidades del servidor
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../../database');

function getValidId(tableName) {
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const idCol = info.find(c => c.name === 'id');
        return (idCol && idCol.type === 'INTEGER') ? null : uuidv4();
    } catch(e) { return uuidv4(); }
}

function castId(tableName, id) {
    if (id === null || id === undefined) return id;
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const idCol = info.find(c => c.name === 'id');
        if (idCol && idCol.type === 'INTEGER' && !isNaN(id)) return parseInt(id, 10);
        return id;
    } catch(e) { return id; }
}

function successResponse(res, data = {}) {
    res.json({ success: true, ...data });
}

function errorResponse(res, status, message) {
    res.status(status).json({ success: false, error: message });
}

function getProducerGroups(userId) {
    try {
        const rows = db.prepare("SELECT group_id FROM group_users WHERE user_id = ?").all(userId);
        return rows.map(r => r.group_id).filter(Boolean);
    } catch(e) { return []; }
}

function hasEventAccess(userId, eventId, role) {
    if (role === 'ADMIN') return true;
    try {
        const event = db.prepare("SELECT group_id FROM events WHERE id = ?").get(eventId);
        if (!event) return false;
        if (event.group_id) {
            const groups = getProducerGroups(userId);
            return groups.includes(event.group_id);
        }
        const userEvents = db.prepare("SELECT 1 FROM user_events WHERE user_id = ? AND event_id = ?").get(userId, eventId);
        return !!userEvents;
    } catch(e) { return false; }
}

module.exports = {
    getValidId,
    castId,
    successResponse,
    errorResponse,
    getProducerGroups,
    hasEventAccess
};
