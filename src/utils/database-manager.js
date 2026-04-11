/**
 * Database Manager - Sistema de Gestión de Múltiples Bases de Datos
 * 
 * Este módulo permite crear y gestionar bases de datos independientes por evento.
 * Cada evento puede tener su propia base de datos para aislar sus datos.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Directorio de datos (V12.44.341 - Soporte para persistencia absoluta externa)
// DATA_PATH en portainer es /usr/src/app/persistence, entonces las BDs de eventos van en /usr/src/app/persistence/events
const DATA_DIR = process.env.DATA_PATH ? path.resolve(process.env.DATA_PATH, 'events') : '/usr/src/app/persistence/events';
const EVENTS_DIR = DATA_DIR;
console.log('[DB-MANAGER] Directorio de eventos configurado en:', EVENTS_DIR);

// Cache de conexiones activas
const connectionCache = new Map();

/**
 * Asegurar que el directorio de eventos exista
 */
function ensureEventsDir() {
    if (!fs.existsSync(EVENTS_DIR)) {
        try {
            fs.mkdirSync(EVENTS_DIR, { recursive: true });
            console.log('✓ Directorio de eventos creado/verificado:', EVENTS_DIR);
        } catch (e) {
            console.error('✗ ERROR CRÍTICO creando directorio de eventos:', EVENTS_DIR, e.message);
            // Si falla, intentamos usar una ruta local como último recurso para evitar crash, 
            // aunque no sea persistente fuera del contenedor.
        }
    }
}

/**
 * Obtener la ruta de la base de datos de un evento
 * @param {string} eventId - ID del evento
 * @returns {string} Ruta de la base de datos
 */
function getEventDbPath(eventId) {
    const dbPath = path.join(EVENTS_DIR, `${eventId}.db`);
    // console.log(`[DB-MANAGER] Ruta calculada para ${eventId}: ${path.resolve(dbPath)}`);
    return dbPath;
}

/**
 * Verificar si existe una base de datos para un evento
 * @param {string} eventId - ID del evento
 * @returns {boolean}
 */
function eventDatabaseExists(eventId) {
    const dbPath = getEventDbPath(eventId);
    const exists = fs.existsSync(dbPath);
    console.log('[DB-EXISTS] Verificando DB para evento:', eventId);
    console.log('[DB-EXISTS] Ruta:', dbPath);
    console.log('[DB-EXISTS] Existe:', exists);
    return exists;
}

/**
 * Obtener una conexión a la base de datos de un evento (con cache)
 * @param {string} eventId - ID del evento
 * @returns {Database|null} Conexión a la base de datos o null si no existe
 */
function getEventConnection(eventId) {
    if (!eventId) return null;
    
    // Verificar si ya hay una conexión en cache
    if (connectionCache.has(eventId)) {
        return connectionCache.get(eventId);
    }
    
    // Verificar si existe la base de datos
    if (!eventDatabaseExists(eventId)) {
        return null;
    }
    
    try {
        const dbPath = getEventDbPath(eventId);
        const db = new Database(dbPath);
        
        // Configurar modo WAL para mejor rendimiento
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        
        // Guardar en cache
        connectionCache.set(eventId, db);
        
        // --- AUTO-REPARACIÓN (V12.44.335) ---
        repairEventDatabase(db, eventId);
        
        console.log('✓ Conexión a base de datos del evento:', eventId);
        return db;
    } catch (error) {
        const errorMsg = `✗ Error al conectar con base de datos del evento ${eventId}: ${error.message}${error.code ? ' ('+error.code+')' : ''}`;
        console.error(errorMsg);
        // Guardar el último error para diagnóstico
        global.lastDbError = errorMsg;
        return null;
    }
}

/**
 * Crear una nueva base de datos para un evento
 * @param {string} eventId - ID del evento
 * @returns {Database|null} Conexión creada o null si falló
 */
function createEventDatabase(eventId) {
    if (!eventId) {
        console.error('✗ Event ID requerido para crear base de datos');
        return null;
    }
    
    // Verificar si ya existe
    if (eventDatabaseExists(eventId)) {
        console.log('⚠ La base de datos del evento ya existe:', eventId);
        return getEventConnection(eventId);
    }
    
    ensureEventsDir();
    
    const dbPath = getEventDbPath(eventId);
    
    try {
        const db = new Database(dbPath);
        
        // Configurar modo WAL
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        
        // Crear tablas específicas del evento
        createEventTables(db, eventId);
        
        // Guardar en cache
        connectionCache.set(eventId, db);
        
        // --- AUTO-REPARACIÓN (V12.44.335) ---
        repairEventDatabase(db, eventId);
        
        console.log('✓ Base de datos del evento creada:', eventId);
        return db;
    } catch (error) {
        const errorMsg = `✗ Error al crear base de datos del evento ${eventId}: ${error.message}${error.code ? ' ('+error.code+')' : ''}`;
        console.error(errorMsg);
        global.lastDbError = errorMsg;
        return null;
    }
}

/**
 * Crear las tablas para una base de datos de evento
 * @param {Database} db - Conexión a la base de datos
 * @param {string} eventId - ID del evento
 */
