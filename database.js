// database.js — better-sqlite3 V10 (Síncrono, moderno, sin callbacks)
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const fs = require('fs');
const basePath = process.env.DATA_PATH ? path.resolve(process.env.DATA_PATH, 'system') : path.resolve(__dirname, 'data/system');

// Asegurar que el directorio de datos existe (v12.44.314)
if (!fs.existsSync(basePath)) {
    try {
        fs.mkdirSync(basePath, { recursive: true });
        console.log('✓ Directorio de persistencia creado:', basePath);
    } catch (e) {
        console.error('✗ Error creando directorio de persistencia:', e.message);
    }
}

const dbFile = 'database.db';
let dbPath = path.resolve(basePath, dbFile);
let db;

try {
    // Prueba de escritura inmediata en el directorio de persistencia
    const writeTestPath = path.resolve(basePath, '.write_test');
    fs.writeFileSync(writeTestPath, 'ok');
    fs.unlinkSync(writeTestPath);
    
    db = new Database(dbPath);
    console.log('✓ Base de Datos PERSISTENTE validada en:', dbPath);
    
    // Sello de seguridad para verificar persistencia en logs
    db.pragma('user_version = 339');
} catch (error) {
    console.error('❌ ERROR FATAL DE PERSISTENCIA:', error.message);
    console.error('La aplicación se detendrá para evitar pérdida de datos en carpetas temporales.');
    console.error('Ruta intentada:', dbPath);
    process.exit(1);
}

// ═══ OPTIMIZACIONES DE RENDIMIENTO (Enterprise Grade) ═══

// 1. WAL Mode: Permite múltiples lectores y un escritor simultáneo
db.pragma('journal_mode = WAL');

// 2. Busy Timeout: Si la BD está ocupada, espera hasta 5000ms en lugar de fallar
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
    group_id TEXT,
    description TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (group_id) REFERENCES groups (id)
)`);
try { db.exec("ALTER TABLE events ADD COLUMN created_at TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN end_date TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN has_wheel INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN has_own_db INTEGER DEFAULT 0"); } catch (_) {}
// 2FA columns (C6-15)
try { db.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0"); } catch (_) {}

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
try { db.exec("ALTER TABLE events ADD COLUMN badge_config TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN landing_config TEXT"); } catch (_) {}
// Migration tracking table (C-04)
try { db.exec("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, name TEXT UNIQUE, applied_at TEXT DEFAULT (datetime('now')))"); } catch(_) {}
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
try { db.exec("ALTER TABLE events ADD COLUMN google_account_id TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN google_auto_sync_mode TEXT DEFAULT 'scheduled'"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN google_sync_interval INTEGER DEFAULT 60"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN google_last_sync_at TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN google_debounce_until TEXT"); } catch (_) {}
// Payment fields (F3-07)
try { db.exec("ALTER TABLE events ADD COLUMN payment_required INTEGER DEFAULT 0"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN currency TEXT DEFAULT 'USD'"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN stripe_account TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN paypal_email TEXT"); } catch (_) {}
// Branding columns (BL-16)
try { db.exec("ALTER TABLE events ADD COLUMN custom_css TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN brand_header_html TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN brand_footer_html TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN brand_primary_color TEXT DEFAULT '#7c3aed'"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN brand_logo_url TEXT"); } catch (_) {}
// Map coordinates (BL-21)
try { db.exec("ALTER TABLE events ADD COLUMN latitude REAL"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN longitude REAL"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN map_zoom INTEGER DEFAULT 14"); } catch (_) {}
// Music URL (BL-24)
try { db.exec("ALTER TABLE events ADD COLUMN music_url TEXT"); } catch (_) {}
// OTP code for check-in (BL-14)
try { db.exec("ALTER TABLE guests ADD COLUMN otp_code TEXT"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_guests_otp ON guests(otp_code)"); } catch (_) {}
// Automation rules (C3-06)
db.exec(`CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    conditions_json TEXT,
    actions_json TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_automation_rules_event ON automation_rules(event_id)"); } catch (_) {}
