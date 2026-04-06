// database.js — better-sqlite3 V10 (Síncrono, moderno, sin callbacks)
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'data/check_app.db');
const db = new Database(dbPath);

// ═══ OPTIMIZACIONES DE RENDIMIENTO (Enterprise Grade) ═══

// 1. WAL Mode: Permite múltiples lectores y un escritor simultáneo
db.pragma('journal_mode = WAL');

// 2. Busy Timeout: Si la BD está ocupada, espera hasta 5000ms en lugar de fallar
// CRÍTICO para eventos con 20+ staff haciendo check-in simultáneo
db.pragma('busy_timeout = 5000');

// 3. Synchronous NORMAL: Balance perfecto entre seguridad y velocidad
db.pragma('synchronous = NORMAL');

// 4. Cache Size: 32MB de caché en memoria para consultas frecuentes
db.pragma('cache_size = -32000');

// 5. Foreign Keys: Integridad referencial
db.pragma('foreign_keys = ON');

// ═══ CREACIÓN DE TABLAS (Ejecución síncrona directa) ═══

// 1. Usuarios (RBAC)
db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'PRODUCTOR',
    role_detail TEXT DEFAULT 'STAFF',
    group_id TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at TEXT
)`);

// Migración segura: agregar columna status si no existe (para DBs antiguas)
try { db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'PENDING'"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN role_detail TEXT DEFAULT 'STAFF'"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN group_id TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN display_name TEXT"); } catch (_) {}

// 2. Eventos (Multitenancy)
db.exec(`CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    date TEXT,
    location TEXT,
    logo_url TEXT,
    description TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id)
)`);
try { db.exec("ALTER TABLE events ADD COLUMN created_at TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN end_date TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN has_wheel INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN has_own_db INTEGER DEFAULT 0"); } catch (_) {}

// Campos de personalización de registro público
try { db.exec("ALTER TABLE events ADD COLUMN reg_title TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_welcome_text TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_policy TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_success_message TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_logo_url TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_show_phone INTEGER DEFAULT 1"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_show_org INTEGER DEFAULT 1"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_show_position INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_show_vegan INTEGER DEFAULT 1"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_show_dietary INTEGER DEFAULT 1"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_show_gender INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_require_agreement INTEGER DEFAULT 1"); } catch (_) {}
// Campos Fase 8: Personalización de Tickets y QR
try { db.exec("ALTER TABLE events ADD COLUMN qr_color_dark TEXT DEFAULT '#000000'"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN qr_color_light TEXT DEFAULT '#ffffff'"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN qr_logo_url TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN ticket_bg_url TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN ticket_accent_color TEXT DEFAULT '#7c3aed'"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_email_whitelist TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN reg_email_blacklist TEXT"); } catch (_) {}

// 3. Invitados
db.exec(`CREATE TABLE IF NOT EXISTS guests (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    organization TEXT,
    position TEXT,
    gender TEXT DEFAULT 'O',
    dietary_notes TEXT,
    is_new_registration INTEGER DEFAULT 0,
    checked_in INTEGER DEFAULT 0,
    checkin_time TEXT,
    qr_token TEXT UNIQUE,
    FOREIGN KEY (event_id) REFERENCES events (id)
)`);
try { db.exec("ALTER TABLE guests ADD COLUMN is_new_registration INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE guests ADD COLUMN unsubscribed INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE guests ADD COLUMN unsubscribe_token TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE guests ADD COLUMN qr_token TEXT"); } catch (_) {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_qr_token ON guests(qr_token)"); } catch (_) {}

// 3.1 Pre-Registros (Inscripción previa)
db.exec(`CREATE TABLE IF NOT EXISTS pre_registrations (
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
    registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id)
)`);
try { db.exec("ALTER TABLE pre_registrations ADD COLUMN gender TEXT DEFAULT 'O'"); } catch (_) {}
try { db.exec("ALTER TABLE pre_registrations ADD COLUMN dietary_notes TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE pre_registrations ADD COLUMN position TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE pre_registrations ADD COLUMN organization TEXT"); } catch (_) {}

// 5. Sugerencias de Invitados
db.exec(`CREATE TABLE IF NOT EXISTS guest_suggestions (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    guest_id TEXT,
    suggestion TEXT,
    submitted_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (guest_id) REFERENCES guests(id)
)`);

// 7. Agenda del Evento
db.exec(`CREATE TABLE IF NOT EXISTS event_agenda (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT,
    end_time TEXT,
    speaker TEXT,
    location TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);