function createEventTables(db, eventId) {
    // Tabla de invitados del evento
    db.exec(`
        CREATE TABLE IF NOT EXISTS guests (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            organization TEXT,
            position TEXT,
            cargo TEXT,
            gender TEXT DEFAULT 'O',
            dietary_notes TEXT,
            restricciones TEXT,
            vegano TEXT DEFAULT 'NO',
            is_new_registration INTEGER DEFAULT 0,
            checked_in INTEGER DEFAULT 0,
            checkin_time TEXT,
            qr_token TEXT UNIQUE,
            validated INTEGER DEFAULT 0,
            validated_at TEXT,
            validated_by TEXT,
            unsubscribed INTEGER DEFAULT 0,
            unsubscribe_token TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Tabla de pre-registros
    db.exec(`
        CREATE TABLE IF NOT EXISTS pre_registrations (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            organization TEXT,
            position TEXT,
            gender TEXT DEFAULT 'O',
            dietary_notes TEXT,
            status TEXT DEFAULT 'PENDING',
            registered_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabla de ruletas
    db.exec(`
        CREATE TABLE IF NOT EXISTS event_wheels (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            name TEXT NOT NULL,
            config TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT,
            updated_at TEXT
        )
    `);
    
    // Tabla de participantes de ruleta
    db.exec(`
        CREATE TABLE IF NOT EXISTS wheel_participants (
            id TEXT PRIMARY KEY,
            wheel_id TEXT,
            guest_id TEXT,
            name TEXT,
            email TEXT,
            phone TEXT,
            source TEXT DEFAULT 'manual',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (wheel_id) REFERENCES event_wheels(id)
        )
    `);
    
    // Tabla de giros de ruleta
    db.exec(`
        CREATE TABLE IF NOT EXISTS wheel_spins (
            id TEXT PRIMARY KEY,
            wheel_id TEXT,
            participant_id TEXT,
            winner_name TEXT,
            winner_email TEXT,
            ip_address TEXT,
            created_at TEXT,
            FOREIGN KEY (wheel_id) REFERENCES event_wheels(id)
        )
    `);
    
    // Tabla de leads de ruleta
    db.exec(`
        CREATE TABLE IF NOT EXISTS wheel_leads (
            id TEXT PRIMARY KEY,
            wheel_id TEXT,
            name TEXT,
            email TEXT,
            phone TEXT,
            company TEXT,
            source_url TEXT,
            created_at TEXT,
            FOREIGN KEY (wheel_id) REFERENCES event_wheels(id)
        )
    `);
    
    // Tabla de encuestas
    db.exec(`
        CREATE TABLE IF NOT EXISTS surveys (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            question TEXT,
            type TEXT DEFAULT 'stars',
            options TEXT
        )
    `);
    
    // Tabla de respuestas de encuestas
    db.exec(`
        CREATE TABLE IF NOT EXISTS survey_responses (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            guest_id TEXT,
            responses_json TEXT,
            submitted_at TEXT,
            FOREIGN KEY (guest_id) REFERENCES guests(id)
        )
    `);
    
    // Tabla de agenda del evento
    db.exec(`
        CREATE TABLE IF NOT EXISTS event_agenda (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            start_time TEXT,
            end_time TEXT,
            speaker TEXT,
            location TEXT,
            duration TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT
        )
    `);
    
    // Tabla de sugerencias de invitados
    db.exec(`
        CREATE TABLE IF NOT EXISTS guest_suggestions (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            guest_id TEXT,
            suggestion TEXT,
            submitted_at TEXT,
            FOREIGN KEY (guest_id) REFERENCES guests(id)
        )
    `);
    
    // Crear índices para mejor rendimiento
    const indices = [
        "CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_guests_qr_token ON guests(qr_token)",
        "CREATE INDEX IF NOT EXISTS idx_guests_checked_in ON guests(checked_in)",
        "CREATE INDEX IF NOT EXISTS idx_pre_registrations_event ON pre_registrations(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_event_wheels_event ON event_wheels(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_surveys_event ON surveys(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_survey_responses_event ON survey_responses(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_event_agenda_event ON event_agenda(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email)"
    ];
    
    for (const sql of indices) {
        try { db.exec(sql); } catch (_) {}
    }
    
    console.log('✓ Tablas del evento creadas:', eventId);
}

/**
 * Repara el esquema de una base de datos de evento si tiene restricciones corruptas
 * @param {Database} db - Conexión a la base de datos
 * @param {string} eventId - ID del evento
 */
function repairEventDatabase(db, eventId) {
    try {
        // 0. Verificar versión del esquema (User Version)
        // Esto evita que el sistema intente reparar en cada recarga.
        const currentVersion = db.pragma('user_version', { simple: true });
        if (currentVersion >= 337) {
            // console.log(`[MIGRATION] Saltando reparación de ${eventId}, esquema ya validado (v${currentVersion})`);
            return;
        }

        // 1. Detectar si existe el problema de la llave foránea fantasma mediante SQL RAW
        // Esto es infalible porque lee el código fuente original de la base de datos
        const poisonedTables = db.prepare(`
            SELECT name, sql 
            FROM sqlite_master 
            WHERE type='table' 
            AND sql LIKE '%REFERENCES events(id)%'
        `).all();

        if (poisonedTables.length > 0) {
            console.warn(`⚠️ [REPAIR] Detectadas ${poisonedTables.length} tablas con SQL corrupto en evento ${eventId}. Iniciando auto-sanación...`);
            
            db.transaction(() => {
                // DESACTIVAR FK temporalmente para poder renombrar y recrear tablas sin errores
                db.pragma('foreign_keys = OFF');

                for (const row of poisonedTables) {
                    const table = row.name;
                    console.log(`🔧 [REPAIR] Reconstruyendo tabla: ${table}`);
                    
                    // 1. Renombrar tabla vieja
                    db.exec(`ALTER TABLE ${table} RENAME TO ${table}_old`);
                    
                    // 2. Recrear tablas usando la función estándar (v12.44.334+ ya no tiene las FKs)
                    // Nota: createEventTables usa CREATE TABLE IF NOT EXISTS
                    // Como acabamos de renombrar la original, esto creará una NUEVA tabla limpia.
                    createEventTables(db, eventId);
                    
                    // 3. Migrar datos de forma robusta
                    const columns = db.prepare(`PRAGMA table_info(${table}_old)`).all().map(c => c.name);
                    const newCols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
                    const commonCols = columns.filter(c => newCols.includes(c));
                    
                    if (commonCols.length > 0) {
                        const colsStr = commonCols.join(', ');
                        db.exec(`INSERT INTO ${table} (${colsStr}) SELECT ${colsStr} FROM ${table}_old`);
                        console.log(`✅ [REPAIR] Migrados ${commonCols.length} campos en tabla ${table}`);
                    }
                    
                    // 4. ELIMINAR tabla vieja
                    db.exec(`DROP TABLE ${table}_old`);
                }

                // 2. Marcar como reparada (User Version 337)
                db.pragma('user_version = 337');
                
                // REACTIVAR FK
                db.pragma('foreign_keys = ON');
            })();

            console.log(`✅ [REPAIR] Auto-sanación completada para evento ${eventId}. Las restricciones rotas han sido eliminadas.`);
        } else {
            // Si no estaba envenenada pero no tenía versión, marcarla para el futuro
            db.pragma('user_version = 337');
        }
    } catch (error) {
        console.error(`✗ [REPAIR] Falló la auto-sanación de ${eventId}:`, error.message);
    }
}

/**
 * Eliminar la base de datos de un evento
 * @param {string} eventId - ID del evento
 * @returns {boolean} true si se eliminó correctamente
 */
function deleteEventDatabase(eventId) {
    if (!eventId) {
        console.error('✗ Event ID requerido para eliminar base de datos');
        return false;
    }
    
    // Cerrar conexión si está en cache
    if (connectionCache.has(eventId)) {
        const db = connectionCache.get(eventId);
        try {
            db.close();
        } catch (_) {}
        connectionCache.delete(eventId);
    }
    
    const dbPath = getEventDbPath(eventId);
    
    if (!fs.existsSync(dbPath)) {
        console.log('⚠ La base de datos del evento no existe:', eventId);
        return false;
    }
    
    try {
        fs.unlinkSync(dbPath);
        console.log('✓ Base de datos del evento eliminada:', eventId);
        return true;
    } catch (error) {
        console.error('✗ Error al eliminar base de datos del evento:', eventId, error.message);
        return false;
    }
}

/**
 * Obtener lista de bases de datos de eventos existentes
 * @returns {string[]} Array de IDs de eventos con base de datos
 */
function getEventDatabases() {
    ensureEventsDir();
    
    const files = fs.readdirSync(EVENTS_DIR);
    return files
        .filter(f => f.endsWith('.db'))
        .map(f => f.replace('.db', ''));
}

/**
 * Cerrar todas las conexiones en cache
 */
function closeAllConnections() {
    for (const [eventId, db] of connectionCache) {
        try {
            db.close();
            console.log('✓ Conexión cerrada:', eventId);
        } catch (_) {}
    }
    connectionCache.clear();
}

/**
 * Obtener información de la base de datos de un evento
 * @param {string} eventId - ID del evento
 * @returns {object|null} Información de la base de datos
 */
function getEventDatabaseInfo(eventId) {
    const dbPath = getEventDbPath(eventId);
    
    if (!fs.existsSync(dbPath)) {
        return null;
    }
    
    try {
        const stats = fs.statSync(dbPath);
        return {
            eventId,
            path: dbPath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
        };
    } catch (error) {
        console.error('✗ Error al obtener info de base de datos:', error.message);
        return null;
    }
}

// Inicializar directorio de eventos
ensureEventsDir();

// Exportar funciones
module.exports = {
    getEventDbPath,
    eventDatabaseExists,
    getEventConnection,
    createEventDatabase,
    deleteEventDatabase,
    getEventDatabases,
    closeAllConnections,
    getEventDatabaseInfo,
    ensureEventsDir
};