const { db } = require('../../database');
const { v4: uuidv4 } = require('uuid');

function logChange(eventId, entityType, entityId, action, fieldName, oldValue, newValue, userId) {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO change_log (id, event_id, entity_type, entity_id, action, field_name, old_value, new_value, user_id, undone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`).run(id, eventId, entityType, entityId, action, fieldName,
            oldValue != null ? String(oldValue) : null,
            newValue != null ? String(newValue) : null,
            userId || null, now);
    return id;
}

function getChanges(eventId, limit = 100) {
    const rows = db.prepare(`SELECT cl.*, u.display_name AS user_name
        FROM change_log cl
        LEFT JOIN users u ON u.id = cl.user_id
        WHERE cl.event_id = ?
        ORDER BY cl.created_at DESC
        LIMIT ?`).all(eventId, Math.min(limit, 500));
    return rows;
}

function getChange(changeId) {
    return db.prepare(`SELECT * FROM change_log WHERE id = ?`).get(changeId);
}

function undoChange(changeId) {
    const change = getChange(changeId);
    if (!change) return { error: 'Cambio no encontrado' };
    if (change.undone) return { error: 'El cambio ya fue deshecho' };
    if (!change.old_value) return { error: 'No hay datos anteriores para restaurar' };
    const targetDb = require('./database-manager').getEventConnection || (() => db);
    const tdb = change.event_id ? (targetDb(change.event_id) || db) : db;
    try {
        if (change.entity_type === 'guest') {
            if (change.action === 'checked_in') {
                tdb.prepare("UPDATE guests SET checked_in = 0, checkin_time = NULL WHERE id = ?").run(change.entity_id);
            } else if (change.action === 'unchecked_in') {
                tdb.prepare("UPDATE guests SET checked_in = 1, checkin_time = ? WHERE id = ?").run(change.old_value, change.entity_id);
            } else if (change.action === 'status_changed') {
                tdb.prepare("UPDATE guests SET status = ? WHERE id = ?").run(change.old_value, change.entity_id);
            } else if (change.action === 'category_changed') {
                tdb.prepare("UPDATE guests SET category_id = ? WHERE id = ? AND event_id = ?").run(change.old_value || null, change.entity_id, change.event_id);
            } else if (change.action === 'profile_updated' && change.field_name) {
                tdb.prepare(`UPDATE guests SET ${change.field_name} = ? WHERE id = ?`).run(change.old_value, change.entity_id);
            }
        } else if (change.entity_type === 'event' && change.action === 'updated') {
            const event = tdb.prepare("SELECT * FROM events WHERE id = ?").get(change.entity_id);
            if (event) {
                const oldData = JSON.parse(change.old_value);
                tdb.prepare("UPDATE events SET name = ?, date = ?, location = ? WHERE id = ?").run(
                    oldData.name || event.name, oldData.date || event.date, oldData.location || event.location, change.entity_id
                );
            }
        }
        db.prepare("UPDATE change_log SET undone = 1 WHERE id = ?").run(changeId);
        return { success: true, action: 'undone' };
    } catch (err) {
        return { error: err.message };
    }
}

function redoChange(changeId) {
    const change = getChange(changeId);
    if (!change) return { error: 'Cambio no encontrado' };
    if (!change.undone) return { error: 'El cambio no ha sido deshecho' };
    if (!change.new_value) return { error: 'No hay datos nuevos para restaurar' };
    const targetDb = require('./database-manager').getEventConnection || (() => db);
    const tdb = change.event_id ? (targetDb(change.event_id) || db) : db;
    try {
        if (change.entity_type === 'guest') {
            if (change.action === 'checked_in') {
                tdb.prepare("UPDATE guests SET checked_in = 1, checkin_time = ? WHERE id = ?").run(change.new_value, change.entity_id);
            } else if (change.action === 'unchecked_in') {
                tdb.prepare("UPDATE guests SET checked_in = 0, checkin_time = NULL WHERE id = ?").run(change.entity_id);
            } else if (change.action === 'status_changed') {
                tdb.prepare("UPDATE guests SET status = ? WHERE id = ?").run(change.new_value, change.entity_id);
            } else if (change.action === 'category_changed') {
                tdb.prepare("UPDATE guests SET category_id = ? WHERE id = ? AND event_id = ?").run(change.new_value || null, change.entity_id, change.event_id);
            } else if (change.action === 'profile_updated' && change.field_name) {
                tdb.prepare(`UPDATE guests SET ${change.field_name} = ? WHERE id = ?`).run(change.new_value, change.entity_id);
            }
        } else if (change.entity_type === 'event' && change.action === 'updated') {
            const newData = JSON.parse(change.new_value);
            tdb.prepare("UPDATE events SET name = ?, date = ?, location = ? WHERE id = ?").run(
                newData.name, newData.date, newData.location, change.entity_id
            );
        }
        db.prepare("UPDATE change_log SET undone = 0 WHERE id = ?").run(changeId);
        return { success: true, action: 'redone' };
    } catch (err) {
        return { error: err.message };
    }
}

module.exports = { logChange, getChanges, getChange, undoChange, redoChange };