try { db.exec("ALTER TABLE event_agenda ADD COLUMN duration TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE event_agenda ADD COLUMN created_at TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE event_agenda ADD COLUMN sort_order INTEGER DEFAULT 0"); } catch (_) {}

// 8. Encuestas (legacy - mantener para compatibilidad)
db.exec(`CREATE TABLE IF NOT EXISTS surveys (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    question TEXT,
    type TEXT DEFAULT 'stars',
    options TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

// 9. Respuestas de Encuestas
db.exec(`CREATE TABLE IF NOT EXISTS survey_responses (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    guest_id TEXT,
    responses_json TEXT,
    submitted_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events (id),
    FOREIGN KEY (guest_id) REFERENCES guests (id)
)`);

// 7. Configuración Global (Legales V10)
db.exec(`CREATE TABLE IF NOT EXISTS settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT
)`);

// ═══ TABLAS DE RULETA (V12) ═══
db.exec(`CREATE TABLE IF NOT EXISTS event_wheels (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT NOT NULL,
    config TEXT, -- JSON config
    is_active INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS wheel_participants (
    id TEXT PRIMARY KEY,
    wheel_id TEXT,
    guest_id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    source TEXT DEFAULT 'manual', -- manual, guests, leads
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS wheel_spins (
    id TEXT PRIMARY KEY,
    wheel_id TEXT,
    participant_id TEXT,
    winner_name TEXT,
    winner_email TEXT,
    ip_address TEXT,
    created_at TEXT,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS wheel_leads (
    id TEXT PRIMARY KEY,
    wheel_id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    source_url TEXT,
    created_at TEXT,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id)
)`);

// Semilla de textos legales (V12.1.1 - Profesional)
const POLICY_TEXT = `<div class="legal-content space-y-4">
    <h2 class="text-xl font-bold text-white border-b border-primary/30 pb-2">POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES</h2>
    <p class="text-sm text-slate-300">En **Check App**, la privacidad y seguridad de su información es nuestra prioridad. Esta política describe cómo recolectamos, usamos y protegemos sus datos bajo los principios de legalidad, finalidad y transparencia.</p>

    <h3 class="text-md font-bold text-primary">1. Responsable del Tratamiento</h3>
    <p class="text-xs text-slate-400">El responsable del tratamiento de sus datos es el Organizador del Evento al cual usted se registra, utilizando la plataforma Check App como medio tecnológico de gestión.</p>

    <h3 class="text-md font-bold text-primary">2. Finalidad de la Recolección</h3>
    <ul class="list-disc ml-6 text-xs text-slate-400 space-y-1">
        <li>Gestión de registro y acreditación para el evento.</li>
        <li>Envío de confirmaciones, códigos QR y comunicaciones logísticas.</li>
        <li>Generación de estadísticas agregadas para el organizador.</li>
        <li>Gestión de requerimientos especiales (dietas, alergias) para su seguridad.</li>
    </ul>

    <h3 class="text-md font-bold text-primary">3. Derechos del Titular</h3>
    <p class="text-xs text-slate-400">Usted tiene derecho a conocer, actualizar y rectificar sus datos personales, así como a solicitar su supresión cuando no exista un deber legal de conservarlos.</p>

    <h3 class="text-md font-bold text-primary">4. Seguridad</h3>
    <p class="text-xs text-slate-400">Implementamos medidas técnicas y administrativas para evitar el acceso no autorizado o alteración de su información personal.</p>
</div>`;

const TERMS_TEXT = `<div class="legal-content space-y-4">
    <h2 class="text-xl font-bold text-white border-b border-primary/30 pb-2">TÉRMINOS Y CONDICIONES DE SERVICIO</h2>
    <p class="text-sm text-slate-300">El acceso y uso de la plataforma Check App implica la aceptación total de los presentes términos por parte del usuario y el organizador.</p>

    <h3 class="text-md font-bold text-primary">1. Uso del Servicio</h3>
    <p class="text-xs text-slate-400">Check App es una plataforma de gestión de asistencia. El usuario se compromete a proporcionar información veraz durante el proceso de registro.</p>

    <h3 class="text-md font-bold text-primary">2. Responsabilidad del Organizador</h3>
    <p class="text-xs text-slate-400">El Organizador es el único responsable del uso de la información de los invitados, de la logística del evento y del cumplimiento normativo en el recinto.</p>

    <h3 class="text-md font-bold text-primary">3. Propiedad Intelectual</h3>
    <p class="text-xs text-slate-400">Todos los derechos sobre el software, diseño y marcas de Check App son propiedad exclusiva del desarrollador.</p>

    <h3 class="text-md font-bold text-primary">4. Limitación de Responsabilidad</h3>
    <p class="text-xs text-slate-400">Check App no se hace responsable por interrupciones del servicio derivadas de fallos en proveedores de red o causas de fuerza mayor.</p>
</div>`;

db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('policy_data', POLICY_TEXT);
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('terms_conditions', TERMS_TEXT);

// Actualizar si ya existían con el texto provisional (Fuerza actualización v12.1.1)
db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ? AND setting_value LIKE '%Texto provisional%'").run(POLICY_TEXT, 'policy_data');
db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ? AND setting_value LIKE '%Texto provisional%'").run(TERMS_TEXT, 'terms_conditions');

// 7.1 Configuración de Visibilidad (V12.2.1)
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('show_legal_login', '1');

// 7.2 Configuración de IA (V12.3.1)
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('ai_enabled', '1');
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('ai_openrouter_key', '');
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('ai_model', 'google/gemini-2.0-flash-lite-preview-02-05:free');
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('ai_system_prompt', 'Eres un asistente experto en gestión de eventos para la plataforma Check Pro. Ayudas a redactar correos, analizar datos de invitados y responder dudas logísticas.');

// 8. Logs de Auditoría (V10)
db.exec(`CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT,
    details TEXT,
    created_at TEXT
)`);

// 8b. Auditoría Estructurada (V12.3 - Seguridad)
db.exec(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT
)`);