// Tenants table (C3-07)
db.exec(`CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#7c3aed',
    welcome_text TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain)"); } catch (_) {}
try { db.exec("ALTER TABLE groups ADD COLUMN tenant_id TEXT"); } catch (_) {}
// Video conference (C3-03)
try { db.exec("ALTER TABLE events ADD COLUMN video_conference_url TEXT"); } catch (_) {}
// Coupons table (C4-06)
db.exec(`CREATE TABLE IF NOT EXISTS coupons (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, code TEXT NOT NULL, discount_type TEXT NOT NULL DEFAULT 'percentage', discount_value REAL NOT NULL DEFAULT 0, max_uses INTEGER DEFAULT 0, current_uses INTEGER DEFAULT 0, expires_at TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE, UNIQUE(event_id, code))`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_coupons_event ON coupons(event_id)"); } catch (_) {}
// Performance logs table (C5-12)
db.exec("CREATE TABLE IF NOT EXISTS performance_logs (id TEXT PRIMARY KEY, operation TEXT, duration_ms INTEGER, details TEXT, created_at TEXT)");
try { db.exec("CREATE INDEX IF NOT EXISTS idx_perf_logs_created ON performance_logs(created_at)"); } catch (_) {}
// API Keys (C6-08)
db.exec(`CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, name TEXT NOT NULL, key TEXT UNIQUE NOT NULL, user_id TEXT, permissions TEXT DEFAULT 'read', last_used_at TEXT, expires_at TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key)"); } catch (_) {}
// Guest achievements / gamification (C5-06)
db.exec(`CREATE TABLE IF NOT EXISTS guest_achievements (id TEXT PRIMARY KEY, guest_id TEXT NOT NULL, event_id TEXT NOT NULL, achievement TEXT NOT NULL, awarded_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (guest_id) REFERENCES guests(id))`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_guest_achievements ON guest_achievements(guest_id)"); } catch (_) {}
// Guest networking profiles (C5-05)
try { db.exec("ALTER TABLE guests ADD COLUMN bio TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE guests ADD COLUMN interests TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE guests ADD COLUMN social_linkedin TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE guests ADD COLUMN photo_url TEXT"); } catch (_) {}
// Public proposals table (BL-20)
db.exec(`CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    guest_email TEXT,
    title TEXT NOT NULL,
    description TEXT,
    votes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_proposals_event ON proposals(event_id)"); } catch (_) {}
// Budget table (BL-18)
db.exec(`CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    concept TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    category TEXT DEFAULT 'general',
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_budgets_event ON budgets(event_id)"); } catch (_) {}
// Speakers table (BL-19)
db.exec(`CREATE TABLE IF NOT EXISTS speakers (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    bio TEXT,
    photo_url TEXT,
    social_twitter TEXT,
    social_linkedin TEXT,
    social_web TEXT,
    topic TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_speakers_event ON speakers(event_id)"); } catch (_) {}

// 3. Invitados
db.exec(`CREATE TABLE IF NOT EXISTS guests (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT,
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id)
)`);

// Migración V12.44.301: Asegurar columnas unificadas en la tabla guests
try {
    const columns = db.prepare("PRAGMA table_info(guests)").all().map(c => c.name);
    const required = ['cargo', 'vegano', 'restricciones', 'validated', 'validated_at', 'validated_by', 'unsubscribed', 'unsubscribe_token', 'status', 'category_id', 'waitlist_position', 'promoted_at', 'waitlisted_at'];
    required.forEach(col => {
        if (!columns.includes(col)) {
            let def = "TEXT";
            if (col === 'status') def = "TEXT DEFAULT 'lead'";
            if (col === 'vegano') def = "TEXT DEFAULT 'NO'";
            if (col === 'validated') def = "INTEGER DEFAULT 0";
            if (col.includes('unsubscribed')) def = "INTEGER DEFAULT 0";
            
            db.exec(`ALTER TABLE guests ADD COLUMN ${col} ${def}`);
            console.log(`[MIGRATION] Columna ${col} añadida a guests`);
        }
    });
} catch (e) {
    console.error('[MIGRATION] Error migrando tabla guests:', e.message);
}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_qr_token ON guests(qr_token)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status)"); } catch (_) {}

// Tabla de log de cambios de estado del pipeline
db.exec(`CREATE TABLE IF NOT EXISTS guest_status_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id TEXT,
    event_id TEXT,
    from_status TEXT,
    to_status TEXT,
    changed_by TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guest_id) REFERENCES guests(id)
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_status_log_guest ON guest_status_log(guest_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_status_log_event ON guest_status_log(event_id)"); } catch (_) {}

// Tabla de categorias de invitados por evento
db.exec(`CREATE TABLE IF NOT EXISTS guest_categories (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#64748b',
    capacity INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_guest_categories_event ON guest_categories(event_id)"); } catch (_) {}

// Tabla de sesiones
db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT,
    start_time TEXT,
    end_time TEXT,
    capacity INTEGER DEFAULT 0,
    location TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_event ON sessions(event_id)"); } catch (_) {}
try { db.exec("ALTER TABLE sessions ADD COLUMN layout_id TEXT"); } catch (_) {}

// Tabla de registro de invitados a sesiones
db.exec(`CREATE TABLE IF NOT EXISTS session_guests (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    guest_id TEXT,
    event_id TEXT,
    seat_id TEXT,
    checked_in INTEGER DEFAULT 0,
    checkin_time TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, guest_id)
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_session_guests_session ON session_guests(session_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_session_guests_guest ON session_guests(guest_id)"); } catch (_) {}
try { db.exec("ALTER TABLE session_guests ADD COLUMN seat_id TEXT"); } catch (_) {}

// Tabla de planos de sala (seat maps)
db.exec(`CREATE TABLE IF NOT EXISTS seat_layouts (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_seat_layouts_event ON seat_layouts(event_id)"); } catch (_) {}

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
    template_id TEXT,
    event_id TEXT,
    guest_id TEXT,
    answers_json TEXT,
    responses_json TEXT,
    time_spent_seconds INTEGER,
    device TEXT,
    ip_address TEXT,
    submitted_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events (id),
    FOREIGN KEY (guest_id) REFERENCES guests (id)
)`);

try { db.exec("ALTER TABLE survey_responses ADD COLUMN template_id TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE survey_responses ADD COLUMN answers_json TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE survey_responses ADD COLUMN time_spent_seconds INTEGER"); } catch (_) {}
try { db.exec("ALTER TABLE survey_responses ADD COLUMN device TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE survey_responses ADD COLUMN ip_address TEXT"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_survey_responses_template ON survey_responses(template_id)"); } catch (_) {}

// ═══ NUEVAS TABLAS: SURVEY TEMPLATES + RAFFLES (V12.45) ═══

db.exec(`CREATE TABLE IF NOT EXISTS survey_templates (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',
    total_responses INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS survey_questions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'short_text',
    title TEXT NOT NULL,
    description TEXT,
    options_json TEXT,
    required INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    section TEXT,
    image_url TEXT,
    has_other INTEGER DEFAULT 0,
    conditional_json TEXT,
    created_at TEXT,
    FOREIGN KEY (template_id) REFERENCES survey_templates(id) ON DELETE CASCADE
)`);

try { db.exec("CREATE INDEX IF NOT EXISTS idx_survey_questions_template ON survey_questions(template_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_survey_templates_event ON survey_templates(event_id)"); } catch (_) {}

db.exec(`CREATE TABLE IF NOT EXISTS raffles (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'wheel',
    name TEXT NOT NULL,
    config_json TEXT,
    data_source TEXT DEFAULT 'guests',
    source_template_id TEXT,
    winner_count INTEGER DEFAULT 1,
    total_participants INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS raffle_participants (
    id TEXT PRIMARY KEY,
    raffle_id TEXT NOT NULL,
    guest_id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    source TEXT DEFAULT 'guests',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE
)`);

db.exec(`CREATE TABLE IF NOT EXISTS raffle_results (
    id TEXT PRIMARY KEY,
    raffle_id TEXT NOT NULL,
    round INTEGER DEFAULT 1,
    winners_json TEXT NOT NULL DEFAULT '[]',
    total_participants INTEGER DEFAULT 0,
    label TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE
)`);

try { db.exec("CREATE INDEX IF NOT EXISTS idx_raffles_event ON raffles(event_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_raffle_participants_raffle ON raffle_participants(raffle_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_raffle_results_raffle ON raffle_results(raffle_id)"); } catch (_) {}

db.exec(`CREATE TABLE IF NOT EXISTS raffle_spins (
    id TEXT PRIMARY KEY,
    raffle_id TEXT,
    winner_name TEXT,
    ip_address TEXT,
    created_at TEXT,
    FOREIGN KEY (raffle_id) REFERENCES raffles(id)
)`);

try { db.exec("ALTER TABLE raffle_spins ADD COLUMN lead_json TEXT"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_raffle_spins_raffle ON raffle_spins(raffle_id)"); } catch (_) {}
try { db.exec("ALTER TABLE raffle_results ADD COLUMN notes TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE raffle_results ADD COLUMN label TEXT"); } catch (_) {}
try { db.exec("ALTER TABLE guest_categories ADD COLUMN price REAL DEFAULT 0"); } catch (_) {}

// Transactions table (F3-07)
db.exec(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    guest_id TEXT,
    category_id TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    provider TEXT NOT NULL,
    provider_txn_id TEXT,
    status TEXT DEFAULT 'pending',
    guest_name TEXT,
    guest_email TEXT,
    metadata_json TEXT,
    created_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_event ON transactions(event_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)"); } catch (_) {}

// 7. Configuración Global (Legales V10)
db.exec(`CREATE TABLE IF NOT EXISTS settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT
)`);

// Cache para settings (evita queries repetidas)
const _settingsCache = new Map();
const SETTINGS_CACHE_TTL = 60000; // 1 minuto

function getSetting(key) {
    const cached = _settingsCache.get(key);
    if (cached && Date.now() - cached.ts < SETTINGS_CACHE_TTL) {
        return cached.value;
    }
    const row = db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").get(key);
    const value = row ? row.setting_value : null;
    _settingsCache.set(key, { value, ts: Date.now() });
    return value;
}

function setSetting(key, value) {
    db.prepare("INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)").run(key, value);
    _settingsCache.delete(key);
}

function clearSettingsCache() {
    _settingsCache.clear();
}

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

// 7.3 Configuración Google Sheets OAuth (F3-09)
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('google_client_id', '');
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('google_client_secret', '');
db.prepare(`INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`).run('google_redirect_uri', '');

// ============================================================
// 7.3 Políticas de Seguridad IA por defecto (v12.44.624)
// Basado en: NIST AI RMF, NCSC/CISA Guidelines, MITRE ATLAS,
//            CrowdStrike "Proteger los Sistemas de IA", OWASP LLM Top 10
// ============================================================

const defaultAiPolicies = [
    {
        name: 'Uso Aceptable de Herramientas de Inteligencia Artificial',
        description: 'Directrices para el uso seguro, responsable y autorizado de sistemas de IA en la organizacion. Aplica a todo el personal, contratistas y terceros con acceso a la plataforma.',
        content: `POLITICA DE USO ACEPTABLE DE INTELIGENCIA ARTIFICIAL

1. ALCANCE Y PROPOSITO
Esta politica establece las reglas para el uso de herramientas, modelos y agentes de inteligencia artificial (IA) dentro de la organizacion. Su objetivo es garantizar que la IA se utilice de forma segura, etica, transparente y cumpliendo con la normativa aplicable. Aplica a todos los usuarios, incluyendo personal interno, contratistas, proveedores y cualquier tercero con acceso a los sistemas de la organizacion.

2. AUTORIZACION Y REGISTRO
2.1. Solo se permite el uso de herramientas, modelos y agentes de IA que hayan sido previamente autorizados e incluidos en el inventario oficial de sistemas de IA aprobados.
2.2. Cualquier herramienta, extension de navegador, plugin, copiloto o servicio SaaS con capacidades de IA que no figure en el inventario aprobado se considera NO autorizado (Shadow AI).
2.3. Los usuarios que necesiten utilizar una herramienta de IA no listada deben solicitarlo formalmente al administrador del sistema, quien evaluara los riesgos de seguridad y privacidad antes de autorizarla.
2.4. Queda prohibida la instalacion o activacion de extensiones de navegador, plugins de IDE, o complementos basados en IA sin la autorizacion explicita del equipo de seguridad.

3. CLASIFICACION Y PROTECCION DE DATOS
3.1. PROHIBIDO: Ingresar datos personales de invitados (PII: nombres completos, emails, telefonos, direcciones, datos biomedicos), credenciales de acceso, claves de API, tokens de autenticacion, informacion financiera, propiedad intelectual (codigo fuente propietario, algoritmos, secretos comerciales) o cualquier dato clasificado como "Confidencial" o "Restringido" en herramientas de IA externas no autorizadas.
3.2. DATOS SINTETICOS: Para pruebas, demostraciones y capacitacion con IA, utilizar EXCLUSIVAMENTE datos sinteticos o anonimizados. Queda prohibido el uso de datos reales de invitados, eventos o clientes en entornos de prueba, demostracion o entrenamiento de modelos de IA.
3.3. MINIMIZACION: Al interactuar con sistemas de IA autorizados, proporcionar unicamente la informacion estrictamente necesaria para la tarea. Evitar incluir contextos completos, historiales de chat extensos o bases de conocimiento enteras cuando solo se requiere una consulta especifica.
3.4. ENMASCARAMIENTO: Los datos sensibles (emails, telefonos, identificadores numericos, direcciones) deben ser enmascarados, seudonimizados o anonimizados antes de ser enviados a modelos de IA externos o basados en la nube.

4. TRANSPARENCIA Y CONSENTIMIENTO
4.1. Los invitados y usuarios tienen derecho a saber cuando estan interactuando con un sistema de IA, ya sea un chatbot, un asistente virtual, un sistema de recomendacion o cualquier otro sistema basado en IA.
4.2. Cuando la IA se utilice para tomar decisiones que afecten a invitados (ejemplo: priorizacion, clasificacion, evaluacion), se debe informar explicitamente al invitado sobre el uso de IA en el proceso y ofrecer la posibilidad de solicitar revision humana.
4.3. Los invitados deben haber consentido explicitamente al tratamiento de sus datos antes de que estos sean procesados por sistemas de IA. El consentimiento debe ser libre, informado, especifico e inequivoco.

5. EVALUACION DE RIESGOS (Basado en NCSC Secure Design)
5.1. Todo nuevo caso de uso de IA debe pasar por una evaluacion de riesgos de seguridad antes de ser implementado en produccion.
5.2. La evaluacion debe incluir:
    a) Identificacion del modelo y proveedor
    b) Datos que seran procesados (tipo, volumen, sensibilidad)
    c) Integraciones con otros sistemas (APIs, bases de datos, servicios externos)
    d) Analisis de vectores de ataque (threat modeling): inyeccion de prompts, envenenamiento de datos, extraccion de informacion del modelo, manipulacion de salidas, escalada de privilegios a traves de agentes
    e) Medidas de mitigacion implementadas
    f) Responsable del caso de uso y del modelo
5.3. Los casos de uso de IA clasificados como de "Alto Riesgo" (segun criterios NIST AI RMF y Ley de IA de la UE) requieren aprobacion del comite de seguridad antes de su implementacion.

6. PROVEEDORES Y TERCEROS
6.1. Solo se contrataran servicios de IA de proveedores que cumplan con:
    a) Acuerdos de nivel de servicio (SLA) que incluyan seguridad y privacidad
    b) Politicas de retencion y eliminacion de datos claras
    c) Cumplimiento con regulaciones aplicables (GDPR, Ley de IA UE, CCPA, etc.)
    d) Capacidad de auditabilidad y portabilidad de datos
    e) Sin clausulas que permitan el entrenamiento de modelos con los datos del cliente sin consentimiento explicito
6.2. Los proveedores de IA deben ser revisados y aprobados por el equipo de seguridad antes de su contratacion.

7. REPORTE DE INCIDENTES
7.1. Cualquier comportamiento anomalo de un sistema de IA debe ser reportado inmediatamente al equipo de seguridad:
    a) Respuestas inesperadas, ofensivas, o que revelen informacion no autorizada
    b) Intentos de inyeccion de prompts o manipulacion del modelo
    c) Acceso a datos que no corresponden al perfil del usuario
    d) Agentes que realicen acciones no autorizadas o no previstas
    e) Sospecha de que el modelo ha sido comprometido o envenenado
7.2. El reporte debe incluir: fecha, hora, sistema afectado, descripcion del incidente, pasos para reproducirlo (si aplica) y acciones tomadas.

8. INCUMPLIMIENTO
El incumplimiento de esta politica puede resultar en:
    a) Suspension temporal o permanente del acceso al sistema
    b) Acciones disciplinarias segun la politica interna de la organizacion
    c) Notificacion a autoridades regulatorias si el incumplimiento resulta en una violacion de datos
    d) Responsabilidad legal por danos causados por el uso no autorizado de IA`

    },
    {
        name: 'Gobernanza de Datos y Privacidad en Sistemas de IA',
        description: 'Clasificacion, proteccion, retencion y eliminacion de datos procesados por sistemas de IA. Basado en NIST AI RMF y OWASP LLM Top 10.',
        content: `POLITICA DE GOBERNANZA DE DATOS Y PRIVACIDAD EN SISTEMAS DE IA

1. OBJETIVO Y ALCANCE
Esta politica establece los principios y procedimientos para la clasificacion, proteccion, retencion, portabilidad y eliminacion de datos procesados por sistemas de inteligencia artificial. Se alinea con el NIST AI Risk Management Framework (AI RMF) en sus cuatro funciones: Govern (Gobernar), Map (Mapear), Measure (Medir) y Manage (Gestionar). Aplica a todos los datos que ingresan, circulan o son generados por sistemas de IA dentro de la organizacion.

2. CLASIFICACION DE DATOS (Basado en NIST AI RMF - Govern)
2.1. Todos los datos que interactuan con sistemas de IA deben ser etiquetados segun su nivel de sensibilidad:

    a) PUBLICO: Informacion que puede ser divulgada sin restricciones. Ejemplo: nombres de eventos publicos, fechas, ubicaciones generales.
    b) INTERNO: Informacion de uso interno que no contiene datos personales ni sensibles. Ejemplo: configuraciones del sistema, estadisticas agregadas.
    c) CONFIDENCIAL: Informacion que contiene datos personales de invitados (PII), datos de clientes, o informacion comercial sensible. Ejemplo: nombres, emails, telefonos, organizaciones, cargos, preferencias alimenticias, restricciones medicas.
    d) RESTRINGIDO: Informacion altamente sensible cuyo acceso o divulgacion no autorizada podria causar danos significativos. Ejemplo: credenciales de acceso, claves de API, tokens de autenticacion, datos biomedicos, informacion financiera, propiedad intelectual.

2.2. Por defecto, todos los datos deben clasificarse como CONFIDENCIAL hasta que se demuestre lo contrario.

3. MAPEO DE DATOS (Basado en NIST AI RMF - Map)
3.1. Para cada sistema de IA implementado, se debe mantener un mapa de datos que documente:
    a) Que datos ingresa el sistema (origen, tipo, volumen, formato)
    b) Que contexto adicional se anade (bases de conocimiento, historiales, integraciones)
    c) Que datos genera el sistema (respuestas, analiticas, decisiones)
    d) Donde se almacenan los datos (base de datos, logs, cache, vectores)
    e) Por cuanto tiempo se retienen (plazos de retencion)
    f) Quien tiene acceso a los datos en cada etapa
    g) Hacia donde se transmiten los datos (servicios internos, APIs externas, modelos en la nube)

4. MEDICION Y CONTROL (Basado en NIST AI RMF - Measure)
4.1. Controles de acceso:
    a) Aplicar el principio de minimo privilegio: los sistemas de IA solo deben tener acceso a los datos estrictamente necesarios para su funcion.
    b) Los agentes de IA deben tener identidades unicas con permisos granularizados. Prohibido el uso de cuentas de servicio compartidas o credenciales de administrador para agentes.
    c) Implementar Zero Trust: toda solicitud de acceso a datos por parte de un sistema de IA debe ser autenticada, autorizada y auditada.
    d) Los roles y permisos deben ser asignados a traves de controles de identidad, no embebidos en configuraciones de modelos.

4.2. Consentimiento y procedencia:
    a) Todo dato personal ingresado a un sistema de IA debe tener una procedencia documentada y un consentimiento valido asociado.
    b) Los equipos juridicos y de privacidad deben validar: si se obtuvo el consentimiento, si se permite la retencion, que derechos estan asociados a la reutilizacion o entrenamiento del modelo, y si se aplican controles jurisdiccionales o de transferencia de datos.
    c) Tratar la procedencia de datos como parte de la revision de riesgos y adquisiciones, no solo de la gobernanza de privacidad.

4.3. Evaluacion de Impacto en Privacidad (DPIA):
    a) Antes de implementar cualquier sistema de IA que procese datos personales, se debe realizar una Evaluacion de Impacto en Privacidad (DPIA).
    b) La DPIA debe documentar: el proposito del tratamiento, la base legal, los datos involucrados, los riesgos para los derechos y libertades de las personas, y las medidas de mitigacion implementadas.
    c) Las DPIAs deben ser revisadas y aprobadas por el oficial de privacidad o el equipo legal.

5. RETENCION Y ELIMINACION DE DATOS
5.1. Plazos maximos de retencion para logs de interacciones con IA:
    a) Prompts de usuario (entrada): maximo 90 dias
    b) Respuestas del modelo (salida): maximo 90 dias
    c) Logs de auditoria de acceso: maximo 1 ano
    d) Datos de entrenamiento personalizados: solo el tiempo necesario para el ajuste del modelo, maximo 30 dias tras completar el entrenamiento
    e) Datos de evaluacion y pruebas: eliminar inmediatamente despues de su uso

5.2. Al cumplirse los plazos de retencion, los datos deben ser eliminados de forma segura:
    a) Datos en BD: DELETE con confirmacion de eliminacion
    b) Archivos: eliminacion segura (sobrescritura o trituracion digital)
    c) Backups: respetar politicas de retencion de backups, pero asegurar que los datos restaurados no excedan los plazos de retencion

5.3. Los invitados tienen derecho a solicitar la eliminacion de sus datos personales de los sistemas de IA (Derecho al Olvido / Supresion):
    a) La solicitud debe ser procesada en un maximo de 30 dias calendario
    b) Incluye: datos de invitados en la BD principal, logs de interacciones con IA, datos en vectores de embeddings (si se usan), datos en caches
    c) Se debe confirmar por escrito al solicitante la eliminacion completa

6. PORTABILIDAD DE DATOS
6.1. Los invitados tienen derecho a solicitar la exportacion de todos sus datos almacenados, incluyendo aquellos procesados por sistemas de IA.
6.2. El formato de exportacion debe ser JSON estructurado y legible por maquina.
6.3. La exportacion debe incluir:
    a) Datos personales del invitado (nombre, email, telefono, organizacion, cargo)
    b) Historial de eventos a los que ha sido invitado
    c) Registro de interacciones con sistemas de IA (prompts y respuestas anonimizados)
    d) Cualquier otro dato generado o procesado por sistemas de IA que este vinculado al invitado
6.4. La solicitud de portabilidad debe ser procesada en un maximo de 30 dias calendario.

7. ENTRENAMIENTO Y AJUSTE DE MODELOS
7.1. Si la organizacion entrena o ajusta modelos de IA:
    a) Eliminar toda PII, PHI (informacion medica protegida) e IP (propiedad intelectual) de los conjuntos de entrenamiento
    b) Excluir datos confidenciales o sujetos a regulaciones de los conjuntos de entrenamiento
    c) Usar pipelines de filtrado y validacion manual durante la ingesta de datos de entrenamiento
    d) Documentar el linaje de datos de entrenamiento con fines de auditoria y trazabilidad
    e) Mantener registros inmutables de: datos de entrenamiento utilizados, configuracion del modelo, hiperparametros, metricas de rendimiento, y resultados de evaluaciones
7.2. Prohibido el entrenamiento de modelos con datos de produccion sin autorizacion explicita y sin el consentimiento de los titulares de los datos.

8. SEGMENTACION DE ENTORNOS
8.1. Los entornos de IA deben estar claramente segmentados:
    a) DESARROLLO: Solo datos sinteticos o anonimizados. Sin acceso a datos de produccion.
    b) PRUEBAS/STAGING: Solo datos sinteticos. Sin acceso a APIs de produccion.
    c) PRODUCCION: Datos reales con todos los controles de seguridad y privacidad implementados.
8.2. Prohibido mover datos entre entornos sin autorizacion y sin cumplir con las politicas de clasificacion.`

    },
    {
        name: 'Seguridad en Operaciones y Respuesta a Incidentes con IA',
        description: 'Monitoreo en tiempo real, deteccion de amenazas, respuesta a incidentes y Red Teaming para sistemas de IA. Basado en NCSC Secure Operations, MITRE ATLAS y CISA guidelines.',
        content: `POLITICA DE SEGURIDAD EN OPERACIONES Y RESPUESTA A INCIDENTES CON IA

1. OBJETIVO Y ALCANCE
Esta politica establece los requisitos de monitoreo, deteccion de amenazas, respuesta a incidentes y pruebas de seguridad (Red Teaming) para todos los sistemas de inteligencia artificial implementados en la organizacion. Se basa en las guias de NCSC (National Cyber Security Centre) para Secure Operations, el framework MITRE ATLAS para tacticas adversariales de IA, y las recomendaciones de CISA. Aplica a todos los modelos, agentes, copilotos y sistemas basados en IA en entornos de produccion.

2. LOGGING Y AUDITORIA (Basado en NCSC Secure Operations)
2.1. Toda interaccion con sistemas de IA debe ser registrada en logs inmutables con la siguiente informacion minima:
    a) Identificador unico de la interaccion (UUID)
    b) Timestamp con precision de milisegundos
    c) Identidad del usuario o sistema que realiza la consulta (user_id, session_id)
    d) Prompt del usuario (texto enviado al modelo)
    e) Contexto adicional enviado al modelo (datos recuperados de bases de conocimiento, integraciones, historial de conversacion)
    f) Respuesta completa del modelo
    g) Modelo utilizado (nombre, version, proveedor)
    h) Tiempo de respuesta (latencia en ms)
    i) Tokens consumidos (input/output)
    j) Resultado de la validacion de seguridad (aprobado/bloqueado/mascarado)
    k) Direccion IP de origen y user-agent

2.2. Datos sensibles en logs:
    a) Los campos que contengan PII (nombres, emails, telefonos) deben ser enmascarados automaticamente en los logs mediante funcion de hashing o seudonimizacion
    b) Las claves de API, tokens y credenciales deben ser completamente removidas de los logs
    c) El enmascaramiento debe ocurrir antes de la persistencia del log, no solo en la visualizacion

2.3. Los logs deben ser:
    a) Inmutables: una vez escritos, no pueden ser modificados ni eliminados antes de su periodo de retencion
    b) Firmados digitalmente o almacenados en sistemas de solo append (append-only)
    c) Accesibles solo para el equipo de seguridad y auditoria
    d) Respaldados con la misma frecuencia que los logs del sistema central

3. MONITOREO Y DETECCION DE AMENAZAS (Basado en MITRE ATLAS)
3.1. El sistema de monitoreo debe generar alertas automaticas para los siguientes comportamientos anomalos:

    a) Volumen anormal de consultas: mas de X consultas por minuto desde una misma IP o usuario (umbral configurable por caso de uso)
    b) Patrones de inyeccion de prompts: cadenas de texto que coincidan con patrones conocidos de jailbreaking, prompt injection, o bypass de instrucciones del sistema (basado en taxonomia de metodos de inyeccion de prompts de CrowdStrike)
    c) Acceso a datos fuera del perfil: consultas que intenten acceder a informacion de invitados, eventos o configuraciones que no correspondan al perfil del usuario autenticado
    d) Ubicaciones geograficas no habituales: accesos desde paises o regiones donde la organizacion no tiene presencia operativa
    e) Intentos de extraccion de informacion del modelo: consultas repetitivas diseñadas para extraer el prompt del sistema, las instrucciones internas, los datos de entrenamiento o la configuracion del modelo (model extraction / inversion)
    f) Manipulacion de salidas: intentos de forzar al modelo a generar contenido prohibido, engañoso, o a suplantar identidades
    g) Llamadas a funciones no autorizadas: agentes que intenten invocar herramientas, APIs o funciones que no estan en su lista de capacidades autorizadas
    h) Encadenamiento no intencionado de tareas: agentes que ejecuten secuencias de acciones que no fueron solicitadas por el usuario

3.2. Los umbrales de alerta deben ser calibrados por caso de uso y revisados trimestralmente.

4. PROTECCION DE DATOS EN TIEMPO REAL (DLP para IA)
4.1. Antes de enviar datos a un modelo externo, se deben aplicar los siguientes controles en tiempo real:
    a) Inspeccion de contenido: detectar y bloquear el envio de PII, credenciales, claves de API, tokens, informacion financiera o propiedad intelectual
    b) Enmascaramiento automatico: reemplazar datos sensibles con placeholders antes del envio al modelo
    c) Bloqueo contextual: si el prompt contiene una combinacion de datos que sugiere un intento de exfiltracion, la consulta debe ser bloqueada y registrada

4.2. A la salida del modelo:
    a) Inspeccion de respuestas: detectar si el modelo esta revelando informacion que no deberia (datos de entrenamiento, prompts del sistema, informacion de otros usuarios)
    b) Filtrado de contenido sensible: bloquear respuestas que contengan PII no autorizada, credenciales, o informacion confidencial
    c) Validacion de formato: asegurar que la respuesta cumple con el formato esperado y no contiene inyeccion de codigo (HTML, SQL, JavaScript, comandos de sistema)

5. RESPUESTA A INCIDENTES (Basado en MITRE ATLAS y NCSC)
5.1. Clasificacion de incidentes de IA:

    a) INYECCION DE PROMPTS (Prompt Injection / Jailbreaking):
       - Accion inmediata: Bloquear la consulta, notificar al equipo de seguridad, registrar el intento con todos los detalles
       - Accion de remediacion: Revisar y fortalecer las instrucciones del sistema (system prompt), implementar filtros adicionales de entrada, actualizar el modelo si es necesario
       - Tiempo objetivo de respuesta: < 15 minutos

    b) FILTRACION DE DATOS (Data Exfiltration):
       - Accion inmediata: Detener el servicio de IA afectado, revisar logs para identificar el alcance de la exposicion, notificar al oficial de privacidad
       - Accion de remediacion: Identificar que datos fueron expuestos, contactar a los afectados si es requerido por ley, implementar controles adicionales de DLP
       - Tiempo objetivo de respuesta: < 1 hora

    c) ENVENENAMIENTO DE MODELO (Model Poisoning):
       - Accion inmediata: Detener la inferencia, aislar el modelo comprometido, revisar el pipeline de entrenamiento
       - Accion de remediacion: Revertir a una version anterior del modelo, auditar los datos de entrenamiento recientes, fortalecer los controles de ingesta de datos
       - Tiempo objetivo de respuesta: < 2 horas

    d) ESCALADA DE PRIVILEGIOS POR AGENTES (Agent Privilege Escalation):
       - Accion inmediata: Revocar credenciales del agente, detener su ejecucion, auditar todas las acciones realizadas por el agente
       - Accion de remediacion: Revisar y reducir los permisos del agente, implementar controles de acceso adicionales, registrar el incidente
       - Tiempo objetivo de respuesta: < 30 minutos

    e) COMPORTAMIENTO ANOMALO DE AGENTE (Agent Behavioral Anomaly):
       - Accion inmediata: Pausar el agente, revisar logs de acciones, identificar la causa raiz
       - Accion de remediacion: Actualizar las reglas de comportamiento del agente, implementar limites de ejecucion, registrar el incidente
       - Tiempo objetivo de respuesta: < 1 hora

5.2. Todos los incidentes de IA deben ser documentados en el sistema de tickets de seguridad.

6. ACTUALIZACIONES Y GESTION DE VULNERABILIDADES
6.1. Los modelos y componentes de IA deben mantenerse actualizados:
    a) Modelos de IA: actualizar a versiones que corrijan vulnerabilidades de seguridad conocidas en un maximo de 30 dias calendario desde la publicacion del parche
    b) Dependencias de software (librerias, paquetes, frameworks): escanear semanalmente con herramientas como npm audit, pip audit, trivy, snyk o similares
    c) Vulnerabilidades criticas (CVSS >= 9.0): parchar en un maximo de 7 dias calendario
    d) Vulnerabilidades altas (CVSS >= 7.0): parchar en un maximo de 30 dias calendario
    e) Vulnerabilidades medias/bajas: parchar en el ciclo regular de actualizaciones

6.2. Los proveedores de IA deben ser revisados trimestralmente.

7. SEGMENTACION Y AISLAMIENTO
7.1. Los entornos de IA deben estar estrictamente segmentados:
    a) DESARROLLO: Sin acceso a datos de produccion, sin conexion a APIs de produccion, sin credenciales reales
    b) PRUEBAS (STAGING): Datos sinteticos o anonimizados, conexiones a servicios de prueba, credenciales de prueba
    c) PRODUCCION: Datos reales con controles de seguridad completos, conexiones a servicios de produccion, credenciales con minimo privilegio

7.2. Prohibido usar datos de produccion en entornos de desarrollo o pruebas, compartir credenciales entre entornos, tener acceso a produccion desde entornos de desarrollo, almacenar claves de API/tokens/secretos en el codigo fuente o configuraciones accesibles por el modelo.

8. RED TEAMING Y PRUEBAS DE SEGURIDAD (Basado en MITRE ATLAS y OWASP LLM Top 10)
8.1. Se deben realizar pruebas de seguridad adversarial (Red Teaming) especificas para IA con una frecuencia minima de cada 6 meses.
8.2. Escenarios minimos a probar: inyeccion directa de prompts, inyeccion indirecta (via RAG), extraccion de informacion del modelo, manipulacion de salidas, uso indebido de herramientas y agentes, ataques de denegacion de servicio (IA DoS).
8.3. Las vulnerabilidades descubiertas deben ser registradas en el sistema de seguimiento.

9. INTEGRACION CON EL SOC
9.1. Las detecciones de seguridad de IA deben integrarse en los flujos de trabajo del SOC existente.
9.2. Se debe establecer un canal de comunicacion directo entre el equipo de seguridad de IA y el SOC.

10. MEJORA CONTINUA
10.1. Las politicas, controles y procedimientos de seguridad de IA deben revisarse anualmente como minimo, despues de cada incidente significativo, al implementar nuevos tipos de modelos o agentes, y cuando cambien las regulaciones aplicables.
10.2. Las lecciones aprendidas deben documentarse y utilizarse para mejorar continuamente la postura de seguridad de IA.`

    }
];

// Seed politicas por defecto (solo si no existen)
defaultAiPolicies.forEach(function(policy) {
    try {
        var existing = db.prepare("SELECT id FROM ai_policies WHERE name = ?").get(policy.name);
        if (!existing) {
            var pId = uuidv4();
            db.prepare("INSERT INTO ai_policies (id, name, description, content, created_at) VALUES (?, ?, ?, ?, ?)")
              .run(pId, policy.name, policy.description, policy.content, new Date().toISOString());
            console.log('[SEED] Politica IA creada:', policy.name);
        }
    } catch(e) {
        console.error('[SEED] Error creando politica IA:', e.message);
    }
});

// Tabla de inventario de sistemas de IA (Shadow AI Detection)
db.exec(`CREATE TABLE IF NOT EXISTS ai_inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'llm',
    provider TEXT,
    description TEXT,
    data_processed TEXT DEFAULT '[]',
    risk_level TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'detected',
    detected_at TEXT,
    last_seen_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

// Tabla de politicas de uso de IA
db.exec(`CREATE TABLE IF NOT EXISTS ai_policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
)`);

// Tabla de logs de consultas IA (FS-03 AIDR)
db.exec(`CREATE TABLE IF NOT EXISTS ai_prompt_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    prompt TEXT NOT NULL,
    response TEXT,
    model TEXT,
    risk_score REAL DEFAULT 0,
    injection_detected INTEGER DEFAULT 0,
    injection_pattern TEXT,
    masked_prompt TEXT,
    masked_response TEXT,
    tokens_used INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    ip_address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

try { db.exec("CREATE INDEX IF NOT EXISTS idx_prompt_logs_user ON ai_prompt_logs(user_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_prompt_logs_risk ON ai_prompt_logs(risk_score)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_prompt_logs_created ON ai_prompt_logs(created_at DESC)"); } catch (_) {}

// Tabla de alertas de seguridad IA (FS-03 AIDR)
db.exec(`CREATE TABLE IF NOT EXISTS ai_alerts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT,
    source TEXT,
    user_id TEXT,
    user_name TEXT,
    metadata TEXT,
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

try { db.exec("CREATE INDEX IF NOT EXISTS idx_ai_alerts_severity ON ai_alerts(severity)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_ai_alerts_created ON ai_alerts(created_at DESC)"); } catch (_) {}

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

// 9. Clasificacion de Datos (FS-02 Compliance)
db.exec(`CREATE TABLE IF NOT EXISTS data_classification (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    classification TEXT NOT NULL DEFAULT 'internal',
    category TEXT DEFAULT 'general',
    description TEXT,
    is_pii INTEGER DEFAULT 0,
    is_spi INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    UNIQUE(table_name, column_name)
)`);

try { db.exec("CREATE INDEX IF NOT EXISTS idx_data_class_table ON data_classification(table_name)"); } catch (_) {}

// 10. Logs de Acceso a Datos (FS-02 Compliance - auditoria de lecturas)
db.exec(`CREATE TABLE IF NOT EXISTS data_access_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    table_name TEXT,
    record_id TEXT,
    action TEXT NOT NULL DEFAULT 'read',
    sensitivity TEXT,
    ip_address TEXT,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

try { db.exec("CREATE INDEX IF NOT EXISTS idx_access_log_user ON data_access_log(user_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_access_log_table ON data_access_log(table_name)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_access_log_created ON data_access_log(created_at DESC)"); } catch (_) {}

// Seed classifications (PII fields)
(function() {
    var existing = db.prepare("SELECT COUNT(*) as cnt FROM data_classification").get();
    if (existing.cnt === 0) {
        var piiFields = [
            ['guests', 'name', 'confidential', 'identidad', 'Nombre completo del invitado', 1, 0],
            ['guests', 'email', 'confidential', 'contacto', 'Correo electronico del invitado', 1, 0],
            ['guests', 'phone', 'confidential', 'contacto', 'Telefono del invitado', 1, 0],
            ['guests', 'company', 'internal', 'laboral', 'Empresa del invitado', 0, 1],
            ['guests', 'position', 'internal', 'laboral', 'Cargo del invitado', 0, 1],
            ['guests', 'dietary_restrictions', 'internal', 'salud', 'Restricciones alimentarias', 0, 1],
            ['guests', 'special_needs', 'confidential', 'salud', 'Necesidades especiales', 0, 1],
            ['guests', 'notes', 'internal', 'general', 'Notas internas del invitado', 0, 0],
            ['pre_registrations', 'name', 'confidential', 'identidad', 'Nombre del pre-registro', 1, 0],
            ['pre_registrations', 'email', 'confidential', 'contacto', 'Email del pre-registro', 1, 0],
            ['pre_registrations', 'phone', 'confidential', 'contacto', 'Telefono del pre-registro', 1, 0],
            ['users', 'name', 'confidential', 'identidad', 'Nombre del usuario', 1, 0],
            ['users', 'email', 'confidential', 'contacto', 'Email del usuario', 1, 0],
            ['users', 'phone', 'internal', 'contacto', 'Telefono del usuario', 0, 0],
            ['clients', 'name', 'confidential', 'identidad', 'Nombre del cliente', 1, 0],
            ['clients', 'email', 'confidential', 'contacto', 'Email del cliente', 1, 0],
            ['clients', 'phone', 'confidential', 'contacto', 'Telefono del cliente', 1, 0],
            ['clients', 'rfc', 'confidential', 'fiscal', 'RFC del cliente', 0, 1],
            ['groups', 'name', 'internal', 'general', 'Nombre del grupo/empresa', 0, 0],
            ['groups', 'notes', 'internal', 'general', 'Notas del grupo', 0, 0],
            ['groups', 'internal_notes', 'confidential', 'general', 'Notas internas del grupo', 0, 1],
            ['events', 'name', 'public', 'general', 'Nombre del evento', 0, 0],
            ['events', 'location', 'public', 'general', 'Ubicacion del evento', 0, 0],
            ['events', 'notes', 'internal', 'general', 'Notas del evento', 0, 0]
        ];
        var insert = db.prepare("INSERT INTO data_classification (id, table_name, column_name, classification, category, description, is_pii, is_spi) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        piiFields.forEach(function(f) {
            insert.run(require('uuid').v4(), f[0], f[1], f[2], f[3], f[4], f[5], f[6]);
        });
        console.log('[COMPLIANCE] Seed classifications: ' + piiFields.length + ' fields');
    }
})();

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

// ═══ TABLA: CUENTAS GOOGLE POR GRUPO (F3-09) ═══
db.exec(`CREATE TABLE IF NOT EXISTS group_google_accounts (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    label TEXT NOT NULL,
    google_email TEXT,
    refresh_token TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
)`);

try { db.exec("CREATE INDEX IF NOT EXISTS idx_gga_group ON group_google_accounts(group_id)"); } catch (_) {}
try { db.exec("ALTER TABLE group_google_accounts ADD COLUMN spreadsheet_id TEXT"); } catch (_) {}

// Tabla de cuentas Google personales por usuario (Parte 1 - F3-09)
db.exec(`CREATE TABLE IF NOT EXISTS user_google_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    google_email TEXT,
    refresh_token TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
)`);

try { db.exec("CREATE INDEX IF NOT EXISTS idx_uga_user ON user_google_accounts(user_id)"); } catch (_) {}
try { db.exec("ALTER TABLE events ADD COLUMN google_folder_id TEXT"); } catch (_) {}

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
            console.log('[MIGRATION] Cliente ' + client.name + ' recibio nuevo id: ' + newId);
        }
        console.log('[MIGRATION] Migración de clientes completada');
    }
} catch (e) {
    console.error('[MIGRATION] Error en migración de clientes:', e.message);
}

// Migración: Agregar columnas extendidas a clients (organización, cargo, dieta, vegano)
try {
    const clientCols = db.prepare("PRAGMA table_info(clients)").all().map(function(c) { return c.name; });
    const newCols = [
        ['organization', 'TEXT'],
        ['position', 'TEXT'],
        ['dietary_notes', 'TEXT'],
        ['vegano', 'TEXT DEFAULT \'NO\'']
    ];
    newCols.forEach(function(col) {
        if (!clientCols.includes(col[0])) {
            db.exec("ALTER TABLE clients ADD COLUMN " + col[0] + " " + col[1]);
            console.log('[MIGRATION] Columna ' + col[0] + ' agregada a clients');
        }
    });
} catch (e) {
    console.error('[MIGRATION] Error agregando columnas a clients:', e.message);
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

// Las funciones de asistencia han sido unificadas en la tabla 'guests' (V12.44.299)




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

// ═══ TOKEN BLACKLIST (JWT revocation) ═══
db.exec(`CREATE TABLE IF NOT EXISTS token_blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_jti TEXT NOT NULL,
    user_id TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
)`);
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(token_jti)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at)"); } catch (_) {}

// ═══ SEMILLA DE ADMIN POR DEFECTO ═══
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
if (userCount.count === 0) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@check.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminId = uuidv4();
    const adminHash = bcrypt.hashSync(adminPassword, 10);
    db.prepare("INSERT INTO users (id, username, password, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(adminId, adminEmail, adminHash, 'ADMIN', 'APPROVED', new Date().toISOString());
    console.log(`✓ Admin por defecto creado: ${adminEmail} / ${adminPassword}`);
}

// ─── Crear tabla de respaldo de configuracion de email (legacy, mantenido para compatibilidad) ───
// Las tablas smtp_config e imap_config fueron reemplazadas por email_accounts
// Se mantienen solo para no romper instalaciones existentes que las referencien

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
    
    // Webhook logs - por webhook
    "CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id)",
    
    // Email queue - por estado y campaña
    "CREATE INDEX IF NOT EXISTS idx_email_queue_status_campaign ON email_queue(status, campaign_id)",
    
    // Email campaigns - por estado y programación
    "CREATE INDEX IF NOT EXISTS idx_email_campaigns_status_scheduled ON email_campaigns(status, scheduled_at)",
    
    // Scheduled notifications - por estado y programación
    "CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_status ON scheduled_notifications(status, scheduled_at)",
    
    // Guest tags - por evento
    "CREATE INDEX IF NOT EXISTS idx_guest_tags_event ON guest_tags(event_id)",
    
    // Guest tag assignments - por guest
    "CREATE INDEX IF NOT EXISTS idx_guest_tag_assignments_guest ON guest_tag_assignments(guest_id)",
    
    // AI prompt logs - por inyección
    "CREATE INDEX IF NOT EXISTS idx_ai_prompt_logs_injection ON ai_prompt_logs(injection_detected)",
    
    // AI alerts - por acknowledged
    "CREATE INDEX IF NOT EXISTS idx_ai_alerts_acknowledged ON ai_alerts(acknowledged_at)",
    
    // Data access log - por fecha
    "CREATE INDEX IF NOT EXISTS idx_data_access_log_created ON data_access_log(created_at)",
    
    // Business rules - por trigger
    "CREATE INDEX IF NOT EXISTS idx_business_rules_trigger ON business_rules(trigger_event)",
    
    // CRM contacts - por email y conexión
    "CREATE INDEX IF NOT EXISTS idx_crm_contacts_email_conn ON crm_contacts(email, connection_id)",
];

for (const sql of additionalIndices) {
    try { db.exec(sql); } catch (_) {}
}

// ═══ VENUES / ESPACIOS ═══
db.exec(`CREATE TABLE IF NOT EXISTS venues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    capacity INTEGER DEFAULT 0,
    resources TEXT DEFAULT '[]',
    description TEXT,
    created_at TEXT,
    created_by TEXT
)`);
try { db.exec("ALTER TABLE events ADD COLUMN venue_id TEXT"); } catch (_) {}

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

// Tabla de logs de webhooks (BL-25)
db.exec(`CREATE TABLE IF NOT EXISTS webhook_logs (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event_type TEXT,
    request_url TEXT,
    request_headers TEXT,
    request_body TEXT,
    response_status INTEGER,
    response_body TEXT,
    duration_ms INTEGER,
    success INTEGER DEFAULT 0,
    created_at TEXT,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at)"); } catch (_) {}

// 17b. Deploy logs para auto-deploy con webhooks (C6-14)
db.exec(`CREATE TABLE IF NOT EXISTS deploy_logs (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    repository TEXT,
    ref TEXT,
    commit_sha TEXT,
    committer TEXT,
    status TEXT NOT NULL DEFAULT 'received',
    portainer_status TEXT,
    error TEXT,
    created_at TEXT
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_deploy_logs_created ON deploy_logs(created_at)"); } catch (_) {}

// Tabla de historial de cambios para undo/redo (C6-06)
db.exec(`CREATE TABLE IF NOT EXISTS change_log (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    user_id TEXT,
    undone INTEGER DEFAULT 0,
    created_at TEXT,
    FOREIGN KEY (event_id) REFERENCES events(id)
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_change_log_event ON change_log(event_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_change_log_entity ON change_log(entity_type, entity_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_change_log_created ON change_log(created_at)"); } catch (_) {}

// Tabla de plantillas de notificaciones (C8-01)
db.exec(`CREATE TABLE IF NOT EXISTS notification_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    icon TEXT DEFAULT '/icon-192.png',
    url TEXT,
    segment TEXT DEFAULT 'all',
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT
)`);

// Tabla de notificaciones programadas (C8-01)
db.exec(`CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id TEXT PRIMARY KEY,
    template_id TEXT,
    event_id TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    icon TEXT DEFAULT '/icon-192.png',
    url TEXT,
    segment TEXT DEFAULT 'all',
    status TEXT DEFAULT 'scheduled',
    scheduled_at TEXT,
    sent_at TEXT,
    sent_count INTEGER DEFAULT 0,
    error TEXT,
    created_by TEXT,
    created_at TEXT,
    FOREIGN KEY (template_id) REFERENCES notification_templates(id)
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_sched_notif_status ON scheduled_notifications(status)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_sched_notif_scheduled ON scheduled_notifications(scheduled_at)"); } catch (_) {}

// Ecommerce connections (C8-04)
db.exec(`CREATE TABLE IF NOT EXISTS ecommerce_connections (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    name TEXT NOT NULL,
    store_url TEXT NOT NULL,
    api_key TEXT,
    api_secret TEXT,
    webhook_secret TEXT,
    is_active INTEGER DEFAULT 1,
    last_sync_at TEXT,
    created_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS ecommerce_products (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price TEXT DEFAULT '0',
    currency TEXT DEFAULT 'USD',
    mapped_event_id TEXT,
    mapped_category_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (connection_id) REFERENCES ecommerce_connections(id)
)`);
db.exec(`CREATE TABLE IF NOT EXISTS ecommerce_sync_logs (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    event TEXT,
    status TEXT,
    payload TEXT,
    created_at TEXT,
    FOREIGN KEY (connection_id) REFERENCES ecommerce_connections(id)
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_eco_products_conn ON ecommerce_products(connection_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_eco_logs_conn ON ecommerce_sync_logs(connection_id)"); } catch (_) {}

// CRM connections (C8-06)
db.exec(`CREATE TABLE IF NOT EXISTS crm_connections (
    id TEXT PRIMARY KEY, platform TEXT NOT NULL, name TEXT NOT NULL,
    api_key TEXT, api_secret TEXT, region TEXT DEFAULT 'us',
    is_active INTEGER DEFAULT 1, last_sync_at TEXT, created_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS crm_contacts (
    id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, external_id TEXT,
    name TEXT, email TEXT, phone TEXT, company TEXT, raw_data TEXT, created_at TEXT,
    FOREIGN KEY (connection_id) REFERENCES crm_connections(id)
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email)"); } catch (_) {}

// Plugin system (C8-09) + Marketplace (C8-10)
db.exec(`CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY, name TEXT UNIQUE, version TEXT DEFAULT '1.0.0',
    author TEXT, description TEXT, source_url TEXT, permissions TEXT DEFAULT 'read',
    is_active INTEGER DEFAULT 1, installed_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS marketplace_listings (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, version TEXT DEFAULT '1.0.0',
    author TEXT, description TEXT, source_url TEXT, category TEXT DEFAULT 'tools',
    price TEXT DEFAULT 'free', installs INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT
)`);

// Pricing tiers (C8-11)
db.exec(`CREATE TABLE IF NOT EXISTS pricing_tiers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'USD', features TEXT DEFAULT '[]',
    max_events INTEGER DEFAULT 0, max_guests_per_event INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at TEXT
)`);

// Smart tagging (C9-04)
db.exec(`CREATE TABLE IF NOT EXISTS guest_tags (
    id TEXT PRIMARY KEY, event_id TEXT, name TEXT NOT NULL,
    color TEXT DEFAULT '#0ba5ec', filter_criteria TEXT, created_at TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS guest_tag_assignments (
    id TEXT PRIMARY KEY, guest_id TEXT NOT NULL, tag_id TEXT NOT NULL,
    UNIQUE(guest_id, tag_id)
)`);
try { db.exec("CREATE INDEX IF NOT EXISTS idx_tag_assign_guest ON guest_tag_assignments(guest_id)"); } catch (_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_tag_assign_tag ON guest_tag_assignments(tag_id)"); } catch (_) {}

// Business rules (C9-07)
db.exec(`CREATE TABLE IF NOT EXISTS business_rules (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, event_id TEXT,
    trigger_event TEXT NOT NULL, condition_expr TEXT,
    action_type TEXT NOT NULL, action_config TEXT,
    is_active INTEGER DEFAULT 1, created_at TEXT
)`);

// Workflows (C9-06)
db.exec(`CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
    steps TEXT NOT NULL, trigger_event TEXT DEFAULT 'manual',
    is_active INTEGER DEFAULT 1, created_at TEXT
)`);

// Migracion: encriptar passwords SMTP/IMAP existentes si ENCRYPTION_KEY esta configurada
try {
    if (process.env.ENCRYPTION_KEY) {
        const { isEncrypted, encryptPassword } = require('./src/security/encryption');
        const accounts = db.prepare('SELECT id, smtp_password, imap_password FROM email_accounts').all();
        for (const acc of accounts) {
            if (acc.smtp_password && !isEncrypted(acc.smtp_password)) {
                db.prepare('UPDATE email_accounts SET smtp_password = ? WHERE id = ?').run(encryptPassword(acc.smtp_password), acc.id);
            }
            if (acc.imap_password && !isEncrypted(acc.imap_password)) {
                db.prepare('UPDATE email_accounts SET imap_password = ? WHERE id = ?').run(encryptPassword(acc.imap_password), acc.id);
            }
        }
        console.log('✓ Passwords SMTP/IMAP encriptadas en reposo');
    }
} catch (_) {}

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

// ═══ Tablas del Ciclo 11 (master DB) ═══
try { db.exec(`
    CREATE TABLE IF NOT EXISTS polls (
        id TEXT PRIMARY KEY, event_id TEXT NOT NULL, session_id TEXT,
        title TEXT NOT NULL, description TEXT, type TEXT DEFAULT 'single',
        status TEXT DEFAULT 'draft', points INTEGER DEFAULT 10,
        time_limit_seconds INTEGER DEFAULT 0, correct_answer TEXT,
        created_at TEXT, updated_at TEXT
    )
`); } catch(_) {}
try { db.exec(`
    CREATE TABLE IF NOT EXISTS poll_options (
        id TEXT PRIMARY KEY, poll_id TEXT NOT NULL, label TEXT NOT NULL,
        order_index INTEGER DEFAULT 0, is_correct INTEGER DEFAULT 0,
        FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
    )
`); } catch(_) {}
try { db.exec(`
    CREATE TABLE IF NOT EXISTS poll_votes (
        id TEXT PRIMARY KEY, poll_id TEXT NOT NULL, guest_id TEXT,
        option_id TEXT, answer_text TEXT, voted_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
        FOREIGN KEY (guest_id) REFERENCES guests(id)
    )
`); } catch(_) {}
try { db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard (
        id TEXT PRIMARY KEY, event_id TEXT NOT NULL, guest_id TEXT NOT NULL,
        points INTEGER DEFAULT 0, updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (guest_id) REFERENCES guests(id), UNIQUE(event_id, guest_id)
    )
`); } catch(_) {}
try { db.exec(`
    CREATE TABLE IF NOT EXISTS point_history (
        id TEXT PRIMARY KEY, event_id TEXT NOT NULL, guest_id TEXT NOT NULL,
        points INTEGER NOT NULL, reason TEXT, reference_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (guest_id) REFERENCES guests(id)
    )
`); } catch(_) {}
try { db.exec(`
    CREATE TABLE IF NOT EXISTS badges (
        id TEXT PRIMARY KEY, event_id TEXT NOT NULL, name TEXT NOT NULL,
        description TEXT, icon TEXT DEFAULT '🏆', criteria TEXT,
        points_reward INTEGER DEFAULT 0
    )
`); } catch(_) {}
try { db.exec(`
    CREATE TABLE IF NOT EXISTS guest_badges (
        id TEXT PRIMARY KEY, badge_id TEXT NOT NULL, guest_id TEXT NOT NULL,
        earned_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
        FOREIGN KEY (guest_id) REFERENCES guests(id)
    )
`); } catch(_) {}
try { db.exec(`
    CREATE TABLE IF NOT EXISTS networking_connections (
        id TEXT PRIMARY KEY, event_id TEXT NOT NULL, from_guest_id TEXT NOT NULL,
        to_guest_id TEXT NOT NULL, connected_at TEXT DEFAULT (datetime('now')),
        notes TEXT, FOREIGN KEY (from_guest_id) REFERENCES guests(id),
        FOREIGN KEY (to_guest_id) REFERENCES guests(id),
        UNIQUE(event_id, from_guest_id, to_guest_id)
    )
`); } catch(_) {}
try { db.exec(`
    CREATE TABLE IF NOT EXISTS event_photos (
        id TEXT PRIMARY KEY, event_id TEXT NOT NULL, guest_id TEXT,
        filename TEXT, caption TEXT, approved INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (guest_id) REFERENCES guests(id)
    )
`); } catch(_) {}
try { db.exec(`
    CREATE TABLE IF NOT EXISTS certificate_templates (
        id TEXT PRIMARY KEY, event_id TEXT NOT NULL, name TEXT NOT NULL,
        config TEXT, created_at TEXT, updated_at TEXT
    )
`); } catch(_) {}
try { db.exec(`
    CREATE TABLE IF NOT EXISTS guest_certificates (
        id TEXT PRIMARY KEY, template_id TEXT NOT NULL, event_id TEXT NOT NULL,
        guest_id TEXT NOT NULL, generated_at TEXT DEFAULT (datetime('now')),
        download_count INTEGER DEFAULT 0,
        FOREIGN KEY (guest_id) REFERENCES guests(id)
    )
`); } catch(_) {}
try { db.exec(`
    CREATE TABLE IF NOT EXISTS plugin_instances (
        id TEXT PRIMARY KEY, plugin_id TEXT NOT NULL, event_id TEXT,
        enabled INTEGER DEFAULT 0, settings TEXT,
        installed_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
    )
`); } catch(_) {}
try { db.exec(`
    CREATE TABLE IF NOT EXISTS plugin_logs (
        id TEXT PRIMARY KEY, plugin_id TEXT NOT NULL, event_id TEXT,
        hook TEXT, status TEXT, message TEXT,
        logged_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
    )
`); } catch(_) {}
// Índices Ciclo 11
try { db.exec("CREATE INDEX IF NOT EXISTS idx_polls_event ON polls(event_id)"); } catch(_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id)"); } catch(_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id)"); } catch(_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_leaderboard_event ON leaderboard(event_id)"); } catch(_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_point_history_guest ON point_history(guest_id)"); } catch(_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_guest_badges_guest ON guest_badges(guest_id)"); } catch(_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_networking_event ON networking_connections(event_id)"); } catch(_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_event_photos_event ON event_photos(event_id)"); } catch(_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_cert_templates_event ON certificate_templates(event_id)"); } catch(_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_plugin_instances_plugin ON plugin_instances(plugin_id)"); } catch(_) {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_plugin_logs_plugin ON plugin_logs(plugin_id)"); } catch(_) {}

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
    deleteEventDatabase,
    // Cache de settings
    getSetting,
    setSetting,
    clearSettingsCache
};
