/**
 * Utilidades del servidor
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');

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

module.exports = {
    getValidId,
    castId,
    successResponse,
    errorResponse,
    getProducerGroups
};