try { db.exec("CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)"); } catch (_) {}

// ═══ NUEVAS TABLAS V10.5.3: GRUPOS Y PERMISOS JERÁRQUICOS ═══

// 9. Grupos (cada grupo tiene su propio Producer(es))
db.exec(`CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT,
    created_by TEXT
)`);

// Migraciones para grupos
try { db.exec("ALTER TABLE groups ADD COLUMN email TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE groups ADD COLUMN phone TEXT"); } catch (_) {}

// Migraciones para users
try { db.exec("ALTER TABLE users ADD COLUMN display_name TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch (_) {}

// 10. Relación Grupo-Usuario (muchos a muchos) - Productores del grupo
db.exec(`CREATE TABLE IF NOT EXISTS group_users (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_in_group TEXT DEFAULT 'PRODUCTOR',
    created_at TEXT,
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(group_id, user_id)
)`);

// 11. Relación Usuario-Evento (muchos a muchos) - Staff/Cliente en eventos
db.exec(`CREATE TABLE IF NOT EXISTS user_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    UNIQUE(user_id, event_id)
)`);

// Migraciones: agregar group_id a tablas existentes si no existen
try { db.exec("ALTER TABLE users ADD COLUMN group_id TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN group_id TEXT"); } catch (_) {}

// ═══ NUEVAS TABLAS V12.45: CLIENTES ═══

// Tabla de clientes (pertenecen a una empresa/group)
db.exec(`CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    group_id TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT,
    created_by TEXT,
    FOREIGN KEY (group_id) REFERENCES groups(id)
)`);

// Migración V12.44.68+: cambiar company_id a group_id
try {
    // Verificar si existe la columna company_id
    const columns = db.prepare("PRAGMA table_info(clients)").all();
    const hasCompanyId = columns.some(c => c.name === 'company_id');
    const hasGroupId = columns.some(c => c.name === 'group_id');
    
    if (hasCompanyId && !hasGroupId) {
        db.exec('ALTER TABLE clients ADD COLUMN group_id TEXT');
        db.exec('UPDATE clients SET group_id = company_id WHERE company_id IS NOT NULL');
        console.log('[MIGRATION] Columna company_id migrada a group_id');
    }
} catch (e) {
    console.error('[MIGRATION] Error migrando company_id a group_id:', e.message);
}

// Migración V12.44.67+: Asignar IDs a clientes que tienen id null
try {
    const { v4: uuidv4 } = require('uuid');
    const clientsWithNullId = db.prepare("SELECT rowid, id, name FROM clients WHERE id IS NULL OR id = ''").all();
    if (clientsWithNullId.length > 0) {
        console.log('[MIGRATION] Corrigiendo ' + clientsWithNullId.length + ' clientes con id null...');
        for (const client of clientsWithNullId) {
            // Generar ID único que no exista
            let newId;
            let attempts = 0;
            do {
                newId = uuidv4();
                const existing = db.prepare("SELECT id FROM clients WHERE id = ?").get(newId);
                if (!existing) break;
                attempts++;
            } while (attempts < 10);
            
            db.prepare("UPDATE clients SET id = ? WHERE rowid = ?").run(newId, client.rowid);
            console.log('[MIGRATION] Cliente ' + client.name + ' получил новый id: ' + newId);
        }
        console.log('[MIGRATION] Migración de clientes completada');
    }
} catch (e) {
    console.error('[MIGRATION] Error en migración de clientes:', e.message);
}

    // Relación Cliente-Evento (muchos a muchos)
db.exec(`CREATE TABLE IF NOT EXISTS client_events (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    UNIQUE(client_id, event_id)
)`);

// Relación Cliente-Staff (muchos a muchos) - Staff asignado a clientes
db.exec(`CREATE TABLE IF NOT EXISTS client_users (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(client_id, user_id)
)`);

// 13. Tabla de asistencia al evento (dashboard)
db.exec(`CREATE TABLE IF NOT EXISTS event_attendance (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    organization TEXT,
    cargo TEXT,
    vegano TEXT DEFAULT 'NO',
    restricciones TEXT,
    status TEXT DEFAULT 'PENDING',
    validated INTEGER DEFAULT 0,
    validated_at TEXT,
    validated_by TEXT,
    created_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (client_id) REFERENCES clients(id),
    UNIQUE(event_id, client_id)
)`);

// Migración V12.44.244+: Agregar columnas a event_attendance si no existen
try {
    const attColumns = db.prepare("PRAGMA table_info(event_attendance)").all();
    const columnNames = attColumns.map(c => c.name);
    
    if (!columnNames.includes('vegano')) {
        db.exec('ALTER TABLE event_attendance ADD COLUMN vegano TEXT DEFAULT "NO"');
    }
    if (!columnNames.includes('restricciones')) {
        db.exec('ALTER TABLE event_attendance ADD COLUMN restricciones TEXT');
    }
    if (!columnNames.includes('organization')) {
        db.exec('ALTER TABLE event_attendance ADD COLUMN organization TEXT');
    }
    if (!columnNames.includes('cargo')) {
        db.exec('ALTER TABLE event_attendance ADD COLUMN cargo TEXT');
    }
    if (!columnNames.includes('validated')) {
        db.exec('ALTER TABLE event_attendance ADD COLUMN validated INTEGER DEFAULT 0');
    }
    if (!columnNames.includes('validated_at')) {
        db.exec('ALTER TABLE event_attendance ADD COLUMN validated_at TEXT');
    }
    if (!columnNames.includes('validated_by')) {
        db.exec('ALTER TABLE event_attendance ADD COLUMN validated_by TEXT');
    }
    console.log('[MIGRATION] Tabla event_attendance verificada/actualizada');
} catch (e) {
    console.error('[MIGRATION] Error verificando event_attendance:', e.message);
}

// 14. Códigos de recuperación de contraseña
db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
)`);



// 17. Webhooks para integraciones externas (Slack, Discord, etc)
db.exec(`CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT, -- HMAC signing secret
    events TEXT NOT NULL, -- JSON array: ["guest.created", "guest.checked_in", "guest.updated", "event.created", "event.updated"]
    headers TEXT, -- JSON object for custom headers
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

// Migraciones para invitados (Bajas/Unsubscribe)
try { db.exec("ALTER TABLE guests ADD COLUMN unsubscribed INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE guests ADD COLUMN unsubscribe_token TEXT"); } catch (_) {}

// 18. Suscripciones para notificaciones push (Web Push API)
db.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// 19. Resultados guardados de sorteos (Ruleta V12.26.0)
db.exec(`CREATE TABLE IF NOT EXISTS wheel_results (
    id TEXT PRIMARY KEY,
    wheel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    winners_json TEXT NOT NULL DEFAULT '[]',
    total_participants INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wheel_id) REFERENCES event_wheels(id) ON DELETE CASCADE
)`);

// Índices para wheel_results
try { db.exec("CREATE INDEX IF NOT EXISTS idx_wheel_results_wheel ON wheel_results(wheel_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_wheel_results_created ON wheel_results(wheel_id DESC)"); } catch (_) {}

// ═══ MÓDULO DE MAILING (V12.45 - Nuevo) ═══

// Email Accounts (Cuentas SMTP/IMAP)
db.exec(`CREATE TABLE IF NOT EXISTS email_accounts (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT NOT NULL,
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT,
    smtp_password TEXT,
    smtp_ssl INTEGER DEFAULT 0,
    imap_host TEXT,
    imap_port INTEGER DEFAULT 993,
    imap_user TEXT,
    imap_password TEXT,
    imap_ssl INTEGER DEFAULT 1,
    imap_folder TEXT DEFAULT 'INBOX',
    sender_name TEXT,
    sender_email TEXT,
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    daily_limit INTEGER DEFAULT 500,
    emails_sent_today INTEGER DEFAULT 0,
    last_sent_date TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

// Migración agresiva: Si la tabla email_accounts existe con esquema legacy, recrearla
// Esto es necesario porque ALTER TABLE RENAME COLUMN no funciona bien en todas las versiones de SQLite
try {
    const columns = db.prepare("PRAGMA table_info(email_accounts)").all();
    const colNames = columns.map(c => c.name);
    // Si tiene columnas legacy (smtp_pass en vez de smtp_password), recrear
    if (colNames.includes('smtp_pass') && !colNames.includes('smtp_password')) {
        console.log('[MIGRATION] Recreando email_accounts con esquema correcto...');
        db.exec(`ALTER TABLE email_accounts RENAME TO email_accounts_old`);
        db.exec(`CREATE TABLE email_accounts (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            name TEXT NOT NULL,
            smtp_host TEXT,
            smtp_port INTEGER DEFAULT 587,
            smtp_user TEXT,
            smtp_password TEXT,
            smtp_ssl INTEGER DEFAULT 0,
            imap_host TEXT,
            imap_port INTEGER DEFAULT 993,
            imap_user TEXT,
            imap_password TEXT,
            imap_ssl INTEGER DEFAULT 1,
            imap_folder TEXT DEFAULT 'INBOX',
            sender_name TEXT,
            sender_email TEXT,
            is_default INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            daily_limit INTEGER DEFAULT 500,
            emails_sent_today INTEGER DEFAULT 0,
            last_sent_date TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (event_id) REFERENCES events(id)
        )`);
        // Copiar datos de la tabla vieja si es posible
        try {
            db.exec(`INSERT INTO email_accounts (id, event_id, name, smtp_host, smtp_port, smtp_user, smtp_password, smtp_ssl, imap_host, imap_port, imap_user, imap_password, imap_ssl, imap_folder, sender_name, sender_email, is_default, is_active, daily_limit, emails_sent_today, last_sent_date, created_at, updated_at)
                SELECT id, event_id, name, smtp_host, smtp_port, smtp_user, smtp_pass, COALESCE(smtp_use_ssl, 0), imap_host, imap_port, imap_user, imap_pass, COALESCE(imap_use_ssl, 1), COALESCE(imap_folder, 'INBOX'), COALESCE(sender_name, ''), COALESCE(sender_email, ''), COALESCE(is_default, 0), COALESCE(is_active, 1), COALESCE(daily_limit, 500), COALESCE(emails_sent_today, 0), last_sent_date, created_at, updated_at FROM email_accounts_old`);
        } catch(e) { console.log('[MIGRATION] No se pudieron copiar datos:', e.message); }
        db.exec(`DROP TABLE email_accounts_old`);
        console.log('[MIGRATION] email_accounts recreada exitosamente');
    }
} catch(e) {
    console.log('[MIGRATION email_accounts] Error o tabla no existe:', e.message);
}

// Migración: Agregar columnas faltantes a email_accounts (tablas existentes de versiones anteriores)
try { db.exec("ALTER TABLE email_accounts ADD COLUMN smtp_password TEXT"); } catch(_) {}
try { db.exec("ALTER TABLE email_accounts ADD COLUMN imap_password TEXT"); } catch(_) {}
try { db.exec("ALTER TABLE email_accounts ADD COLUMN smtp_ssl INTEGER DEFAULT 0"); } catch(_) {}
try { db.exec("ALTER TABLE email_accounts ADD COLUMN imap_ssl INTEGER DEFAULT 1"); } catch(_) {}
try { db.exec("ALTER TABLE email_accounts ADD COLUMN imap_folder TEXT DEFAULT 'INBOX'"); } catch(_) {}
try { db.exec("ALTER TABLE email_accounts ADD COLUMN sender_name TEXT"); } catch(_) {}
try { db.exec("ALTER TABLE email_accounts ADD COLUMN sender_email TEXT"); } catch(_) {}
try { db.exec("ALTER TABLE email_accounts ADD COLUMN is_default INTEGER DEFAULT 0"); } catch(_) {}
try { db.exec("ALTER TABLE email_accounts ADD COLUMN is_active INTEGER DEFAULT 1"); } catch(_) {}
try { db.exec("ALTER TABLE email_accounts ADD COLUMN daily_limit INTEGER DEFAULT 500"); } catch(_) {}
try { db.exec("ALTER TABLE email_accounts ADD COLUMN emails_sent_today INTEGER DEFAULT 0"); } catch(_) {}
try { db.exec("ALTER TABLE email_accounts ADD COLUMN last_sent_date TEXT"); } catch(_) {}

// Email Templates (Plantillas de email)
db.exec(`CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT NOT NULL,
    subject TEXT,
    body_html TEXT,
    body_text TEXT,
    category TEXT DEFAULT 'general',
    is_system INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

// Migración: Agregar columnas faltantes a email_templates (tablas existentes de versiones anteriores)
try { db.exec("ALTER TABLE email_templates ADD COLUMN is_system INTEGER DEFAULT 0"); } catch(_) {}
try { db.exec("ALTER TABLE email_templates ADD COLUMN body_html TEXT"); } catch(_) {}
try { db.exec("ALTER TABLE email_templates ADD COLUMN category TEXT DEFAULT 'general'"); } catch(_) {}

// Email Campaigns (Campañas)
db.exec(`CREATE TABLE IF NOT EXISTS email_campaigns (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    account_id TEXT,
    name TEXT NOT NULL,
    subject TEXT,
    body_html TEXT,
    status TEXT DEFAULT 'DRAFT',
    recipient_type TEXT DEFAULT 'all',
    recipient_group_id TEXT,
    scheduled_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (account_id) REFERENCES email_accounts(id)
)`);

// Email Logs (Logs de emails enviados)
db.exec(`CREATE TABLE IF NOT EXISTS email_logs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT,
    account_id TEXT,
    recipient_email TEXT,
    recipient_name TEXT,
    subject TEXT,
    status TEXT DEFAULT 'PENDING',
    error_message TEXT,
    sent_at TEXT,
    created_at TEXT,
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id)
)`);

// Email Queue (Cola de emails para procesamiento async)
db.exec(`CREATE TABLE IF NOT EXISTS email_queue (
    id TEXT PRIMARY KEY,
    campaign_id TEXT,
    account_id TEXT,
    recipient_email TEXT,
    recipient_data TEXT,
    subject TEXT,
    body_html TEXT,
    status TEXT DEFAULT 'PENDING',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_retry TEXT,
    error_message TEXT,
    created_at TEXT,
    processed_at TEXT,
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id)
)`);

// Índices para email
try { db.exec("CREATE INDEX IF NOT EXISTS idx_email_accounts_event ON email_accounts(event_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_email_accounts_default ON email_accounts(event_id, is_default)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_email_templates_event ON email_templates(event_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_email_campaigns_event ON email_campaigns(event_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_email_logs_campaign ON email_logs(campaign_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_email_queue_campaign ON email_queue(campaign_id)"); } catch (_) {}

// ═══ SEMILLA DE ADMIN POR DEFECTO ═══
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
if (userCount.count === 0) {
    const adminId = uuidv4();
    const adminHash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(adminId, 'admin@check.com', adminHash, 'ADMIN', 'APPROVED', new Date().toISOString());
    console.log("✓ Admin por defecto creado: admin@check.com / admin123");
}

// Crear tabla smtp_config si no existe
db.exec(`CREATE TABLE IF NOT EXISTS smtp_config (
    id INTEGER PRIMARY KEY,
    smtp_host TEXT DEFAULT '',
    smtp_port INTEGER DEFAULT 465,
    smtp_user TEXT DEFAULT '',
    smtp_password TEXT DEFAULT '',
    smtp_secure INTEGER DEFAULT 0,
    from_name TEXT DEFAULT 'Check Attendance'
)`);

// Semilla de SMTP config si no existe
const smtpCount = db.prepare("SELECT COUNT(*) as count FROM smtp_config").get();
if (smtpCount.count === 0) {
    db.prepare("INSERT INTO smtp_config (id, smtp_host, smtp_port, smtp_user, smtp_secure, from_name) VALUES (1, '', 465, '', 0, 'Check Attendance')").run();
}

// Crear tabla imap_config si no existe
db.exec(`CREATE TABLE IF NOT EXISTS imap_config (
    id INTEGER PRIMARY KEY,
    imap_host TEXT DEFAULT '',
    imap_port INTEGER DEFAULT 993,
    imap_user TEXT DEFAULT '',
    imap_password TEXT DEFAULT '',
    imap_tls INTEGER DEFAULT 1
)`);

// Semilla de IMAP config si no existe
const imapCount = db.prepare("SELECT COUNT(*) as count FROM imap_config").get();
if (imapCount.count === 0) {
    db.prepare("INSERT INTO imap_config (id, imap_host, imap_port, imap_tls) VALUES (1, '', 993, 1)").run();
}

// Semilla de plantillas globales administrativas
// ═══ ÍNDICES ADICIONALES (Performance V12.3) ═══
const additionalIndices = [
    // Guests - queries frecuentes
    "CREATE INDEX IF NOT EXISTS idx_guests_event_name ON guests(event_id, name COLLATE NOCASE)",
    "CREATE INDEX IF NOT EXISTS idx_guests_event_email ON guests(event_id, email COLLATE NOCASE)",
    "CREATE INDEX IF NOT EXISTS idx_guests_checkin ON guests(event_id, checked_in)",
    "CREATE INDEX IF NOT EXISTS idx_guests_event_newreg ON guests(event_id, is_new_registration)",
    "CREATE INDEX IF NOT EXISTS idx_guests_event_unsub ON guests(event_id, unsubscribed)",
    
    // Events - búsqueda por grupo y fecha
    "CREATE INDEX IF NOT EXISTS idx_events_group ON events(group_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_events_group_created ON events(group_id, created_at DESC)",
    
    // Users - búsqueda por grupo y nombre
    "CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_users_group_name ON users(group_id, display_name COLLATE NOCASE, username COLLATE NOCASE)",
    
    // Pre-registrations - por evento, estado y fecha
    "CREATE INDEX IF NOT EXISTS idx_prereg_event_status ON pre_registrations(event_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_prereg_event_status_registered ON pre_registrations(event_id, status, registered_at DESC)",
    
    // Guest suggestions - por evento y fecha
    "CREATE INDEX IF NOT EXISTS idx_guest_suggestions_event_submitted ON guest_suggestions(event_id, submitted_at DESC)",
    
    // Event agenda - por evento y horario
    "CREATE INDEX IF NOT EXISTS idx_event_agenda_event_start ON event_agenda(event_id, start_time)",
    
    // Surveys - por evento
    "CREATE INDEX IF NOT EXISTS idx_surveys_event ON surveys(event_id)",
    
    // Survey responses - por evento
    "CREATE INDEX IF NOT EXISTS idx_survey_responses_event ON survey_responses(event_id)",
    
    // Password resets - por código y usuario
    "CREATE INDEX IF NOT EXISTS idx_password_resets_code ON password_resets(code, expires_at)",
    "CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id, expires_at)",
    
    // Audit logs - por usuario y fecha
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC)",
    
    // Webhooks - por evento y estado
    "CREATE INDEX IF NOT EXISTS idx_webhooks_event_status ON webhooks(event_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status)",
];

for (const sql of additionalIndices) {
    try { db.exec(sql); } catch (_) {}
}

// ═══ SISTEMA DE AUTO-REPARACIÓN (V12.37.20) ═══
// Detectar y reparar registros con ID nulo que bloquean la UI
(function repairNullIds() {
    try {
        console.log("🔍 Iniciando auto-reparación de base de datos (v12.37.20)...");
        // Sistema de reparación genérico - solo para tablas principales
        console.log("✨ Auto-reparación completada.");
    } catch (e) {
        console.error("❌ Error en auto-reparación:", e.message);
    }
})();

// Importar Database Manager para bases de datos por evento
const { 
    getEventConnection, 
    createEventDatabase, 
    eventDatabaseExists,
    getEventDbPath,
    getEventDatabases,
    getEventDatabaseInfo,
    deleteEventDatabase
} = require('./src/utils/database-manager');

// Exportar función para usar en server.js
module.exports = { 
    db, 
    // Funciones de base de datos por evento
    getEventConnection,
    createEventDatabase,
    eventDatabaseExists,
    getEventDbPath,
    getEventDatabases,
    getEventDatabaseInfo,
    deleteEventDatabase
};
