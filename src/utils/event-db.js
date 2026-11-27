/**
 * Utilidad compartida para obtener la conexión BD de un evento
 * Reemplaza las copias de getEventDb() en cada archivo de rutas
 * @version 12.44.767
 */

const { db, getEventConnection, eventDatabaseExists } = require('../../database');

function getEventDb(eventId) {
    const event = db.prepare("SELECT id, has_own_db FROM events WHERE id = ?").get(eventId);
    if (event && event.has_own_db === 1 && eventDatabaseExists(eventId)) {
        return getEventConnection(eventId) || db;
    }
    return db;
}

// // v12.44.850 (auditoría 2026-11-25, D6)): mapa de invitados de un evento. Los invitados viven en la BD del evento (los eventos
// nuevos la traen por defecto); los módulos que consultaban solo la maestra no los veían.
function guestMap(eventId, cols) {
    const conn = getEventDb(eventId);
    const rows = conn.prepare('SELECT ' + (cols || 'id, name, email, organization, position, qr_token') + ' FROM guests WHERE event_id = ?').all(eventId);
    const map = new Map();
    for (const r of rows) map.set(r.id, r);
    return map;
}

// Busca un invitado por id en la BD de su evento (recorre las BDs de evento) y devuelve también la conexión
function findGuestAnywhere(guestId) {
    const events = db.prepare('SELECT id FROM events WHERE has_own_db = 1').all();
    for (const ev of events) {
        const conn = getEventDb(ev.id);
        const row = conn.prepare('SELECT * FROM guests WHERE id = ?').get(guestId);
        if (row) return { guest: row, conn: conn, eventId: ev.id };
    }
    const row = db.prepare('SELECT * FROM guests WHERE id = ?').get(guestId);
    return row ? { guest: row, conn: db, eventId: row.event_id } : null;
}

module.exports = { getEventDb, guestMap, findGuestAnywhere };
