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

// Cache de conexiones activas (max 50, purge cada 10 min)
const connectionCache = new Map();
const MAX_CONNECTIONS = 50;
setInterval(() => {
    if (connectionCache.size > MAX_CONNECTIONS) {
        const entries = [...connectionCache.entries()];
        const toClose = entries.slice(0, connectionCache.size - MAX_CONNECTIONS);
        for (const [id, conn] of toClose) {
            try { conn.close(); } catch(e) {}
            connectionCache.delete(id);
        }
    }
}, 600000).unref();

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
        
        // --- MIGRACIONES GLOBALES (se ejecutan siempre al abrir BD de evento) ---
        try {
            const cols = db.prepare("PRAGMA table_info(guests)").all().map(c => c.name);
            if (!cols.includes('status')) {
                db.exec("ALTER TABLE guests ADD COLUMN status TEXT DEFAULT 'lead'");
            }
            if (!cols.includes('category_id')) {
                db.exec("ALTER TABLE guests ADD COLUMN category_id TEXT");
            }
            if (!cols.includes('waitlist_position')) {
                db.exec("ALTER TABLE guests ADD COLUMN waitlist_position INTEGER");
                db.exec("ALTER TABLE guests ADD COLUMN promoted_at TEXT");
                db.exec("ALTER TABLE guests ADD COLUMN waitlisted_at TEXT");
            }
        } catch (_) {}
        try {
            db.exec(`CREATE TABLE IF NOT EXISTS guest_status_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guest_id TEXT,
                event_id TEXT,
                from_status TEXT,
                to_status TEXT,
                changed_by TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);
            db.exec("CREATE INDEX IF NOT EXISTS idx_status_log_guest ON guest_status_log(guest_id)");
        } catch (_) {}
        try {
            db.exec(`CREATE TABLE IF NOT EXISTS guest_categories (
                id TEXT PRIMARY KEY,
                event_id TEXT,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#64748b',
                capacity INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);
            db.exec("CREATE INDEX IF NOT EXISTS idx_guest_categories_event ON guest_categories(event_id)");
        } catch (_) {}
        try {
            db.exec(`CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY, event_id TEXT, title TEXT NOT NULL,
                description TEXT, date TEXT, start_time TEXT, end_time TEXT,
                capacity INTEGER DEFAULT 0, location TEXT, sort_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);
            db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_event ON sessions(event_id)");
            try { db.exec("ALTER TABLE sessions ADD COLUMN layout_id TEXT"); } catch (_) {}
        } catch (_) {}
        try {
            db.exec(`CREATE TABLE IF NOT EXISTS session_guests (
                id TEXT PRIMARY KEY, session_id TEXT, guest_id TEXT, event_id TEXT,
                seat_id TEXT,
                checked_in INTEGER DEFAULT 0, checkin_time TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(session_id, guest_id)
            )`);
            db.exec("CREATE INDEX IF NOT EXISTS idx_session_guests_session ON session_guests(session_id)");
            db.exec("CREATE INDEX IF NOT EXISTS idx_session_guests_guest ON session_guests(guest_id)");
            try { db.exec("ALTER TABLE session_guests ADD COLUMN seat_id TEXT"); } catch (_) {}
        } catch (_) {}
        try {
            db.exec(`CREATE TABLE IF NOT EXISTS seat_layouts (
                id TEXT PRIMARY KEY, event_id TEXT, name TEXT NOT NULL,
                config TEXT NOT NULL DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);
            db.exec("CREATE INDEX IF NOT EXISTS idx_seat_layouts_event ON seat_layouts(event_id)");
        } catch (_) {}
        
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
            status TEXT DEFAULT 'lead',
            category_id TEXT,
            waitlist_position INTEGER,
            promoted_at TEXT,
            waitlisted_at TEXT,
            is_new_registration INTEGER DEFAULT 0,
            checked_in INTEGER DEFAULT 0,
            checkin_time TEXT,
            qr_token TEXT UNIQUE,
            validated INTEGER DEFAULT 0,
            validated_at TEXT,
            validated_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Migracion: agregar columna status si no existe (eventos pre-existentes)
    try {
        const columns = db.prepare("PRAGMA table_info(guests)").all().map(c => c.name);
        if (!columns.includes('status')) {
            db.exec("ALTER TABLE guests ADD COLUMN status TEXT DEFAULT 'lead'");
        }
    } catch (_) {}
    
    // Tabla de log de cambios de estado del pipeline
    db.exec(`
        CREATE TABLE IF NOT EXISTS guest_status_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_id TEXT,
            event_id TEXT,
            from_status TEXT,
            to_status TEXT,
            changed_by TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_status_log_guest ON guest_status_log(guest_id)"); } catch (_) {}
    
    // Tabla de categorias de invitados
    db.exec(`
        CREATE TABLE IF NOT EXISTS guest_categories (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#64748b',
            capacity INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_guest_categories_event ON guest_categories(event_id)"); } catch (_) {}
    
    // Tabla de sesiones
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            date TEXT,
            start_time TEXT,
            end_time TEXT,
            capacity INTEGER DEFAULT 0,
            location TEXT,
            layout_id TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_event ON sessions(event_id)"); } catch (_) {}
    
    // Tabla de registro de invitados a sesiones
    db.exec(`
        CREATE TABLE IF NOT EXISTS session_guests (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            guest_id TEXT,
            event_id TEXT,
            checked_in INTEGER DEFAULT 0,
            checkin_time TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(session_id, guest_id)
        )
    `);
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_session_guests_session ON session_guests(session_id)"); } catch (_) {}
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_session_guests_guest ON session_guests(guest_id)"); } catch (_) {}
    
    // Tabla de planos de sala (seat maps)
    db.exec(`
        CREATE TABLE IF NOT EXISTS seat_layouts (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            name TEXT NOT NULL,
            config TEXT NOT NULL DEFAULT '{}',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_seat_layouts_event ON seat_layouts(event_id)"); } catch (_) {}
    
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
            template_id TEXT,
            event_id TEXT,
            guest_id TEXT,
            answers_json TEXT,
            responses_json TEXT,
            time_spent_seconds INTEGER,
            device TEXT,
            ip_address TEXT,
            submitted_at TEXT,
            FOREIGN KEY (guest_id) REFERENCES guests(id)
        )
    `);
    
    // Tabla de encuestas en vivo (C11-01 Gamificación)
    db.exec(`
        CREATE TABLE IF NOT EXISTS polls (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            session_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT DEFAULT 'single',
            status TEXT DEFAULT 'draft',
            points INTEGER DEFAULT 10,
            time_limit_seconds INTEGER DEFAULT 0,
            correct_answer TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS poll_options (
            id TEXT PRIMARY KEY,
            poll_id TEXT NOT NULL,
            label TEXT NOT NULL,
            order_index INTEGER DEFAULT 0,
            is_correct INTEGER DEFAULT 0,
            FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS poll_votes (
            id TEXT PRIMARY KEY,
            poll_id TEXT NOT NULL,
            guest_id TEXT,
            option_id TEXT,
            answer_text TEXT,
            voted_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
            FOREIGN KEY (guest_id) REFERENCES guests(id)
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS leaderboard (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            guest_id TEXT NOT NULL,
            points INTEGER DEFAULT 0,
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (guest_id) REFERENCES guests(id),
            UNIQUE(event_id, guest_id)
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS point_history (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            guest_id TEXT NOT NULL,
            points INTEGER NOT NULL,
            reason TEXT,
            reference_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (guest_id) REFERENCES guests(id)
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS badges (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            icon TEXT DEFAULT '🏆',
            criteria TEXT,
            points_reward INTEGER DEFAULT 0
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS guest_badges (
            id TEXT PRIMARY KEY,
            badge_id TEXT NOT NULL,
            guest_id TEXT NOT NULL,
            earned_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
            FOREIGN KEY (guest_id) REFERENCES guests(id)
        )
    `);
    // Tabla de álbum de fotos (C11-07)
    db.exec(`
        CREATE TABLE IF NOT EXISTS event_photos (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            guest_id TEXT,
            filename TEXT,
            caption TEXT,
            approved INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (guest_id) REFERENCES guests(id)
        )
    `);
    // Tabla de conexiones de networking (C11-04)
    db.exec(`
        CREATE TABLE IF NOT EXISTS networking_connections (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            from_guest_id TEXT NOT NULL,
            to_guest_id TEXT NOT NULL,
            connected_at TEXT DEFAULT (datetime('now')),
            notes TEXT,
            FOREIGN KEY (from_guest_id) REFERENCES guests(id),
            FOREIGN KEY (to_guest_id) REFERENCES guests(id),
            UNIQUE(event_id, from_guest_id, to_guest_id)
        )
    `);
    // Tabla de plantillas de certificados (C11-08)
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            name TEXT NOT NULL,
            config TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS guest_certificates (
            id TEXT PRIMARY KEY,
            template_id TEXT NOT NULL,
            event_id TEXT NOT NULL,
            guest_id TEXT NOT NULL,
            generated_at TEXT DEFAULT (datetime('now')),
            download_count INTEGER DEFAULT 0,
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
    
    // Tabla de templates de encuesta
    db.exec(`
        CREATE TABLE IF NOT EXISTS survey_templates (
            id TEXT PRIMARY KEY, event_id TEXT NOT NULL,
            title TEXT NOT NULL, description TEXT,
            status TEXT DEFAULT 'draft', total_responses INTEGER DEFAULT 0,
            created_at TEXT, updated_at TEXT
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS survey_questions (
            id TEXT PRIMARY KEY, template_id TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'short_text', title TEXT NOT NULL,
            description TEXT, options_json TEXT,
            required INTEGER DEFAULT 1, order_index INTEGER DEFAULT 0,
            section TEXT, image_url TEXT,
            has_other INTEGER DEFAULT 0, conditional_json TEXT,
            created_at TEXT,
            FOREIGN KEY (template_id) REFERENCES survey_templates(id) ON DELETE CASCADE
        )
    `);
    // Tabla de sorteos
    db.exec(`
        CREATE TABLE IF NOT EXISTS raffles (
            id TEXT PRIMARY KEY, event_id TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'wheel', name TEXT NOT NULL,
            config_json TEXT, data_source TEXT DEFAULT 'guests',
            source_template_id TEXT, winner_count INTEGER DEFAULT 1,
            total_participants INTEGER DEFAULT 0, status TEXT DEFAULT 'draft',
            created_at TEXT, updated_at TEXT
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS raffle_participants (
            id TEXT PRIMARY KEY, raffle_id TEXT NOT NULL,
            guest_id TEXT, name TEXT, email TEXT, phone TEXT,
            source TEXT DEFAULT 'guests', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS raffle_results (
            id TEXT PRIMARY KEY, raffle_id TEXT NOT NULL,
            round INTEGER DEFAULT 1, winners_json TEXT NOT NULL DEFAULT '[]',
            total_participants INTEGER DEFAULT 0, label TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE
        )
    `);
    // Transactions table (F3-07)
    try { db.exec("ALTER TABLE guest_categories ADD COLUMN price REAL DEFAULT 0"); } catch (_) {}
    try {
        db.exec(`CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY, event_id TEXT NOT NULL,
            guest_id TEXT, category_id TEXT,
            amount REAL NOT NULL, currency TEXT DEFAULT 'USD',
            provider TEXT NOT NULL, provider_txn_id TEXT,
            status TEXT DEFAULT 'pending',
            guest_name TEXT, guest_email TEXT,
            metadata_json TEXT,
            created_at TEXT, completed_at TEXT,
            FOREIGN KEY (event_id) REFERENCES guests(event_id)
        )`);
    } catch (_) {}
    // Crear índices para mejor rendimiento
    const indices = [
        "CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_guests_qr_token ON guests(qr_token)",
        "CREATE INDEX IF NOT EXISTS idx_guests_checked_in ON guests(checked_in)",
        "CREATE INDEX IF NOT EXISTS idx_pre_registrations_event ON pre_registrations(event_id)",

        "CREATE INDEX IF NOT EXISTS idx_surveys_event ON surveys(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_survey_responses_event ON survey_responses(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_survey_responses_template ON survey_responses(template_id)",
        "CREATE INDEX IF NOT EXISTS idx_event_agenda_event ON event_agenda(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email)",
        "CREATE INDEX IF NOT EXISTS idx_survey_questions_template ON survey_questions(template_id)",
        "CREATE INDEX IF NOT EXISTS idx_survey_templates_event ON survey_templates(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_polls_event ON polls(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id)",
        "CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id)",
        "CREATE INDEX IF NOT EXISTS idx_poll_votes_guest ON poll_votes(guest_id)",
        "CREATE INDEX IF NOT EXISTS idx_leaderboard_event ON leaderboard(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_point_history_guest ON point_history(guest_id)",
        "CREATE INDEX IF NOT EXISTS idx_guest_badges_guest ON guest_badges(guest_id)",
        "CREATE INDEX IF NOT EXISTS idx_event_photos_event ON event_photos(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_networking_event ON networking_connections(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_networking_from ON networking_connections(from_guest_id)",
        "CREATE INDEX IF NOT EXISTS idx_networking_to ON networking_connections(to_guest_id)",
        "CREATE INDEX IF NOT EXISTS idx_cert_templates_event ON certificate_templates(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_guest_certificates_guest ON guest_certificates(guest_id)",
        "CREATE INDEX IF NOT EXISTS idx_raffles_event ON raffles(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_raffle_participants_raffle ON raffle_participants(raffle_id)",
        "CREATE INDEX IF NOT EXISTS idx_raffle_results_raffle ON raffle_results(raffle_id)",
        "CREATE INDEX IF NOT EXISTS idx_raffle_spins_raffle ON raffle_spins(raffle_id)",
        "CREATE INDEX IF NOT EXISTS idx_transactions_event ON transactions(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)",
        // Performance indexes (C2-09)
        "CREATE INDEX IF NOT EXISTS idx_guests_name ON guests(name)",
        "CREATE INDEX IF NOT EXISTS idx_guests_organization ON guests(organization)",
        "CREATE INDEX IF NOT EXISTS idx_guests_category ON guests(category_id)",
        "CREATE INDEX IF NOT EXISTS idx_guests_created ON guests(created_at)",
        "CREATE INDEX IF NOT EXISTS idx_sessions_event ON sessions(event_id)",
        "CREATE INDEX IF NOT EXISTS idx_session_guests_guest ON session_guests(guest_id)",
        "CREATE INDEX IF NOT EXISTS idx_guest_status_log_guest ON guest_status_log(guest_id)",
        "CREATE INDEX IF NOT EXISTS idx_guest_categories_event ON guest_categories(event_id)"
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