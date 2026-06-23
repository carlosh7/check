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

module.exports = { getEventDb };
